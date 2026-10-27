import {
  CARS,
  PAINTS,
  coinPrice,
  loadSave,
  type BalanceConfig,
  type CarSpec,
  type Paint,
  type Race,
  type SaveData,
} from '../game/index.ts';
import { carTagline, paintName, t } from '../i18n/index.ts';
import { createCarThumbnail } from './car-art.ts';
import { byId, formatBrl } from './dom.ts';
import type { CashStore } from './store.ts';

const MAX_IMPORT_BYTES = 100_000;

export interface GarageDeps {
  readonly save: SaveData;
  readonly race: Race;
  readonly config: BalanceConfig;
  readonly store: CashStore;
  /** The selected car with the chosen paint applied. */
  selectedCar(): CarSpec;
  /** Re-reads the selected car into a fresh, ready-to-start race. */
  resetForCar(): void;
  persist(): void;
  /** Repaints the car shown on the main menu. */
  refreshFeatured(): void;
  toast(message: string): void;
  cloudEnabled(): boolean;
}

/** Garage dialog: car shop, paint shop, and progress backup/restore. */
export class Garage {
  private readonly deps: GarageDeps;

  constructor(deps: GarageDeps) {
    this.deps = deps;
  }

  render(): void {
    const { save } = this.deps;
    const cloud = this.deps.cloudEnabled();
    byId('modalBody').innerHTML = `
      <span class="label">${t('garage.label')}</span>
      <h1>${t('garage.title')}<span>.</span></h1>
      <p>${t('garage.balance', { coins: `<b class="gold">◈ ${save.coins}</b>` })}</p>
      <div class="garage-grid" id="garageGrid"></div>
      <section class="paint-shop">
        <h3>${t('garage.paintTitle')}</h3>
        <p>${t('garage.paintNote')}</p>
        <div id="paints"></div>
      </section>
      <div id="cloudTools" class="backup-tools" ${cloud ? '' : 'hidden'}>
        <button id="cloudUpload">${t('garage.cloudUp')}</button>
        <button id="cloudRestore">${t('garage.cloudDown')}</button>
      </div>
      <p class="cloud-note" ${cloud ? '' : 'hidden'}>${t('garage.cloudNote')}</p>
      <div class="backup-tools">
        <button id="exportSave">${t('garage.export')}</button>
        <label>${t('garage.import')}<input type="file" id="importSave" accept="application/json"></label>
      </div>
      <p>${t('garage.disclaimer')}</p>`;

    const grid = byId('garageGrid');
    for (const car of CARS) grid.append(this.carCard(car));
    const paints = byId('paints');
    for (const paint of PAINTS) paints.append(this.paintButton(paint));

    byId('cloudUpload').onclick = () => void this.syncCloud(false);
    byId('cloudRestore').onclick = () => void this.syncCloud(true);
    byId('exportSave').onclick = () => this.exportSave();
    byId<HTMLInputElement>('importSave').onchange = (event) => void this.importSave(event);
  }

  private carCard(car: CarSpec): HTMLElement {
    const { save } = this.deps;
    const owned = save.owned.includes(car.id);
    const selected = save.selected === car.id;
    const premium = car.purchase.kind === 'cash';

    const card = document.createElement('article');
    card.className = `car-card ${selected ? 'active' : ''}`;
    card.append(createCarThumbnail(selected ? this.deps.selectedCar() : car));

    const body = document.createElement('div');
    body.innerHTML = `
      <h3>${car.name}</h3>
      <p>${carTagline(car.id)}</p>
      <dl>
        <div><dt>${t('garage.max')}</dt><dd>${car.max} km/h</dd></div>
        <div><dt>${t('garage.accel')}</dt><dd>${car.accel}</dd></div>
        <div><dt>${t('garage.fuel')}</dt><dd>${car.consumption.toFixed(2)}×</dd></div>
        ${premium && !owned ? `<div><dt></dt><dd>${t('garage.premium')}</dd></div>` : ''}
      </dl>
      <button></button>`;
    const button = body.querySelector('button')!;
    button.textContent = selected
      ? t('garage.selected')
      : owned
        ? t('garage.select')
        : car.purchase.kind === 'cash'
          ? t('garage.buyCash', { price: formatBrl(car.purchase.price) })
          : t('garage.unlock', { price: car.purchase.price });
    button.disabled = selected || (!owned && car.purchase.kind === 'coins' && save.coins < car.purchase.price);
    button.onclick = () => void this.chooseCar(car, owned);
    card.append(body);
    return card;
  }

  private async chooseCar(car: CarSpec, owned: boolean): Promise<void> {
    const { save } = this.deps;
    if (!owned) {
      if (car.purchase.kind === 'cash') {
        if (!(await this.buyWithCash(car))) return;
      } else {
        if (save.coins < coinPrice(car)) return;
        save.coins -= coinPrice(car);
      }
      save.owned.push(car.id);
    }
    save.selected = car.id;
    this.deps.resetForCar();
    this.deps.persist();
    this.deps.refreshFeatured();
    this.render();
  }

  private async buyWithCash(car: CarSpec): Promise<boolean> {
    if (!this.deps.store.available) {
      this.deps.toast(t('garage.storeUnavailable'));
      return false;
    }
    return this.deps.store.purchase(car.id);
  }

  private paintButton(paint: Paint): HTMLButtonElement {
    const { save } = this.deps;
    const owned = save.paints.includes(paint.id);
    const selected = save.paint === paint.id;
    const swatch = paint.color ?? CARS.find((car) => car.id === save.selected)!.color;

    const button = document.createElement('button');
    button.className = `paint-option ${selected ? 'active' : ''}`;
    button.disabled = selected || (!owned && save.coins < paint.price);
    const state = selected ? t('garage.inUse') : owned ? t('garage.apply') : `◈ ${paint.price}`;
    button.innerHTML = `<i style="background:${swatch}"></i><span>${paintName(paint.id)}<small>${state}</small></span>`;
    button.onclick = () => {
      if (!owned) {
        if (save.coins < paint.price) return;
        save.coins -= paint.price;
        save.paints.push(paint.id);
      }
      save.paint = paint.id;
      this.deps.race.car = this.deps.selectedCar();
      this.deps.persist();
      this.deps.refreshFeatured();
      this.render();
    };
    return button;
  }

  private exportSave(): void {
    const blob = new Blob([JSON.stringify(this.deps.save, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'pista84-progress.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  private async importSave(event: Event): Promise<void> {
    try {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;
      if (file.size > MAX_IMPORT_BYTES) throw new Error(t('garage.bigFile'));
      const text = await file.text();
      const data: unknown = JSON.parse(text);
      const candidate = data as { owned?: unknown; coins?: unknown } | null;
      if (!candidate || !Array.isArray(candidate.owned) || !Number.isFinite(candidate.coins)) {
        throw new Error(t('garage.badFile'));
      }
      this.applySave(text);
      this.deps.toast(t('garage.imported'));
    } catch (error) {
      this.deps.toast(error instanceof Error ? error.message : t('garage.badFile'));
    }
  }

  /** Replaces the in-memory save with sanitised data and returns to the menu state. */
  private applySave(serialized: string): void {
    Object.assign(this.deps.save, loadSave({ getItem: () => serialized }, this.deps.config));
    this.deps.race.car = this.deps.selectedCar();
    this.deps.race.status = 'paused';
    this.deps.resetForCar();
    this.deps.persist();
    this.deps.refreshFeatured();
    this.render();
  }

  private async syncCloud(restore: boolean): Promise<void> {
    const buttons = [byId<HTMLButtonElement>('cloudUpload'), byId<HTMLButtonElement>('cloudRestore')];
    buttons.forEach((button) => (button.disabled = true));
    try {
      const response = await fetch('/api/progress');
      const data = (await response.json()) as { error?: string; save?: unknown; revision?: number };
      if (!response.ok) throw new Error(data.error ?? t('garage.cloudUnavailable'));

      if (restore) {
        if (!data.save) throw new Error(t('garage.cloudNone'));
        this.applySave(JSON.stringify(data.save));
        this.deps.toast(t('garage.cloudRestored'));
      } else {
        const result = await fetch('/api/progress', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ save: this.deps.save, revision: data.revision }),
        });
        const updated = (await result.json()) as { error?: string };
        if (!result.ok) throw new Error(updated.error ?? t('garage.cloudFail'));
        this.deps.toast(t('garage.cloudSaved'));
      }
    } catch (error) {
      this.deps.toast(error instanceof Error ? error.message : t('garage.cloudFail'));
    } finally {
      buttons.forEach((button) => (button.disabled = false));
    }
  }
}
