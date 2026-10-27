/**
 * Real-money purchases for premium cars. The game only depends on this interface;
 * a platform billing integration (App Store, Google Play, web checkout) plugs in by
 * implementing it. Until one is configured the store reports itself unavailable.
 */
export interface CashStore {
  readonly available: boolean;
  /** Resolves true once the platform confirmed the payment for the car. */
  purchase(carId: string): Promise<boolean>;
}

export const unavailableStore: CashStore = {
  available: false,
  purchase: () => Promise.resolve(false),
};
