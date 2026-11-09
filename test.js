// Run: node test.js
const assert = require('assert');
const { SERVICES, NETWORKS, whereToWatch, lineResult } = require('./watch.js');

const ids = SERVICES.map(s => s.id);
for (const [net, list] of Object.entries(NETWORKS))
  for (const id of list) assert(ids.includes(id), `${net} maps to unknown service ${id}`);

let r = whereToWatch(['ESPN'], ['yttv']);
assert.deepStrictEqual(r.yours, ['yttv']);
assert(r.options.includes('espn') && !r.options.includes('yttv'));

r = whereToWatch(['ESPN+'], ['yttv']);
assert.deepStrictEqual(r.yours, []);
assert.deepStrictEqual(r.options, ['hulu', 'espn', 'espnplus']);

r = whereToWatch(['CW'], []);
assert.strictEqual(r.free, 'Free on The CW app');

r = whereToWatch(['MW+'], ['cable']);
assert.deepStrictEqual(r, { yours: [], options: [], free: null, unknown: ['MW+'] });

assert.deepStrictEqual(whereToWatch([], ['cable']).yours, []);
assert.deepStrictEqual(whereToWatch(['Prime Video'], ['prime']).yours, ['prime']);
const jax = { abbr: 'JAX', name: 'Jaguars', score: 33 }, bal = { abbr: 'BAL', name: 'Ravens', score: 10 };
assert.deepStrictEqual(lineResult('JAX -9.5', 40.5, [jax, bal]), { spread: 'Jaguars covered', total: 'Over (43 pts)' });
assert.strictEqual(lineResult('JAX -30', null, [jax, bal]).spread, 'Ravens covered');
assert.strictEqual(lineResult('JAX -23', 43, [jax, bal]).spread, 'Push');
assert.strictEqual(lineResult('JAX -23', 43, [jax, bal]).total, 'Push (43 pts)');
assert.strictEqual(lineResult('BAL -3', 50, [jax, bal]).total, 'Under (43 pts)');
assert.strictEqual(lineResult('EVEN', null, [jax, bal]).spread, 'Jaguars covered');
assert.deepStrictEqual(lineResult('', null, [jax, bal]), {});
console.log('ok');
