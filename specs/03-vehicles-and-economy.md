# 03 — Vehicles, paints and economy

[Specification index](README.md) · Catalog and save validation: [`src/game/cars.ts`](../src/game/cars.ts), [`src/game/save.ts`](../src/game/save.ts)

## Complete vehicle catalog

Maximum speed is km/h; acceleration is the base coefficient of the automatic-acceleration curve, multiplied by the vehicle's own `accelerationGain` and tapered near top speed (see [Per-vehicle tuning](#per-vehicle-tuning) and [gameplay](02-gameplay.md)). Consumption and handling are dimensionless factors used by the rules in gameplay. The garage shows maximum speed, acceleration and consumption; handling affects steering and cornering drift only.

The garage lists all cars in ascending coin price order, with no premium category. The catalog's internal order does not affect display order or saved ownership. Consumption ratings apply at idle too: a stopped running car slowly uses fuel, while pause freezes consumption.

| ID | Display name | Shape | Max | Acceleration | Consumption | Handling | How it is unlocked |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| `fusca` | Fusca 76 | bug | 155 | 26 | 0.72 | 1.00 | Owned from the start (0) |
| `brasilia` | Brasília 80 | box | 165 | 29 | 0.80 | 1.00 | 180 coins |
| `gol` | Gol Bolinha | box | 185 | 36 | 0.90 | 1.12 | 420 coins |
| `palio` | Palio 98 | box | 180 | 34 | 0.82 | 1.08 | 350 coins |
| `moto` | Moto urbana | bike | 175 | 48 | 0.60 | 1.40 | 260 coins |
| `suv` | Bruto 4×4 | suv | 195 | 22 | 1.35 | 0.80 | 850 coins |
| `kombi` | Kombi 78 | van | 130 | 15 | 1.00 | 0.70 | 220 coins |
| `uno` | Uno com Escada | box | 400 | 90 | 0.70 | 1.05 | 3200 coins |
| `uno-normal` | Uno | box | 150 | 30 | 0.70 | 1.05 | 120 coins |
| `chevette` | Chevette 82 | box | 160 | 32 | 0.78 | 1.05 | 240 coins |
| `cg125` | CG 125 | bike | 130 | 40 | 0.40 | 1.45 | 140 coins |
| `opala` | Opala SS | sedan | 215 | 40 | 1.30 | 0.95 | 900 coins |
| `maverick` | Maverick GT | muscle | 240 | 52 | 1.45 | 1.05 | 1600 coins |
| `fiat147` | Fiat 147 | box | 132 | 24 | 0.68 | 1.02 | 160 coins |
| `marea` | Marea Turbo | sedan | 220 | 52 | 1.35 | 1.08 | 2400 coins |
| `passat` | Passat 85 | box | 170 | 34 | 0.88 | 1.04 | 480 coins |
| `puma` | Puma GT | sport | 250 | 45 | 0.83 | 1.18 | 1200 coins |
| `gt` | Veloce GT | sport | 350 | 150 | 1.20 | 1.15 | 30,000 coins |
| `superbike` | Raio 1000 | bike | 300 | 68 | 1.05 | 1.50 | 20,000 coins |
| `biz125` | Biz 125 | bike | 110 | 32 | 0.35 | 1.40 | 200 coins |
| `hayabusa` | Hayabusa | bike | 370 | 105 | 1.10 | 1.35 | 24,000 coins |
| `harley` | Harley Electra Glide | bike | 165 | 42 | 1.10 | 0.90 | 6000 coins |

Hayabusa's 370 km/h maximum is a requested arcade exception, not a real-world specification. Its ID, ownership, price, base acceleration, gain/falloff, handling, consumption, size and braking remain unchanged; the final synthesized gear range extends to 370 km/h.

Puma GT uses the requested arcade maximum of 250 km/h and acceleration rating 45. Its ID, ownership, price, gain/falloff, handling, consumption, size and braking remain unchanged. These are game values rather than real-world performance claims.

The Veloce GT uses the requested acceleration 150 and gain 0.36 for a stronger initial launch; its existing high-speed taper (0.5) remains. Uno com Escada is an intentional Brazilian company-car meme exception: 400 km/h, acceleration 90, gain 0.36 and falloff 0.5, so its initial pull remains below the GT. Its existing `uno` ID and ownership are preserved; its price is 3,200 coins, above the Maverick GT, without retuning its performance. The new `uno-normal` has the former ladder Uno's 150 km/h, acceleration 30 and all other tuning/economy values, with no roof ladder. These are arcade values, not certified real specifications.

Fusca is always owned. Each car has a `purchase` field: `{ kind: 'coins', price }`. A coin vehicle can be selected after purchasing it with available free coins; owned vehicles can be selected again without another charge. Every shape in the `bike` class (Moto urbana, Raio 1000, CG 125, Biz 125, Hayabusa, Harley Electra Glide) uses the smaller collision reach and reduced rain grip. There are no performance upgrades or stat changes from paint. The old "impact speed retained" statistic no longer exists: every contact is a crash.

### Per-vehicle tuning

`src/game/vehicle-tuning.ts` adds four values per car. Gain scales the catalog acceleration into km/h per second at low speed; falloff is the extra loss of pull above 70% of top speed (`1 / (1 + falloff × ((ratio − 0.7) / 0.3)²)`); width is the visual and collision width relative to a compact car; braking is the dry-road deceleration in km/h per second. Measured acceleration times are in [acceleration-v6.md](../docs/acceleration-v6.md).

| ID | Gain | Falloff | Width | Braking |
| --- | ---: | ---: | ---: | ---: |
| `fusca` | 0.24 | 1.8 | 0.90 | 34 |
| `brasilia` | 0.24 | 1.6 | 1.02 | 36 |
| `gol` | 0.26 | 1.1 | 0.98 | 46 |
| `palio` | 0.25 | 1.2 | 0.98 | 44 |
| `moto` | 0.27 | 1.35 | 0.56 | 48 |
| `suv` | 0.26 | 1.5 | 1.10 | 39 |
| `kombi` | 0.23 | 2.4 | 1.30 | 29 |
| `uno` | 0.36 | 0.5 | 0.94 | 38 |
| `uno-normal` | 0.26 | 1.4 | 0.94 | 38 |
| `chevette` | 0.245 | 1.5 | 1.03 | 35 |
| `cg125` | 0.28 | 2.0 | 0.52 | 42 |
| `opala` | 0.27 | 1.0 | 1.16 | 41 |
| `maverick` | 0.285 | 0.85 | 1.20 | 45 |
| `fiat147` | 0.235 | 1.8 | 0.88 | 34 |
| `marea` | 0.29 | 0.8 | 1.02 | 53 |
| `passat` | 0.275 | 1.3 | 0.94 | 40 |
| `puma` | 0.285 | 1.0 | 0.95 | 43 |
| `gt` | 0.36 | 0.5 | 1.18 | 70 |
| `superbike` | 0.31 | 0.7 | 0.60 | 64 |
| `biz125` | 0.27 | 1.8 | 0.50 | 40 |
| `hayabusa` | 0.35 | 0.65 | 0.66 | 68 |
| `harley` | 0.28 | 1.7 | 0.84 | 40 |

### Art

Harley Electra Glide represents a 1977 FLH 1200 Shovelhead touring motorcycle. Its larger body, hard saddlebags, chrome and upright rider distinguish it from the other bikes. Speed, acceleration, price and synthesized RPM/gear thresholds are arcade approximations, not certified real specifications. It uses authored straight/mild/strong poses, custom paint and brake feedback while preserving every existing saved vehicle ID. [Model references, art prompt and review](../docs/harley-v1.md).

Biz 125 and Hayabusa use the six-pose transparent `vehicle-motorcycles-v1.png` sheet. Model/year/engine references, arcade choices, full generation prompt and review limits are in [motorcycle notes](../docs/motorcycles-v1.md).

All twenty-two cars use authored straight, mild-turn and strong-turn sprites. Fiat 147, Marea Turbo, Passat 85 and Puma GT use vehicle-brazilian-v1.png with authored straight, gentle-turn and strong-turn views, paint and brake-light support; see [refinement notes](../docs/brazilian-cars-v1.md). The original eight use vehicle-atlas-v1.png and vehicle-turns-v2.png; Kombi 78, Uno com Escada, Chevette 82, CG 125, Opala SS and Maverick GT use vehicle-classics-v2.png. Normal Uno uses `vehicle-uno-v1.png`, with provenance and a pose contact sheet in [Uno notes](../docs/uno-v1.md). Their procedural art remains an asset-loading fallback; see [art and audio](05-art-and-audio.md).

## Paint catalog

| ID | Display name | Remap color | Price |
| --- | --- | --- | ---: |
| `original` | Original de fábrica | Preserve model artwork | 0 |
| `ocean` | Azul oceano | `#69bddd` | 60 |
| `cherry` | Cereja | `#e87582` | 60 |
| `cream` | Creme vintage | `#e7dbb0` | 60 |
| `night` | Preto grafite | `#75818c` | 90 |
| `scarlet` | Vermelho escarlate | `#c82c3c` | 90 |
| `royal` | Azul royal | `#2852b8` | 90 |
| `forest` | Verde floresta | `#267052` | 90 |
| `sunflower` | Amarelo girassol | `#efbd32` | 90 |
| `tangerine` | Laranja tangerina | `#e77728` | 90 |
| `violet` | Roxo violeta | `#8545b8` | 90 |
| `white` | Branco marfim | `#f1f0e8` | 120 |
| `black` | Preto obsidiana | `#202431` | 120 |
| `silver` | Prata metálico | `#b3bcc5` | 120 |
| `turquoise` | Verde turquesa | `#25aaa1` | 90 |
| `rose` | Rosa intenso | `#d94e94` | 90 |
| `wine` | Vinho clássico | `#772c46` | 120 |

A paint purchase is permanent for the casual save and works on every owned vehicle. Only one paint is selected at a time. Applying an owned paint is free. Original appearance comes from the atlas (or the procedural livery); catalog colors do not force the factory artwork to be recolored. Custom paint remaps body-color pixels while retaining shading and transparency.

## Earnings and settlement

- Coins come from **score**: **1 coin per 25 points**, rounded down (`race.coins = floor(score / 25)`). Score itself is metres × a pace multiplier (average km/h of the current kilometre ÷ 120, clamped to 0.2–3, reset at each checkpoint); see [gameplay](02-gameplay.md). Driving fast therefore pays more coins per kilometre.
- The run counter is total coins earned in the run; the wallet is settled progress.
- Settlement credits `max(0, runCoins - alreadyPaidRunCoins)` so checkpoints and continuation cannot double-pay.
- Settle every **5 s** of running simulation, when pausing, ending, returning to the menu, changing vehicle, or leaving the page.
- Best distance (`best`, metres) and best score (`bestScore`, integer points) are the maximum of the saved record and the current run; the game-over screen shows the best score.
- A second chance preserves the previous run's paid amount; only newly earned score adds coins.
- A new run resets its own paid counter and run score, not the wallet.

## Purchases and persistence

A coin purchase requires enough coins, subtracts the catalog price once, adds ownership and selects the purchased item. Unaffordable or already selected actions are disabled. Vehicle/paint ownership, selection, wallet, distance and score records, sound preference, language and units persist in the browser (the save also carries the pilot name, player GUID, tutorial flag and timestamps; see [architecture](06-architecture-and-data.md)). They can be exported/imported as a file and, for signed-in players, are synchronized to the account's cloud progress.

The local save is editable and importable. These coins have no cash value and are not a secure commercial wallet. Verified payments, entitlements, receipt validation, refunds, ad rewards and removal of ads are **pending**: [ECO-01, COM-01 and ADS-01](09-roadmap.md).

## Paid continuation and coin shop

A second chance costs **1,000 coins**, available at most once per run. The balance is checked and debited before continuation; a failed or repeated request costs nothing. Main-menu **Buy coins** is available only to signed-in players; a guest sees a notice that an account is needed and no packs. For a signed-in player it is an unavailable placeholder: a dialog lists packs of 1,000, 3,000 and 7,500 coins at R$ 9.90, R$ 24.90 and R$ 49.90 with disabled "coming soon" buttons. Real-money purchases remain pending a provider and verified server-side credit delivery (ECO-01, COM-01). See [balance tuning](../docs/vehicle-balance-v3.md).

## Vehicle maintenance contract

Use [pista-vehicles](../.agents/skills/pista-vehicles/SKILL.md) for additions and existing-car tuning. Identify the exact model/year/engine before researching manufacturer specifications and engine references. Record source URLs, measured game acceleration, and deliberate arcade exceptions separately. New artwork must match the established fleet and include straight, mild and strong turn poses, mirrored left views, paint and brake support, plus a contact sheet for review. Preserve saved IDs when tuning existing cars.
