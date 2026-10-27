# 02 — Gameplay rules and simulation

[Specification index](README.md) · Implementation: [engine.js](../src/engine.js)

## States and run lifecycle

| State | Behavior | Available transition |
| --- | --- | --- |
| `ready` | Menu and animated scenery; no race simulation | Start → `running` |
| `running` | Movement, fuel, distance, spawning and collisions update | Pause → `paused`; failure → `over` |
| `paused` | Simulation freezes and controls clear | Continue → `running`; menu/car change → `ready` |
| `over` | Result overlay; run rewards settled | Restart → new `running`; free second chance → same `running`; menu → `ready` |

The interface view (`menu`, `race`, `overlay`, or phone controller) is distinct from the simulation state. Opening a modal during a run pauses it. Closing that modal does not silently resume the race. Changing a vehicle settles the previous run and resets it. Changing paint updates appearance without resetting the run.

A fresh run starts with **0 km/h**, **100 fuel**, **0 distance/time/coins**, centered steering, no traffic, and no impacts. Only progress is saved; the active run is not restored after reload.

## Timing and movement

`requestAnimationFrame` drives rendering. Simulation delta is clamped to **0–0.05 seconds**; paused or background time is not caught up later. Timers below refer to simulation time, not wall time while the page is hidden.

```text
speedRatio = clamp(speed / vehicle.max, 0, 1)
acceleration = vehicle.accel * 1.8 * (1 - 0.45 * speedRatio)
force = brake ? -110
      : accelerate ? acceleration
      : -(12 + speed * 0.025)
speed = clamp(speed + force * dt, 0, vehicle.max)

distance += speed / 3.6 * dt
runCoins = floor(distance / 25)
```

Lateral position `x` uses normalized road half-widths. Five traffic lanes use indices **-2, -1, 0, 1, 2**, width **0.372**, and centers **-0.744, -0.372, 0, 0.372, 0.744**. Four dashed dividers separate them between the solid road edges. Vehicle sprites, lateral authority, drift and collision widths scale by **0.6** to preserve lane-change proportions. Combined keyboard, touch, tilt and remote input clamps to **[-1, 1]**. Steering follows input exponentially (`1 - exp(-22 * dt)`) and returns smoothly to neutral. Lateral authority is `(1.35 - 0.25 * speedRatio) * clamp(speed / 90, 0, 1) * handling * grip * VEHICLE_SCALE`. Steering has no lateral authority when stopped. Releasing throttle coasts; braking has priority over simultaneous acceleration and can stop the car without ending the run.

Rain grip is `1 - rainIntensity * 0.22` for motorcycles and `1 - rainIntensity * 0.10` for other vehicles. The shoulder starts at `abs(x) > 0.96`; grass slows the car by 100 km/h/s while above 60 km/h (85 for the SUV). It does not raise a stopped car's speed. At `abs(x) >= 1.35`, the car bounces to `abs(x) = 1.19` and receives the impact speed penalty.

## Curves and difficulty

Each race gets a new 32-bit road seed. Stateless generation combines that seed with the distance section, so physics, rendering and curve hints always sample the same road, regardless of query order. Pause and second chance preserve the seed. Restart selects a new seed. There is no fixed track table or accumulating segment list.

Every **1600 m** section randomly selects a left bend, right bend or entirely straight stretch (**41%, 41%, 18%**). A bend has **240-500 m** of leading straight (at least **420 m** at the start of a run), **180-240 m** entry, **200-360 m** sustained curve, and **180-240 m** exit; the remainder is straight. Bend magnitude varies from **0.32 to 0.64**. Entries and exits use `t*t*t*(t*(6*t - 15) + 10)` and return to zero before section boundaries. Traffic frequency and pace increase with elapsed simulation time; curvature stays moderate.

Road path advances in metres at the same rate as distance. Curvature at the player plane creates outward drift:

```text
load = clamp((speed / 180)^2, 0, 3)
drift = roadBend(path + PATH_UNIT * PLAYER_DEPTH, roadSeed)
        * load * 0.9 * VEHICLE_SCALE / sqrt(handling) / grip
x += (smoothedSteer * steeringAuthority - drift) * dt
```

The renderer integrates upcoming curvature using midpoint curvature and trapezoidal heading integration, follows 40% of lateral player movement with the camera, and shares one depth projection with scenery and traffic: `screenT = (1 - z) / (1 + 4z)`. Player screen depth is **0.855**, corresponding to `PLAYER_DEPTH ~= 0.0328`. `PATH_UNIT = 240 m`. Steering selects authored straight, mild-turn or strong-turn sprites, with left turns mirrored. Body geometry is never sheared, sliced or rotated to imitate yaw. Road dashes are 6 m long with 6 m gaps, kerbs alternate every 4 m, and ground bands alternate every 7 m. All road paint samples `path + screenToDepth(t) * PATH_UNIT`; its motion follows simulated distance and freezes at rest. Scene effects use simulation time and heading follows distance travelled, so pausing freezes the scene. Continuous roadside barriers sit at the same normalized wall position as physics.

## Fuel

- Capacity: **100**; fuel cannot become negative or exceed capacity.
- Continuous drain per second: `vehicle.consumption × (0.45 + speed / 190)`.
- Pickup: green canister, adding **32** fuel up to the cap.
- First canister spawns after **4 s**; following canisters spawn every **7–10 s**.
- Empty fuel immediately ends the run with a dry-tank/rear-traffic message.

## Traffic and entity movement

- First traffic spawn: **1.6 s** after starting.
- Subsequent interval: `2.4 - difficulty * 1.5 + random * 0.4` seconds, with `difficulty = clamp(time / 180, 0, 1)`. This ramps from 2.4-2.8 s to 0.9-1.3 s over three minutes of active play.
- Traffic and pickups can spawn in any of the five lanes; traffic uses the complete eight-vehicle catalog. Double waves choose distinct lanes and leave at least three lanes open within that wave.
- Spawn depth `z = 1.1`. Traffic has an independent world speed. A persistent random cruise preference sets its target to `playerMax * (0.34 + 0.16*difficulty + cruise*(0.18 + 0.14*difficulty))`, capped at 85% of the traffic vehicle maximum. This stays at or below 82% of the player vehicle maximum. Existing cars approach their updated target at up to 3 km/h/s. Its depth changes by `(trafficSpeed - playerSpeed) / 3.6 * dt / PATH_UNIT`; pickups use traffic speed zero. Braking lets traffic pull away rather than freezing it.
- Entities are removed below `z = -0.15` or beyond `z = 1.5`; collected fuel disappears immediately.

## Collision and game over

Collision testing occurs when an unpassed entity crosses the player contact band **PLAYER_DEPTH +/- 0.018**, using its previous and current depth to avoid skipping a contact. A hit requires `abs(player.x - laneCenter(entity.lane))` below **0.114** for a motorcycle or **0.162** for other player vehicles. An entity is marked passed after its first contact so it cannot repeatedly damage or refuel the player.

- Standard vehicles retain **42%** of speed after an impact; the SUV retains **70%**.
- Traffic and barrier impacts grant **1.3 s** of invulnerability. Further contacts during that interval do not compound the speed loss.
- Touching traffic above **50 km/h** is a fatal crash: the run ends with a "Você bateu!" screen (second chance still available once). At or below 50 km/h it is an ordinary impact. Barrier impacts are never fatal.
- Traffic changes lanes occasionally (into a clear gap, never just ahead of the player), follows the car ahead at a safe distance and never overlaps other traffic.
- Stopping does not end a run. Fuel exhaustion ends it and offers the existing second chance.

## Second chance

Exactly **one free continuation per run**. It preserves distance, elapsed simulation time and earned coins; clears entities; sets speed to **90 km/h**; raises fuel to at least **45**; and grants **3 s** of invulnerability. It does not require or simulate watching an ad. Starting a new run resets this allowance.

## Light and weather

| Light phase | Position in repeating 180-second cycle |
| --- | --- |
| Day | 0–65 s |
| Sunset | 65–95 s |
| Night | 95–155 s |
| Dawn | 155–180 s |

The final **10 s** of each phase smoothly interpolate into the next palette with `u²(3−2u)`. Weather changes every **38 s** through **clear → rain → clear → fog**, with a **5 s** intensity blend. The first five seconds start clear rather than inheriting fog from the previous conceptual cycle.

Rain changes road color, adds particles and reduces grip. Fog obscures the road. Night changes light intensity and adds headlights/taillight effects. Environment state is communicated through the scene rather than another HUD panel.

## Focus and interruption

Hiding the page pauses a running game and clears input. Desktop blur also pauses; coarse-pointer devices do not pause on blur alone because Safari browser chrome can trigger it. Remote signal loss clears remote input and pauses. These rules must prevent stuck acceleration or braking.

## Reference and scope

The accelerator/brake/steering control model follows the original [Top Gear / Top Racer instruction manual](https://www.retrogames.cz/manualy/SNES/Top_Gear_-_SNES_-_Manual.pdf). Acceleration, grip and speed-loss constants here are independently tuned for this game's vehicles and five-lane endless road; they are not extracted or verified original-game physics values.
