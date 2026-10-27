# 03 — Vehicles, paints and economy

[Specification index](README.md) · Catalog and save validation: [`src/game/cars.ts`](../src/game/cars.ts), [`src/game/save.ts`](../src/game/save.ts) · Premium store interface: [`src/ui/store.ts`](../src/ui/store.ts)

## Complete vehicle catalog

Maximum speed is km/h; acceleration is the base coefficient for the tapered automatic-acceleration curve (multiplied by 2.2 in the simulation). Consumption and handling are dimensionless factors used by the rules in [gameplay](02-gameplay.md). The garage shows maximum speed, acceleration and consumption; handling affects steering and cornering drift only.

| ID | Display name | Shape | Max | Acceleration | Consumption | Handling | How it is unlocked |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| `fusca` | Fusca 76 | bug | 155 | 26 | 0.72 | 1.00 | Owned from the start (0) |
| `brasilia` | Brasília 80 | box | 165 | 29 | 0.80 | 1.00 | 180 coins |
| `gol` | Gol Bolinha | box | 185 | 36 | 0.90 | 1.12 | 420 coins |
| `palio` | Palio 98 | box | 180 | 34 | 0.82 | 1.08 | 350 coins |
| `moto` | Moto urbana | bike | 175 | 48 | 0.60 | 1.40 | 260 coins |
| `gt` | Veloce GT | sport | 350 | 64 | 1.65 | 1.15 | **PREMIUM:** R$ 29,90 |
| `suv` | Bruto 4×4 | suv | 195 | 22 | 1.35 | 0.80 | 850 coins |
| `superbike` | Raio 1000 | bike | 300 | 68 | 1.40 | 1.50 | **PREMIUM:** R$ 19,90 |
| `kombi` | Kombi 78 | van | 130 | 15 | 1.00 | 0.70 | 220 coins |
| `uno` | Uno com Escada | box | 150 | 30 | 0.70 | 1.05 | 120 coins |
| `chevette` | Chevette 82 | box | 160 | 32 | 0.78 | 1.05 | 240 coins |
| `cg125` | CG 125 | bike | 130 | 40 | 0.40 | 1.45 | 140 coins |
| `opala` | Opala SS | sedan | 215 | 40 | 1.50 | 0.95 | 900 coins |
| `maverick` | Maverick GT | muscle | 240 | 52 | 1.70 | 1.05 | 1600 coins |

Fusca is always owned. Each car has a `purchase` field: `{ kind: 'coins', price }` or `{ kind: 'cash', price, currency: 'BRL' }`. A coin vehicle can be selected after purchasing it with available free coins; owned vehicles can be selected again without another charge. Every shape in the `bike` class (Moto urbana, Raio 1000, CG 125) uses the smaller collision reach and reduced rain grip. There are no performance upgrades or stat changes from paint. The old "impact speed retained" statistic no longer exists: every contact is a crash.

### Premium cars and `CashStore`

The two PREMIUM cars (Veloce GT and Raio 1000) can **only** be bought with real money; coins never unlock them and their garage card shows the BRL price and a PREMIUM tag. Purchases go through the `CashStore` interface (`available` flag and `purchase(carId): Promise<boolean>`). **No payment provider is wired yet:** the default `unavailableStore` reports `available: false`, so choosing "COMPRAR" ("BUY") only shows a toast saying that real-money purchases are not available on this device, and nothing is granted. A billing integration (web checkout, Google Play, App Store) must implement `CashStore` and be injected in `GameApp`; server-side entitlements and receipt validation remain pending ([ECO-01 and COM-01](09-roadmap.md)). Because ownership is only a list of ids in the editable local save, a hand-edited or imported save can already contain a premium car; this is not protection against that.

### Art

The first eight cars use the authored atlas (with mild and strong turn frames). The six newer cars (Kombi 78, Uno com Escada, Chevette 82, CG 125, Opala SS, Maverick GT) have no atlas art and are drawn by procedural pixel sprites in `src/render/sprites.ts`; see [art and audio](05-art-and-audio.md).

## Paint catalog

| ID | Display name | Remap color | Price |
| --- | --- | --- | ---: |
| `original` | Original de fábrica | Preserve model artwork | 0 |
| `ocean` | Azul oceano | `#69bddd` | 60 |
| `cherry` | Cereja | `#e87582` | 60 |
| `cream` | Creme vintage | `#e7dbb0` | 60 |
| `night` | Preto grafite | `#75818c` | 90 |

A paint purchase is permanent for the casual save and works on every owned vehicle. Only one paint is selected at a time. Applying an owned paint is free. Original appearance comes from the atlas (or the procedural livery); catalog colors do not force the factory artwork to be recolored. Custom paint remaps body-color pixels while retaining shading and transparency.

## Earnings and settlement

- Coins come from **score**: **1 coin per 25 points**, rounded down (`race.coins = floor(score / 25)`). Score itself is metres × a pace multiplier (average km/h of the current kilometre ÷ 100, clamped to 0.2–3.5, reset at each checkpoint); see [gameplay](02-gameplay.md). Driving fast therefore pays more coins per kilometre.
- The run counter is total coins earned in the run; the wallet is settled progress.
- Settlement credits `max(0, runCoins - alreadyPaidRunCoins)` so checkpoints and continuation cannot double-pay.
- Settle every **5 s** of running simulation, when pausing, ending, returning to the menu, changing vehicle, or leaving the page.
- Best distance (`best`, metres) and best score (`bestScore`, integer points) are the maximum of the saved record and the current run; the game-over screen shows the best score.
- A second chance preserves the previous run's paid amount; only newly earned score adds coins.
- A new run resets its own paid counter and run score, not the wallet.

## Purchases and persistence

A coin purchase requires enough coins, subtracts the catalog price once, adds ownership and selects the purchased item. Unaffordable or already selected actions are disabled. Vehicle/paint ownership, selection, wallet, distance and score records, sound preference and language persist in the browser and can be exported or manually backed up.

The local save is editable and importable. These coins have no cash value and are not a secure commercial wallet. Verified payments, entitlements, receipt validation, refunds, ad rewards and removal of ads are **pending**: [ECO-01, COM-01 and ADS-01](09-roadmap.md).
