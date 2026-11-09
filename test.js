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

// cheapestPlan
{
  const { cheapestPlan } = require('./watch.js');
  // ABC (antenna, free), ESPN+ (espnplus 13.99 cheapest), Peacock, CW (free app), TBA
  let p = cheapestPlan([['ABC'], ['ESPN+'], ['Peacock'], ['CW'], []], []);
  assert.deepStrictEqual(p.plan.map(x => x.id).sort(), ['antenna', 'espnplus', 'peacock']);
  assert.strictEqual(p.monthly, 26.98);
  assert.deepStrictEqual([p.total, p.free, p.coverable, p.noTv], [5, 1, 3, 1]);

  // Owning YouTube TV covers ESPN; only Peacock-exclusive game needs buying.
  p = cheapestPlan([['ESPN'], ['FS1'], ['Peacock']], ['yttv']);
  assert.deepStrictEqual(p.plan.map(x => [x.id, x.owned]), [['yttv', true], ['peacock', false]]);
  assert.strictEqual(p.monthly, 12.99);
  assert.strictEqual(p.yoursCover, 2);

  // Already covered: $0, nothing to buy.
  p = cheapestPlan([['ESPN']], ['cable']);
  assert.deepStrictEqual([p.monthly, p.plan.length, p.singles.length], [0, 1, 0]);

  // Nothing announced.
  p = cheapestPlan([[], []], []);
  assert.deepStrictEqual([p.monthly, p.plan.length, p.noTv], [0, 0, 2]);

  // One service beats a bundle when it's cheaper: ESPN + ESPN2 + ESPNU → ESPN Unlimited ($31.99) over Sling+extra.
  p = cheapestPlan([['ESPN'], ['ESPN2'], ['ESPNU']], []);
  assert.deepStrictEqual(p.plan.map(x => x.id), ['espn']);
  console.log('plan ok');
}
