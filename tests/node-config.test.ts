import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isProduction, requestOrigin, validateNodeConfig} from '../src/server/node-config.ts';

test('production requires durable storage and shared pairing without disclosing values', () => {
  assert.equal(isProduction({DYNO: 'web.1'}), true);
  assert.equal(isProduction({NODE_ENV: 'production'}), true);
  assert.equal(isProduction({}), false);
  assert.doesNotThrow(() => validateNodeConfig({}));
  for (const env of [{NODE_ENV: 'production'}, {DYNO: 'web.1'}]) {
    assert.throws(() => validateNodeConfig(env), /Missing required config vars: MONGODB_URI, REDIS_URL/);
    assert.throws(() => validateNodeConfig({...env, MONGODB_URI: 'private-value'}), /Missing required config vars: REDIS_URL$/);
    assert.throws(() => validateNodeConfig({...env, MONGODB_URI: ' ', REDIS_URL: '\t'}), /MONGODB_URI, REDIS_URL/);
    assert.doesNotThrow(() => validateNodeConfig({...env, MONGODB_URI: 'configured', REDIS_URL: 'configured'}));
  }
});

test('PUBLIC_ORIGIN accepts only HTTP(S) origins and never includes rejected values in errors', () => {
  assert.doesNotThrow(() => validateNodeConfig({PUBLIC_ORIGIN: 'https://game.example/'}));
  for (const origin of ['invalid', 'ftp://game.example', 'https://user:private-value@game.example',
    'https://game.example/path', 'https://game.example?secret=value', 'https://game.example/#fragment']) {
    assert.throws(() => validateNodeConfig({PUBLIC_ORIGIN: origin}), error =>
      error instanceof Error && error.message.startsWith('PUBLIC_ORIGIN must be') && !error.message.includes(origin));
  }
});

test('Heroku HTTPS forwarding and explicit public origins preserve same-origin checks', () => {
  const request = {headers: {host: 'game.example', 'x-forwarded-proto': 'https'}};
  assert.equal(requestOrigin(request, {DYNO: 'web.1'}), 'https://game.example');
  assert.equal(requestOrigin(request, {}), 'http://game.example', 'local clients cannot select the scheme through forwarded headers');
  assert.equal(requestOrigin({headers: {host: 'game.example'}}, {DYNO: 'web.1'}), 'http://game.example');
  assert.equal(requestOrigin(request, {PUBLIC_ORIGIN: 'https://public.example/'}), 'https://public.example');
});
