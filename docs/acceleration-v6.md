# Per-vehicle acceleration

Replaces the shared 0.25 acceleration gain from the v3 balance. Each of the eighteen models has an acceleration gain and a high-speed falloff in `src/game/vehicle-tuning.ts` (gains 0.23–0.36, falloffs 0.5–2.4).

Revision (feedback on the Veloce GT feeling slow off the line): its gain rose from 0.30 to **0.36** and its falloff from 0.6 to **0.5**. Measured with the same method, 0–100 km/h falls from 4.10 s to **3.42 s**, and the 70 % / 90 % / 95 % times are 10.0 / 17.8 / 23.0 s (previously 12.0 / 21.4 / 28.1 s). Top speed is still reached: the taper keeps acceleration positive below 350 km/h. Other cars are unchanged.

The existing drag curve is multiplied by an additional taper above 70% of maximum speed. Its value and slope join continuously at the threshold. Stronger falloff makes the last part of the speed range take longer, while acceleration remains positive below the maximum and zero at the maximum. Off-road traction still scales the resulting pull.

Measured with the real `Race` simulation in 20 ms steps, starting at rest, with no traffic, unlimited fuel and the car kept centered. These are game tuning values, not real-world vehicle specifications.

| Vehicle | Taper starts (km/h) | Time to 70% (s) | Time to 90% (s) | Time to 95% (s) |
| --- | ---: | ---: | ---: | ---: |
| Fusca 76 | 108.5 | 21.5 | 41.6 | 59.8 |
| Brasília 80 | 115.5 | 20.6 | 39.2 | 55.6 |
| Gol Bolinha | 129.5 | 17.1 | 31.5 | 43.2 |
| Palio 98 | 126 | 18.4 | 34.0 | 46.9 |
| Moto urbana | 122.5 | 11.7 | 21.9 | 30.6 |
| Bruto 4×4 | 136.5 | 29.6 | 55.9 | 78.8 |
| Kombi 78 | 91 | 32.7 | 65.7 | 98.0 |
| Uno com Escada | 105 | 16.7 | 31.3 | 43.8 |
| Chevette 82 | 112 | 17.7 | 33.5 | 47.2 |
| CG 125 | 91 | 10.1 | 19.7 | 28.7 |
| Opala SS | 150.5 | 17.3 | 31.5 | 42.8 |
| Maverick GT | 168 | 14.0 | 25.4 | 34.1 |
| Fiat 147 | 92.4 | 20.3 | 39.2 | 56.4 |
| Marea Turbo | 154 | 12.7 | 22.8 | 30.5 |
| Passat 85 | 119 | 15.8 | 29.4 | 40.9 |
| Puma GT | 112 | 15.7 | 28.7 | 39.0 |
| Veloce GT (gain 0.36, falloff 0.5) | 245 | 10.0 | 17.8 | 23.0 |
| Raio 1000 | 210 | 12.3 | 22.1 | 29.2 |

Regression tests cover monotonic pull, continuity at the threshold, distinct initial acceleration, stronger high-speed taper in classics than sports cars, and the actual race speed gains at 70%, 85% and 95%. Existing checks retain the Fusca's gradual 0–100 pace and the GT's ability to approach 350 km/h.
