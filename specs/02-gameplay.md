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

A fresh run starts with **0 km/h**, **100 fuel**, **0 distance/time/score/coins**, centered steering, no traffic, and no crashes. `Race.endReason` is `'fuel' | 'traffic' | 'wall'`; the last two are crashes. Only progress is saved; the active run is not restored after reload.

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

Each vehicle has a separately tuned acceleration gain and high-speed falloff in `src/game/vehicle-tuning.ts`. Extra taper begins smoothly at 70% of its maximum speed, without an abrupt change in acceleration. Classic/heavy cars lose more pull near their limit than sports cars. See [acceleration tuning](../docs/acceleration-v6.md) for measured simulation times.

Lateral position `x` uses normalized road half-widths. Five traffic lanes use indices **-2, -1, 0, 1, 2**, width **0.372**, and centers **-0.744, -0.372, 0, 0.372, 0.744**. Four dashed dividers separate them between the solid road edges. Vehicle sprites, lateral authority, drift and collision widths scale by **0.6** to preserve lane-change proportions. Combined keyboard, touch, tilt and remote input clamps to **[-1, 1]**. Steering follows input exponentially (`1 - exp(-22 * dt)`) and returns smoothly to neutral. Lateral authority is `(1.35 - 0.25 * speedRatio) * clamp(speed / 90, 0, 1) * handling * grip * VEHICLE_SCALE`. Steering has no lateral authority when stopped. Releasing throttle coasts; braking has priority over simultaneous acceleration and can stop the car without ending the run.

Rain grip is `1 - rainIntensity * 0.22` for motorcycles and `1 - rainIntensity * 0.10` for other vehicles.

## Off-road (grass)

The shoulder starts at `abs(x) > 0.96` (`EDGE`). While on the grass the engine has only **10%** traction and the speed is dragged exponentially toward **40 km/h** (`OFFROAD_LIMIT`): `speed = 40 + (speed - 40) * exp(-5.5 * dt)`, so most of the excess is shed within about 0.5–0.7 s. A speed already at or below 40 km/h is left alone, the grass never raises a stopped car's speed, and braking on the shoulder still reaches a standstill without ending the run. An `offroad` event fires once each time the car enters the grass (feedback text, thud sound and a screen shake); the HUD checkpoint label shows an off-road warning while it lasts, and the renderer adds dust and a constant rumble.

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

The renderer integrates upcoming curvature using midpoint curvature and trapezoidal heading integration, follows 40% of lateral player movement with the camera, and shares one depth projection with scenery and traffic: `screenT = (1 - z) / (1 + 4z)`. Player screen depth is **0.855**, corresponding to `PLAYER_DEPTH ~= 0.0328`. `PATH_UNIT = 104 m`. Steering selects authored straight, mild-turn or strong-turn sprites for all fourteen vehicles, with left turns mirrored. The 960 x 720 camera is uniformly fitted on every screen shape, retaining the same road visibility and vehicle proportions. Body geometry is never sheared, sliced or rotated to imitate yaw. Road dashes are 6 m long with 6 m gaps, kerbs alternate every 4 m, and ground bands alternate every 7 m. All road paint samples `path + screenToDepth(t) * PATH_UNIT`; its motion follows simulated distance and freezes at rest. Scene effects use simulation time and heading follows distance travelled, so pausing freezes the scene. Continuous roadside barriers sit at the same normalized wall position as physics.

## Fuel

- Capacity: **100**; fuel cannot become negative or exceed capacity.
- Continuous drain per second: `vehicle.consumption × (0.04 + 0.41 × clamp(speed / 40, 0, 1) + speed / 190)`. At rest the engine consumes `0.04 × consumption` tank percentage points per second (CG 125: 0.96% per minute; Fusca: 1.728%; Maverick: 4.08%). This rises smoothly to the previous driving rate by 40 km/h. Only a running race burns fuel; pause, menus and game over freeze it.
- Pickup: red gas-pump symbol with a white meter, black hose/nozzle and amber glow, adding **12** fuel up to the cap.
- First canister spawns after **8 s**; following canisters spawn every **12–17 s**.
- Each 1000 m checkpoint adds **4** fuel.
- Empty fuel immediately ends the run (`endReason` `'fuel'`) with a dry-tank/rear-traffic message.

## Score and checkpoints

- Score pays **per metre**, scaled by the pace of the kilometre being driven: `multiplier = clamp(averageKmh / 120, 0.2, 3)`, where `averageKmh = kmMetres / kmTime * 3.6` over the current kilometre. An average of 120 km/h pays 1 point per metre, a crawl pays down to 0.2, and a flat-out kilometre up to 3.
- Every **1000 m** (`CHECKPOINT`) is a checkpoint: it adds fuel, fires a `checkpoint` event and **resets `kmTime` and `kmMetres`**, so the next kilometre starts a fresh average.
- **Coins** are earned from score, not directly from distance: `race.coins = floor(score / 25)`. See [vehicles and economy](03-vehicles-and-economy.md) for settlement.
- The HUD shows points and the live multiplier (`×1.0`); every game-over screen shows points, distance, coins and the saved best score (`bestScore`), plus the score-to-coins conversion and the shared rate of **25 points = 1 coin**, rounded down to whole coins. The result panel scrolls on short screens so its conversion and actions remain reachable.

## Traffic and entity movement

Traffic ramps with `intensity = clamp(time / 120, 0, 1)` (`TRAFFIC_RAMP = 120` s of active play); it freezes while paused.

- First traffic wave: **1.6 s** after starting.
- Subsequent interval: `1.5 - 0.95 * intensity + random * 0.3` seconds (1.5–1.8 s at the start, 0.55–0.85 s at full intensity).
- A wave has **1** car in a random lane; with probability `0.25 + 0.6 * intensity` a second car in a different lane; and, when `intensity > 0.4`, with probability `0.55 * intensity` a third car in another free lane. At most three lanes are used, so at least two of the five stay open. A car is added only if its lane is clear at the spawn point. At most **16** traffic cars exist at once (`MAX_TRAFFIC`).
- Traffic uses the complete 14-vehicle catalog for its looks. Each spawn independently picks a body color from the ten-color `TRAFFIC_PAINTS` palette, applied to a copy of the model so factory/garage colors and performance stay unchanged. Paint remains fixed for that entity and works with straight and turning frames. Fuel canisters can spawn in any lane.
- Spawn depth `z = 1.1`. Traffic has an independent world speed. A persistent random cruise preference sets its target to `playerMax * (0.34 + 0.16*intensity + cruise*(0.18 + 0.14*intensity))`, capped at 85% of the traffic vehicle maximum. This stays at or below 82% of the player vehicle maximum. Existing cars approach their updated target at up to 3 km/h/s. Its depth changes by `(trafficSpeed - playerSpeed) / 3.6 * dt / PATH_UNIT`; pickups use traffic speed zero. Braking lets traffic pull away rather than freezing it.
- **Lane changes:** a car reconsiders its lane every 2.5–7 s (the first time after 1.5–5.5 s) and skips about 20% of those considerations; a car blocked by a slower leader less than 0.26 depth ahead considers a change at once (after a 2 s cooldown). It moves to an adjacent lane at 0.9 lanes/s, only into a clear gap, never while it is within **0.14 depth** of the player's plane, and never into a lane within 1.3 lane widths of the player while it is nearer than 0.6 depth.
- **Following:** a car within 0.1 depth behind another car in an overlapping lane brakes (up to 60 km/h/s) to match that car's speed.
- **Separation:** a final hard pass keeps cars in overlapping lanes at least **0.03 depth** apart and caps the follower's speed to its leader's, so traffic never overlaps.
- Entities are removed below `z = -0.15` or beyond `z = 1.5`; collected fuel disappears immediately.

## Collision, pickups and game over

Contact testing occurs when an unpassed entity crosses the player contact band **PLAYER_DEPTH +/- 0.018**, using its previous and current depth to avoid skipping a contact. A hit requires `abs(player.x - laneCenter(entity.lane))` below **0.114** for a motorcycle or **0.162** for other player vehicles. An entity is marked passed after its first contact so it cannot repeatedly refuel or crash the player.

- A fuel canister adds **20** fuel up to 100 and disappears.
- Traffic contact is a fatal crash at any speed (see Crashes). The result screen is titled **"VOCÊ BATEU!"** ("YOU CRASHED!", localized), the reason line shows the crash speed, and the one 1,000-coin second chance is still offered.
- While the 3 s second-chance invincibility lasts, traffic and barrier contacts do not end the run (the barrier still places the car back on the road).
- Stopping does not end a run. **Running out of fuel** ends it (`'fuel'`, "Pane seca!" message) and also offers the second chance.
- Traffic changes lanes and follows the car ahead, so a gap that looks open can close; no speed makes touching a car safe.

## Second chance

Exactly **one free continuation per run**, after any ending. It preserves distance, score, elapsed simulation time and earned coins; clears entities; sets speed to **90 km/h**; raises fuel to at least **45**; moves the car back to at most `abs(x) = 0.6`; and grants **3 s** of invincibility. It does not require or simulate watching an ad. Starting a new run resets this allowance.

## Light and weather

| Light phase | Position in repeating 180-second cycle |
| --- | --- |
| Day | 0–65 s |
| Sunset | 65–95 s |
| Night | 95–155 s |
| Dawn | 155–180 s |

The final **10 s** of each phase smoothly interpolate into the next palette with `u²(3−2u)`. Weather changes every **38 s** through **clear → rain → clear → fog**, with a **5 s** intensity blend. The first five seconds start clear rather than inheriting fog from the previous conceptual cycle. In code the names are `day | sunset | night | dawn` and `clear | rain | fog` (`environment(time)` in `src/game/environment.ts`).

Rain changes road color, adds particles and reduces grip. Fog obscures the road. Night changes light intensity and adds headlights/taillight effects. Environment state is communicated through the scene rather than another HUD panel.

## Focus and interruption

Hiding the page pauses a running game and clears input. Desktop blur also pauses; coarse-pointer devices do not pause on blur alone because Safari browser chrome can trigger it. Remote signal loss clears remote input and pauses. These rules must prevent stuck acceleration or braking.

## Reference and scope

The accelerator/brake/steering control model follows the original [Top Gear / Top Racer instruction manual](https://www.retrogames.cz/manualy/SNES/Top_Gear_-_SNES_-_Manual.pdf). Acceleration, grip, off-road and score constants here are independently tuned for this game's vehicles and five-lane endless road; they are not extracted or verified original-game physics values.

Vehicle sizes, individual braking rates, audio mix, fog and paid continuation: [vehicle-balance-v3.md](../docs/vehicle-balance-v3.md).
