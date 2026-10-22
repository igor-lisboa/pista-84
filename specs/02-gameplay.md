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

A fresh run starts with **80 km/h**, **100 fuel**, **0 distance/time/coins**, centered steering, no traffic, and full vehicle resistance. Only progress is saved; the active run is not restored after reload.

## Timing and movement

`requestAnimationFrame` drives rendering. Simulation delta is clamped to **0–0.05 seconds**; paused or background time is not caught up later. Timers below refer to simulation time, not wall time while the page is hidden.

```text
difficulty = min(2.8, distanceMeters / 4500)
targetSpeed = brake ? 0
            : accelerate ? vehicle.max
            : min(vehicle.max, 105 + difficulty * 24)

speed change toward target:
  acceleration: at most vehicle.accel * dt
  deceleration: at most 60 * dt when braking, otherwise 20 * dt

distance += speed / 3.6 * dt
runCoins = floor(distance / 25)
```

Lateral position `x` is normalized and clamped to **[-1.2, 1.2]**. Traffic lanes have logical centers **-0.61, 0, +0.61**. Keyboard, touch, tilt and remote steering combine and clamp to **[-1, 1]**.

Steering changes `x` by `steer × dt × 1.2 × handling × grip`, followed by curvature drift. Rain grip is `1 - rainIntensity × 0.22` for motorcycles and `1 - rainIntensity × 0.10` for other vehicles.

On the shoulder (`abs(x) > 0.96`), additional deceleration is **38 km/h/s**, or **20** for the SUV. A non-braking car has a shoulder floor of 15 km/h; braking can still stop it.

## Curves and difficulty

Curves are present from the beginning and change direction within the first kilometer. The shared curvature function is:

```text
curveDifficulty = clamp(distance / 9000, 0, 1)
roadCurve = sin((distance + 140) / (245 - curveDifficulty * 85)) * 105
          + sin(distance / 600) * 15
drift = roadCurve / 120 * (0.012 + difficulty * 0.03) * dt
```

Increasing distance raises cruising speed and traffic frequency, strengthens drift and increases curve frequency. The curvature coefficients remain bounded; amplitude is not a separately expanding stat. Rendering and traffic use the same road geometry and logical lane positions.

## Fuel

- Capacity: **100**; fuel cannot become negative or exceed capacity.
- Continuous drain per second: `vehicle.consumption × (0.45 + speed / 190)`.
- Pickup: green canister, adding **32** fuel up to the cap.
- First canister spawns after **4 s**; following canisters spawn every **7–10 s**.
- Empty fuel immediately ends the run with a dry-tank/rear-traffic message.

## Traffic and entity movement

- First traffic spawn: **1.6 s** after starting.
- Subsequent interval: `max(0.7, 2.5 - difficulty * 0.5) + random × 0.7` seconds. Given the current difficulty cap, the smallest base interval is 1.1 s.
- Traffic vehicles and pickup lanes are randomly selected; traffic uses the complete eight-vehicle catalog.
- Spawn depth `z = 1.1`. Depth decreases at `(0.16 + speed / 600) × dt`, multiplied by **0.72** for traffic and **1** for pickups.
- Entities are removed below `z = -0.15`; collected fuel disappears immediately.

## Collision and game over

Collision testing occurs while an unpassed entity is in **-0.09 < z < 0.12**. A hit requires `abs(player.x - entity.lane * 0.61)` below **0.19** for a motorcycle or **0.27** for other player vehicles. An entity is marked passed after its first contact so it cannot repeatedly damage or refuel the player.

- Standard vehicles: one damaging traffic collision ends the run.
- Bruto 4×4: two resistance points. First damage reduces speed to `max(35, speed * 0.65)` and grants **2 s** of invulnerability. The next damaging collision ends the run.
- Speed below **5 km/h** ends the run, representing rear traffic reaching a stopped player.
- There is no separate repair pickup, tire system or active rear-traffic vehicle simulation.

## Second chance

Exactly **one free continuation per run**. It preserves distance, elapsed simulation time and earned coins; clears entities; restores full resistance; sets speed to **90 km/h**; raises fuel to at least **45**; and grants **3 s** of invulnerability. It does not require or simulate watching an ad. Starting a new run resets this allowance.

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
