import {CARS, Race, CALM_CONDITIONS} from '../src/game/index.ts';

console.log('| Vehicle | Taper starts (km/h) | 0-100 (s) | Time to 70% (s) | Time to 90% (s) | Time to 95% (s) |');
console.log('| --- | ---: | ---: | ---: | ---: | ---: |');
for (const car of CARS) {
  const race = new Race(car, () => 0.5);
  race.start();
  race.conditions = CALM_CONDITIONS;
  race.entities = [];
  race.trafficTimer = 1e9;
  race.fuelTimer = 1e9;
  const targets = [100, car.max * 0.7, car.max * 0.9, car.max * 0.95];
  const times = targets.map(() => 0);
  while (times.some(time => time === 0) && race.time < 300) {
    race.x = 0;
    race.fuel = 100;
    race.update(0.02, {accelerate: true});
    targets.forEach((target, index) => {
      if (times[index] === 0 && race.speed >= target) times[index] = race.time;
    });
  }
  console.log(`| ${car.name} | ${Number((car.max * 0.7).toFixed(1))} | ${times.map(time => time.toFixed(2)).join(' | ')} |`);
}
