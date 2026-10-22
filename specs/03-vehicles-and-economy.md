# 03 — Vehicles, paints and economy

[Specification index](README.md) · Catalog and save validation: [engine.js](../src/engine.js)

## Complete vehicle catalog

Maximum speed is km/h; acceleration is the maximum speed increase in km/h per simulation second. Consumption and handling are dimensionless factors used by the rules in [gameplay](02-gameplay.md).

| ID | Display name | Shape | Max | Acceleration | Consumption | Handling | Resistance | Coin price |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `fusca` | Fusca 76 | bug | 155 | 26 | 0.72 | 1.00 | 1 | 0 |
| `brasilia` | Brasília 80 | box | 165 | 29 | 0.80 | 1.00 | 1 | 180 |
| `gol` | Gol Bolinha | box | 185 | 36 | 0.90 | 1.12 | 1 | 420 |
| `palio` | Palio 98 | box | 180 | 34 | 0.82 | 1.08 | 1 | 350 |
| `moto` | Moto urbana | bike | 175 | 48 | 0.60 | 1.40 | 1 | 260 |
| `gt` | Veloce GT | sport | 285 | 60 | 1.65 | 1.15 | 1 | 1200 |
| `suv` | Bruto 4×4 | suv | 195 | 22 | 1.35 | 0.80 | 2 | 850 |
| `superbike` | Raio 1000 | bike | 300 | 68 | 1.40 | 1.50 | 1 | 1500 |

Fusca is always owned. A locked vehicle can only be selected after purchasing it with available free coins. Owned vehicles can be selected again without another charge. Both motorcycle models use the smaller collision threshold and reduced rain grip. The SUV has the resistance and shoulder behavior defined in gameplay. There are no performance upgrades or stat changes from paint.

## Paint catalog

| ID | Display name | Remap color | Price |
| --- | --- | --- | ---: |
| `original` | Original de fábrica | Preserve model artwork | 0 |
| `ocean` | Azul oceano | `#69bddd` | 60 |
| `cherry` | Cereja | `#e87582` | 60 |
| `cream` | Creme vintage | `#e7dbb0` | 60 |
| `night` | Preto grafite | `#75818c` | 90 |

A paint purchase is permanent for the casual save and works on every owned vehicle. Only one paint is selected at a time. Applying an owned paint is free. Original appearance comes from the atlas; catalog/fallback colors do not force the factory artwork to be recolored. Custom paint remaps body-color pixels while retaining shading and transparency.

## Earnings and settlement

- Earn **1 free coin per 25 meters**, rounded down.
- The run counter is total coins earned in the run; the wallet is settled progress.
- Settlement credits `max(0, runCoins - alreadyPaidRunCoins)` so checkpoints and continuation cannot double-pay the same distance.
- Settle after each **5 s** simulation checkpoint, when pausing, ending, returning to the menu, changing vehicle, or leaving the page.
- Best distance is the maximum of saved record and the current settled distance.
- A second chance preserves the previous run's paid amount; only newly earned distance adds coins.
- A new run resets its own paid counter and run distance, not the wallet.

## Purchases and persistence

A purchase requires enough coins, subtracts the catalog price once, adds ownership and selects the purchased item. Unaffordable or already selected actions are disabled. Vehicle/paint ownership, selection, wallet, record and sound preference persist in the browser and can be exported or manually backed up.

The local save is editable and importable. These coins have no cash value and are not a secure commercial wallet. Premium currency, paid entitlements, receipt validation, refunds, ad rewards and removal of ads are **pending**: [ECO-01, COM-01 and ADS-01](09-roadmap.md).
