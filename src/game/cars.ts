export type CarShape = 'bug' | 'box' | 'bike' | 'sport' | 'suv' | 'van' | 'sedan' | 'muscle';

export interface CarSpec {
  readonly id: string;
  readonly name: string;
  /** Top speed in km/h. */
  readonly max: number;
  /** Relative acceleration; higher pulls harder. */
  readonly accel: number;
  /** Fuel consumption multiplier. */
  readonly consumption: number;
  /** Steering authority multiplier. */
  readonly handling: number;
  /** How the car is unlocked. */
  readonly purchase: Purchase;
  readonly color: string;
  readonly shape: CarShape;
}

/** The visual subset of a car, enough to draw a sprite. */
export type CarLook = Pick<CarSpec, 'id' | 'color' | 'shape'>;

/** Every car is unlocked with race coins. */
export interface Purchase {
  readonly kind: 'coins';
  readonly price: number;
}

export const coinPrice = (car: CarSpec): number => car.purchase.price;

export interface Paint {
  readonly id: string;
  /** `null` keeps the factory colour of the selected car. */
  readonly color: string | null;
  readonly price: number;
}

export const CARS: readonly CarSpec[] = [
  { id: 'fusca', name: 'Fusca 76', color: '#f5c542', max: 155, accel: 26, consumption: 0.72, handling: 1, purchase: { kind: 'coins', price: 0 }, shape: 'bug' },
  { id: 'brasilia', name: 'Brasília 80', color: '#6ed4a0', max: 165, accel: 29, consumption: 0.8, handling: 1, purchase: { kind: 'coins', price: 180 }, shape: 'box' },
  { id: 'gol', name: 'Gol Bolinha', color: '#669df4', max: 185, accel: 36, consumption: 0.9, handling: 1.12, purchase: { kind: 'coins', price: 420 }, shape: 'box' },
  { id: 'palio', name: 'Palio 98', color: '#f08364', max: 180, accel: 34, consumption: 0.82, handling: 1.08, purchase: { kind: 'coins', price: 350 }, shape: 'box' },
  { id: 'moto', name: 'Moto urbana', color: '#ddd8cf', max: 175, accel: 48, consumption: 0.6, handling: 1.4, purchase: { kind: 'coins', price: 260 }, shape: 'bike' },
  { id: 'suv', name: 'Bruto 4×4', color: '#c2a177', max: 195, accel: 22, consumption: 1.35, handling: 0.8, purchase: { kind: 'coins', price: 850 }, shape: 'suv' },
  { id: 'kombi', name: 'Kombi 78', color: '#7ad0c8', max: 130, accel: 15, consumption: 1, handling: 0.7, purchase: { kind: 'coins', price: 220 }, shape: 'van' },
  { id: 'uno', name: 'Uno com Escada', color: '#f1efe6', max: 150, accel: 30, consumption: 0.7, handling: 1.05, purchase: { kind: 'coins', price: 120 }, shape: 'box' },
  { id: 'chevette', name: 'Chevette 82', color: '#d9573b', max: 160, accel: 32, consumption: 0.78, handling: 1.05, purchase: { kind: 'coins', price: 240 }, shape: 'box' },
  { id: 'cg125', name: 'CG 125', color: '#d33a3a', max: 130, accel: 40, consumption: 0.4, handling: 1.45, purchase: { kind: 'coins', price: 140 }, shape: 'bike' },
  { id: 'opala', name: 'Opala SS', color: '#2f6fb8', max: 215, accel: 40, consumption: 1.3, handling: 0.95, purchase: { kind: 'coins', price: 900 }, shape: 'sedan' },
  { id: 'maverick', name: 'Maverick GT', color: '#f08a24', max: 240, accel: 52, consumption: 1.45, handling: 1.05, purchase: { kind: 'coins', price: 1600 }, shape: 'muscle' },
  { id: 'fiat147', name: 'Fiat 147', color: '#e6b45b', max: 132, accel: 24, consumption: 0.68, handling: 1.02, purchase: { kind: 'coins', price: 160 }, shape: 'box' },
  { id: 'marea', name: 'Marea Turbo', color: '#527a68', max: 220, accel: 52, consumption: 1.35, handling: 1.08, purchase: { kind: 'coins', price: 2400 }, shape: 'sedan' },
  { id: 'passat', name: 'Passat 85', color: '#9b4840', max: 170, accel: 34, consumption: 0.88, handling: 1.04, purchase: { kind: 'coins', price: 480 }, shape: 'box' },
  { id: 'puma', name: 'Puma GT', color: '#e8d7a6', max: 160, accel: 31, consumption: 0.83, handling: 1.18, purchase: { kind: 'coins', price: 1200 }, shape: 'sport' },
  { id: 'gt', name: 'Veloce GT', color: '#e76368', max: 350, accel: 70, consumption: 1.2, handling: 1.15, purchase: { kind: 'coins', price: 30_000 }, shape: 'sport' },
  { id: 'superbike', name: 'Raio 1000', color: '#af94ec', max: 300, accel: 68, consumption: 1.05, handling: 1.5, purchase: { kind: 'coins', price: 20_000 }, shape: 'bike' },
];

export const PAINTS: readonly Paint[] = [
  { id: 'original', color: null, price: 0 },
  { id: 'ocean', color: '#69bddd', price: 60 },
  { id: 'cherry', color: '#e87582', price: 60 },
  { id: 'cream', color: '#e7dbb0', price: 60 },
  { id: 'night', color: '#75818c', price: 90 },
  { id: 'scarlet', color: '#c82c3c', price: 90 },
  { id: 'royal', color: '#2852b8', price: 90 },
  { id: 'forest', color: '#267052', price: 90 },
  { id: 'sunflower', color: '#efbd32', price: 90 },
  { id: 'tangerine', color: '#e77728', price: 90 },
  { id: 'violet', color: '#8545b8', price: 90 },
  { id: 'white', color: '#f1f0e8', price: 120 },
  { id: 'black', color: '#202431', price: 120 },
  { id: 'silver', color: '#b3bcc5', price: 120 },
  { id: 'turquoise', color: '#25aaa1', price: 90 },
  { id: 'rose', color: '#d94e94', price: 90 },
  { id: 'wine', color: '#772c46', price: 120 },
];

export const DEFAULT_CAR_ID = 'fusca';
export const DEFAULT_PAINT_ID = 'original';
