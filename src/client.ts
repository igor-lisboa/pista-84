import { DEFAULT_RUNTIME_CONFIG, type RuntimeConfig } from './shared/config.ts';
import { applyStatic, detectLang, setLang } from './i18n/index.ts';

async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  try {
    const response = await fetch('/runtime-config.json');
    if (!response.ok) return DEFAULT_RUNTIME_CONFIG;
    return (await response.json()) as RuntimeConfig;
  } catch {
    return DEFAULT_RUNTIME_CONFIG;
  }
}

async function main(): Promise<void> {
  const params = new URLSearchParams(location.search);
  if (params.has('controller')) {
    const {mountControllerPage} = await import('./ui/controller-page.ts');
    setLang(detectLang(navigator.languages));
    applyStatic();
    mountControllerPage(params);
    return;
  }
  const [{GameApp}, config] = await Promise.all([import('./ui/game-app.ts'), loadRuntimeConfig()]);
  new GameApp(config).mount();
}

void main();
