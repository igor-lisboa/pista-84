import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DELETE, GET, POST} from '../api/rooms.ts';

const ORIGIN = 'https://pista.test';

interface Call {
  method: 'GET' | 'POST' | 'DELETE';
  /** Room path after /api/rooms, e.g. "" or "<id>/input". */
  rest: string;
  token?: string;
  body?: unknown;
  /** `original` keeps the real URL; `rewritten` is what vercel.json's rewrite produces. */
  style: 'original' | 'rewritten';
}

async function call({method, rest, token, body, style}: Call) {
  const url =
    style === 'original'
      ? `${ORIGIN}/api/rooms${rest ? `/${rest}` : ''}`
      : `${ORIGIN}/api/rooms?route=${rest}`;
  const request = new Request(url, {
    method,
    headers: {origin: ORIGIN, ...(token ? {authorization: `Bearer ${token}`} : {})},
    ...(body ? {body: JSON.stringify(body)} : {}),
  });
  const handler = {GET, POST, DELETE}[method];
  const response = await handler(request);
  return {status: response.status, data: (await response.json()) as Record<string, any>};
}

for (const style of ['original', 'rewritten'] as const) {
  test(`phone pairing works end to end through the single Vercel function (${style} URLs)`, async () => {
    const created = await call({method: 'POST', rest: '', body: {offer: '{"type":"relay"}'}, style: 'original'});
    assert.equal(created.status, 201);
    const {id, hostToken, joinToken} = created.data as {id: string; hostToken: string; joinToken: string};
    assert.match(id, /^[a-f0-9]{48}$/);

    // The phone reads the offer and answers it.
    const offer = await call({method: 'GET', rest: id, token: joinToken, style});
    assert.equal(offer.status, 200);
    assert.equal(offer.data.answered, false);
    assert.equal((await call({method: 'POST', rest: id, token: joinToken, body: {answer: '{"type":"relay"}'}, style})).status, 200);
    // A second phone cannot take over the room.
    assert.equal((await call({method: 'POST', rest: id, token: joinToken, body: {answer: 'x'}, style})).status, 409);

    // The main screen sees the answer, then the phone's commands.
    const hostView = await call({method: 'GET', rest: id, token: hostToken, style});
    assert.equal(hostView.data.answer, '{"type":"relay"}');
    const sent = await call({method: 'POST', rest: `${id}/input`, token: joinToken, body: {input: {steer: 5, accelerate: true}}, style});
    assert.equal(sent.status, 200);
    const afterInput = await call({method: 'GET', rest: id, token: hostToken, style});
    assert.deepEqual(afterInput.data.input, {steer: 1, accelerate: true, brake: false, start: false, pause: false});

    // Tokens are not interchangeable, and only the main screen can close the room.
    assert.equal((await call({method: 'GET', rest: id, token: 'nope', style})).status, 403);
    assert.equal((await call({method: 'DELETE', rest: id, token: joinToken, style})).status, 403);
    assert.equal((await call({method: 'DELETE', rest: id, token: hostToken, style})).status, 200);
    assert.equal((await call({method: 'GET', rest: id, token: hostToken, style})).status, 410);
  });
}

test('an unknown or malformed room route is rejected rather than crashing', async () => {
  assert.equal((await call({method: 'GET', rest: 'not-a-room-id', style: 'original'})).status, 404);
  assert.equal((await call({method: 'POST', rest: '', body: {offer: 42}, style: 'original'})).status, 400);
});

test('a stray space or slash around the rewritten route does not break the room lookup', async () => {
  const created = await call({method: 'POST', rest: '', body: {offer: '{"type":"relay"}'}, style: 'original'});
  const {id, joinToken} = created.data as {id: string; joinToken: string};
  for (const decorated of [`${id} `, `/${id}`, `${id}/`]) {
    const response = await GET(
      new Request(`${ORIGIN}/api/rooms?route=${encodeURIComponent(decorated)}`, {headers: {origin: ORIGIN, authorization: `Bearer ${joinToken}`}}),
    );
    assert.equal(response.status, 200, JSON.stringify(decorated));
  }
});
