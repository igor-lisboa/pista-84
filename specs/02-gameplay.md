# 02 — Gameplay rules and simulation

[Specification index](README.md) · Implementation: [`src/game/`](../src/game/) (`race.ts`, `traffic.ts`, `road.ts`, `scoring.ts`, `environment.ts`)

## States and run lifecycle

| State | Behavior | Available transition |
| --- | --- | --- |
| `ready` | Menu and animated scenery; no race simulation | Start → `running` |
| `running` | Movement, fuel, distance, score, spawning and collisions update | Pause → `paused`; crash or empty tank → `over` |
| `paused` | Simulation freezes and controls clear | Continue → `running`; menu/car change → `ready` |
| `over` | Result overlay; run rewards settled | Restart → new `running`; 1,000-coin second chance → same `running`; menu → `ready` |

The interface view (`menu`, `race`, `overlay`, or phone controller) is distinct from the simulation state. Opening a modal during a run pauses it. Closing that modal does not silently resume the race. Changing a vehicle settles the previous run and resets it. Changing paint updates appearance without resetting the run.

**Demo run.** The first run started after the tutorial (`tutorialDone` true, `demoUsed` false) uses the **Veloce GT** (`DEMO_CAR_ID`, original colours) instead of the selected car, whether or not it is owned. The demo ends at its first game over (crash or empty tank): `demoUsed` is set then, and a second chance taken afterwards continues that same run with the Veloce GT. Every later run uses the selected car, which is the Fusca 76 for a new player. Quitting to the menu before ending the run keeps the demo for the next start. Saves that predate the field count as demo-used when their tutorial was already done, so upgrading never changes a player's car. The demo is not added to the garage and grants no ownership.

A fresh run starts with **0 km/h**, **100 fuel**, **0 distance/time/score/coins**, centered steering and no crashes. `Race.start()` seeds up to **3** opening traffic cars (`OPENING_TRAFFIC`) at depth 0.4–0.9, each only if its lane is clear, so the road is never empty while the car gathers speed. `Race.endReason` is `'fuel' | 'traffic' | 'wall'`; the last two are crashes. Only progress is saved; the active run is not restored after reload.

## Timing and movement

`requestAnimationFrame` drives rendering. Simulation delta is clamped to **0–0.05 seconds**; paused or background time is not caught up later. Timers below refer to simulation time, not wall time while the page is hidden.

```text
speedRatio = clamp(speed / vehicle.max, 0, 1)
traction = offRoad ? 0.1 : 1
highSpeedProgress = max(0, (speedRatio - 0.7) / 0.3)
taper = 1 / (1 + vehicleTuning.accelerationFalloff * highSpeedProgress^2)
acceleration = vehicle.accel * vehicleTuning.accelerationGain * (1 - speedRatio^2) * taper * traction
force = brake ? -vehicleBrakingRate * brakingGrip
      : accelerate ? acceleration
      : -(12 + speed * 0.025)
speed = clamp(speed + force * dt, 0, vehicle.max)

metres = speed / 3.6 * dt
distance += metres
score += metres * paceMultiplier(kmMetres, kmTime)   // see Score and checkpoints
runCoins = floor(score / 25)
```

Each of the eighteen vehicles has a separately tuned acceleration gain, high-speed falloff, visual width and braking rate in `src/game/vehicle-tuning.ts` (see [vehicles and economy](03-vehicles-and-economy.md)). Extra taper begins smoothly at 70% of its maximum speed, without an abrupt change in acceleration. Classic/heavy cars lose more pull near their limit than sports cars. See [acceleration tuning](../docs/acceleration-v6.md) for measured simulation times.

Lateral position `x` uses normalized road half-widths. Five traffic lanes use indices **-2, -1, 0, 1, 2**, width **0.372**, and centers **-0.744, -0.372, 0, 0.372, 0.744**. Four dashed dividers separate them between the solid road edges. Vehicle sprites, lateral authority, drift and collision widths scale by **0.6** to preserve lane-change proportions. Combined keyboard, touch, tilt and remote input clamps to **[-1, 1]**. Steering follows input exponentially (`1 - exp(-22 * dt)`) and returns smoothly to neutral. Lateral authority is `(1.35 - 0.25 * speedRatio) * clamp(speed / 90, 0, 1) * handling * grip * VEHICLE_SCALE`. Steering has no lateral authority when stopped. Releasing throttle coasts; braking has priority over simultaneous acceleration and can stop the car without ending the run.

Rain scales steering grip by `1 - rain * 0.22` for motorcycles and `1 - rain * 0.10` for other vehicles. Braking grip is `1 - rain * 0.25` for motorcycles and `1 - rain * 0.15` for other vehicles. Dry-road braking rates per vehicle are in `src/game/vehicle-tuning.ts`.

## Off-road (grass)

The shoulder starts at `abs(x) > 0.96` (`EDGE`). While on the grass the engine has only **10%** traction and the speed is dragged exponentially toward **40 km/h** (`OFFROAD_LIMIT`): `speed = 40 + (speed - 40) * exp(-5.5 * dt)`, so most of the excess is shed within about 0.5–0.7 s. A speed already at or below 40 km/h is left alone, the grass never raises a stopped car's speed, and braking on the shoulder still reaches a standstill without ending the run.

The grass is never a free emergency brake. Each time the car enters it, one excursion is charged (a **1.5 s** cooldown stops a car riding the edge from being billed every frame):

- **15** fuel (percent of a tank) is removed immediately (`OFFROAD_ENTRY_FUEL`); the `fuelPenalty` event shows it in red.
- The score multiplier factor drops by **0.25** (`OFFROAD_SCORE_PENALTY`), never below **0.25** (`MIN_SCORE_FACTOR`). The factor multiplies the pace multiplier and returns to 1 at the next checkpoint.
- While the car stays on the grass it burns an extra **3** fuel per second (`OFFROAD_FUEL_BURN`).

An `offroad` event fires once each time the car enters the grass (feedback text, thud sound and a screen shake); the HUD checkpoint label shows an off-road warning while it lasts, and the renderer adds dust and a constant rumble.

## Crashes

There is no health, speed-loss bounce or speed threshold. **Any contact with traffic, or reaching the barrier at `abs(x) >= 1.35` (`WALL`), is a fatal crash** unless the car is still invincible after a second chance. On a crash the speed becomes 0, `crashSpeed` records the speed at impact, the `hit` and `crash` events fire and the run ends with `endReason` `'traffic'` or `'wall'`. At the barrier the car is also placed back at `abs(x) = 1.19`.

## Curves and difficulty

Each race gets a new 32-bit road seed. Stateless generation combines that seed with the distance section, so physics, rendering and curve hints always sample the same road, regardless of query order. Pause and second chance preserve the seed. Restart selects a new seed. There is no fixed track table or accumulating segment list.

Every **1600 m** section randomly selects a left bend, right bend or entirely straight stretch (**41%, 41%, 18%**). A bend has **240–500 m** of leading straight (at least **420 m** at the start of a run), **180–240 m** entry, **200–360 m** sustained curve, and **180–240 m** exit; the remainder is straight. Bend magnitude varies from **0.32 to 0.64**. Entries and exits use `t*t*t*(t*(6*t - 15) + 10)` and return to zero before section boundaries. Traffic frequency and pace increase with elapsed simulation time; curvature stays moderate.

Road path advances in metres at the same rate as distance. Curvature at the player plane creates outward drift:

```text
load = clamp((speed / 120)^2, 0, 6)
drift = roadBend(path + PATH_UNIT * PLAYER_DEPTH, roadSeed)
        * load * 0.9 * VEHICLE_SCALE / sqrt(handling) / grip
x += (smoothedSteer * steeringAuthority - drift) * dt
```

The renderer integrates upcoming curvature using midpoint curvature and trapezoidal heading integration, follows 40% of lateral player movement with the camera, and shares one depth projection with scenery and traffic: `screenT = (1 - z) / (1 + 4z)`. Player screen depth is **0.855**, corresponding to `PLAYER_DEPTH ~= 0.0328`. `PATH_UNIT = 104 m`. Steering selects authored straight, mild-turn or strong-turn sprites for all eighteen vehicles, with left turns mirrored. The 960 x 720 camera is uniformly fitted on every screen shape, retaining the same road visibility and vehicle proportions. Body geometry is never sheared, sliced or rotated to imitate yaw. Lane dashes are 3 m long with 3 m gaps (a 6 m cycle, half the earlier 12 m), so lane markings pass twice as often at any speed; this is paint only and changes no physics, curve or traffic position. Kerbs alternate every 4 m, and ground bands alternate every 7 m. All road paint samples `path + screenToDepth(t) * PATH_UNIT`; its motion follows simulated distance and freezes at rest. Scene effects use simulation time and heading follows distance travelled, so pausing freezes the scene. Continuous roadside barriers sit at the same normalized wall position as physics.

## Fuel

- Capacity: **100**; fuel cannot become negative or exceed capacity.
- Continuous drain per second: `vehicle.consumption × (0.04 + 0.41 × clamp(speed / 40, 0, 1) + speed / 300)`, plus **3** per second while on the grass. At rest the engine consumes `0.04 × consumption` tank percentage points per second (CG 125: 0.96% per minute; Fusca: 1.728%; Maverick: 3.48%). This rises smoothly to the driving rate by 40 km/h. Only a running race burns fuel; pause, menus and game over freeze it.
- Pickup: red gas-pump symbol with a white meter, black hose/nozzle and amber glow, adding **12** fuel up to the cap (`FUEL_PICKUP`).
- First canister spawns after **8 s**; following canisters spawn every **12–17 s**, in any lane.
- Each 1000 m checkpoint adds **4** fuel (`CHECKPOINT_FUEL`).
- Empty fuel immediately ends the run (`endReason` `'fuel'`) with a dry-tank/rear-traffic message.

## Score and checkpoints

- Score pays **per metre**, scaled by the pace of the kilometre being driven: `pace = clamp(averageKmh / 120, 0.2, 3)`, where `averageKmh = kmMetres / kmTime * 3.6` over the current kilometre. An average of 120 km/h pays 1 point per metre, a crawl pays down to 0.2, and a flat-out kilometre up to 3. The score multiplier is `pace × scoreFactor`, where `scoreFactor` (1 normally) is lowered by grass excursions (see Off-road).
- Every **1000 m** (`CHECKPOINT`) is a checkpoint: it adds fuel, fires a `checkpoint` event and **resets `kmTime`, `kmMetres` and the grass `scoreFactor`**, so the next kilometre starts a fresh average with no penalty.
- **Coins** are earned from score, not directly from distance: `race.coins = floor(score / 25)`. See [vehicles and economy](03-vehicles-and-economy.md) for settlement.
- The HUD shows points and the live multiplier (`×1.0`); every game-over screen shows points, distance, coins and the saved best score (`bestScore`), plus the score-to-coins conversion and the shared rate of **25 points = 1 coin**, rounded down to whole coins. The result panel scrolls on short screens so its conversion and actions remain reachable.

## Traffic and entity movement

Traffic ramps with `intensity = clamp(time / 120, 0, 1)` (`TRAFFIC_RAMP = 120` s of active play); it freezes while paused.

After the ramp is full, **late-game pressure** `clamp((time - 120) / 240, 0, 1)` keeps building for four more minutes and then stops (hard cap): the spawn interval shortens by up to `0.15` s, up to **4** extra cars are allowed (`MAX_TRAFFIC + 4 = 20`), and drivers reconsider lane changes up to 40 % sooner. Traffic speeds stop at their intensity-1 values, because faster traffic lowers the closing speed and makes dodging easier.

- First traffic wave: **0.6 s** after starting (on top of the opening cars).
- Subsequent interval: `1.1 - 0.7 * intensity - 0.15 * pressure + random * 0.3` seconds (1.1–1.4 s at the start, 0.4–0.7 s at full intensity, 0.25–0.55 s at full pressure).
- A wave has **1** car in a random lane; with probability `0.35 + 0.55 * intensity` a second car in a different lane; and, when `intensity > 0.4`, with probability `0.55 * intensity` a third car in another free lane. At most three lanes are used, so at least two of the five stay open. A car is added only if its lane is clear at the spawn point. At most **16** traffic cars exist at once (`MAX_TRAFFIC`); a wave adds nothing when the cap for the current pressure is reached.
- Traffic uses the complete eighteen-vehicle catalog for its looks. Each spawn independently picks a body color from the ten-color `TRAFFIC_PAINTS` palette, applied to a copy of the model so factory/garage colors and performance stay unchanged. Paint remains fixed for that entity and works with straight and turning frames. Fuel canisters can spawn in any lane.
- Spawn depth `z = 1.1`. Traffic has an independent world speed. A persistent random cruise preference sets its target to `playerMax * (0.34 + 0.16*intensity + cruise*(0.18 + 0.14*intensity))`, capped at 85% of the traffic vehicle maximum. This stays at or below 82% of the player vehicle maximum. Existing cars approach their updated target at up to 3 km/h/s. Its depth changes by `(trafficSpeed - playerSpeed) / 3.6 * dt / PATH_UNIT`; pickups use traffic speed zero. Braking lets traffic pull away rather than freezing it.
- **Lane changes:** a car reconsiders its lane every 2.5–7 s (the first time after 1.5–5.5 s) and, unless blocked, skips about 20% of those considerations; a car whose leader is less than 0.26 depth ahead and more than 4 km/h slower is blocked and considers a change at once (after a 2 s cooldown). It moves to an adjacent lane at 0.9 lanes/s, only into a clear gap, never while it is within **0.14 depth** of the player's plane, and never into a lane within 1.3 lane widths of the player while it is nearer than 0.6 depth.
- **Following:** a car behind another car in an overlapping lane is limited to the leader's speed scaled by `clamp((gap - 0.05) / 0.1, 0, 1)`: it starts matching speed when the gap closes to 0.15 depth and brakes (up to 60 km/h/s) toward a standstill at 0.05.
- **Separation:** a final hard pass keeps cars in overlapping lanes at least **0.03 depth** apart and caps the follower's speed to its leader's, so traffic never overlaps.
- Entities are removed below `z = -0.15` or beyond `z = 1.5`; collected fuel disappears immediately.

## Collision, pickups and game over

Contact testing occurs when an unpassed entity crosses the player contact band **PLAYER_DEPTH +/- 0.018**, using its previous and current depth to avoid skipping a contact. A hit requires `abs(player.x - laneCenter(entity.lane))` below the player's reach: `0.19 × width` for a motorcycle or `0.162 × width` for other vehicles, where `width` is the vehicle's tuned visual width (for example 0.9 for the Fusca, 0.56 for the Moto urbana). An entity is marked passed after its first contact so it cannot repeatedly refuel or crash the player.

- A fuel canister adds **12** fuel up to 100 and disappears.
- Traffic contact is a fatal crash at any speed (see Crashes). The result screen is titled **"VOCÊ BATEU!"** ("YOU CRASHED!", localized), the reason line shows the crash speed, and the one 1,000-coin second chance is still offered.
- While the 3 s second-chance invincibility lasts, traffic and barrier contacts do not end the run (the barrier still places the car back on the road).
- Stopping does not end a run. **Running out of fuel** ends it (`'fuel'`, "Pane seca!" message) and also offers the second chance.
- Traffic changes lanes and follows the car ahead, so a gap that looks open can close; no speed makes touching a car safe.

## Second chance

Exactly **one continuation per run** (`Race.continued`), after any ending, costing **1,000 coins** (`SECOND_CHANCE_PRICE`). `Race.resume(wallet)` returns false, and debits nothing, unless the run is over, the allowance is unused and the wallet holds at least 1,000 coins. It preserves distance, score, elapsed simulation time and earned coins; clears entities; sets speed to **90 km/h**; raises fuel to at least **45**; moves the car back to at most `abs(x) = 0.6`; and grants **3 s** of invincibility. It does not require or simulate watching an ad (rewarded ads are pending ADS-01). Starting a new run resets this allowance.

## Light and weather

Every run starts at the **player's local time of day** and rolls its own weather. `rollConditions(clock(), random)` returns `{cycleOffset, weather[]}`: the local hour maps onto the repeating 180-second cycle (dawn from 05:30, day from 07:00, sunset from 17:30, night from 19:00), so a run started at 21:00 begins at night and one at 18:00 at sunset. `Race.start()` keeps the weather the menu preview was showing but reads the clock again for the light.

| Light phase | Position in repeating 180-second cycle | Local start hour |
| --- | --- | --- |
| Day | 0–65 s | 07:00 |
| Sunset | 65–95 s | 17:30 |
| Night | 95–155 s | 19:00 |
| Dawn | 155–180 s | 05:30 |

Run time advances the cycle from `cycleOffset`. The final **10 s** of each phase smoothly interpolate into the next palette with `u²(3−2u)`; night level is 0 (day), 0.15 (sunset), 1 (night) and 0.35 (dawn), blended the same way.

Weather changes every **38 s** along a plan of **12** randomly rolled phases (50% clear, 25% rain, 25% fog; any phase, including the first, can be rain or fog), which repeats once a run outlasts it (about eight minutes). Intensity blends over **5 s** from the previous phase; the opening phase has nothing to blend from. `CALM_CONDITIONS` (daylight, all clear) serves menu previews and deterministic tests. In code the names are `day | sunset | night | dawn` and `clear | rain | fog` (`environment(time, conditions)` in `src/game/environment.ts`).

Rain changes road color, adds particles and reduces grip and braking. Fog obscures the road. Night changes light intensity and adds headlights/taillight effects. Environment state is communicated through the scene rather than another HUD panel.

## Focus and interruption

Hiding the page pauses a running game and clears input. Desktop blur also pauses; coarse-pointer devices do not pause on blur alone because Safari browser chrome can trigger it. Remote signal loss clears remote input and pauses. These rules must prevent stuck acceleration or braking.

## Reference and scope

The accelerator/brake/steering control model follows the original [Top Gear / Top Racer instruction manual](https://www.retrogames.cz/manualy/SNES/Top_Gear_-_SNES_-_Manual.pdf). Acceleration, grip, off-road and score constants here are independently tuned for this game's vehicles and five-lane endless road; they are not extracted or verified original-game physics values.

Vehicle sizes, individual braking rates, audio mix, fog and paid continuation: [vehicle-balance-v3.md](../docs/vehicle-balance-v3.md).
