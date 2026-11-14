# Per-vehicle acceleration

Replaces the shared 0.25 acceleration gain from the v3 balance. Each of the nineteen models has an acceleration gain and a high-speed falloff in `src/game/vehicle-tuning.ts` (gains 0.23–0.36, falloffs 0.5–2.4).

Revision 2026-11-14: GT acceleration increases from 84 to **110**, with gain **0.36** and falloff **0.5** retained. Its 0-100 time is now **2.60 s**, down from 3.42 s. Uno com Escada is deliberately exaggerated to 400 km/h, acceleration 90, gain 0.36 and falloff 0.5: 0-100 takes **3.16 s**, below the GT's launch performance. Normal Uno keeps the former ladder Uno tuning and 15.48 s 0-100. These are arcade settings, not claims of real performance.

The existing drag curve is multiplied by an additional taper above 70% of maximum speed. Its value and slope join continuously at the threshold. Stronger falloff makes the last part of the speed range take longer, while acceleration remains positive below the maximum and zero at the maximum. Off-road traction still scales the resulting pull.

Reproduce with `node scripts/measure-acceleration.ts`. Measured with the real `Race` simulation in 20 ms steps, starting at rest, with no traffic, unlimited fuel and the car kept centered. These are game tuning values, not real-world vehicle specifications.

| Vehicle | Taper starts (km/h) | 0-100 (s) | Time to 70% (s) | Time to 90% (s) | Time to 95% (s) |
| --- | ---: | ---: | ---: | ---: | ---: |
| Fusca 76 | 108.5 | 19.06 | 21.54 | 41.60 | 59.82 |
| Brasília 80 | 115.5 | 16.66 | 20.56 | 39.18 | 55.58 |
| Gol Bolinha | 129.5 | 11.96 | 17.14 | 31.54 | 43.16 |
| Palio 98 | 126 | 13.28 | 18.36 | 34.04 | 46.92 |
| Moto urbana | 122.5 | 8.78 | 11.72 | 21.92 | 30.56 |
| Bruto 4×4 | 136.5 | 19.32 | 29.58 | 55.94 | 78.84 |
| Kombi 78 | 91 | 38.64 | 32.68 | 65.66 | 98.02 |
| Uno com Escada | 280 | 3.16 | 10.72 | 18.86 | 24.58 |
| Uno | 105 | 15.48 | 16.68 | 31.34 | 43.84 |
| Chevette 82 | 112 | 14.96 | 17.70 | 33.48 | 47.18 |
| CG 125 | 91 | 11.88 | 10.08 | 19.70 | 28.70 |
| Opala SS | 150.5 | 10.04 | 17.26 | 31.54 | 42.84 |
| Maverick GT | 168 | 7.20 | 14.04 | 25.38 | 34.06 |
| Fiat 147 | 92.4 | 23.24 | 20.30 | 39.20 | 56.38 |
| Marea Turbo | 154 | 7.16 | 12.66 | 22.78 | 30.46 |
| Passat 85 | 119 | 12.28 | 15.78 | 29.42 | 40.88 |
| Puma GT | 112 | 13.28 | 15.70 | 28.70 | 38.96 |
| Veloce GT | 245 | 2.60 | 7.66 | 13.50 | 17.60 |
| Raio 1000 | 210 | 4.94 | 12.34 | 22.06 | 29.24 |

Regression tests cover monotonic pull, continuity at the threshold, distinct initial acceleration, stronger high-speed taper in classics than sports cars, and the actual race speed gains at 70%, 85% and 95%. Existing checks retain the Fusca's gradual 0–100 pace and the GT's ability to approach 350 km/h.
