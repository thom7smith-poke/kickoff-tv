// Run: node test.js
const assert = require('assert');
const { SERVICES, NETWORKS, whereToWatch } = require('./watch.js');

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
console.log('ok');
