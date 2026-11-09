// Which streaming services carry which networks. Carriage deals change, so re-check this each season.
// Put your affiliate links in `url` — that's the money.
// price: monthly USD before tax/promos (null = can't be priced). Check these every few months.
const PRICES_AS_OF = 'Nov 2026';
const SERVICES = [
  { id: 'cable',    name: 'Cable / Satellite',  price: null, url: '' },
  { id: 'antenna',  name: 'TV Antenna',         price: 0, url: 'https://www.amazon.com/s?k=hdtv+antenna' },
  { id: 'yttv',     name: 'YouTube TV',         price: 82.99, url: 'https://tv.youtube.com/' },
  { id: 'hulu',     name: 'Hulu + Live TV',     price: 99.99, url: 'https://www.hulu.com/live-tv' },
  { id: 'fubo',     name: 'Fubo',               price: 88.99, url: 'https://www.fubo.tv/' },
  { id: 'directv',  name: 'DIRECTV Stream',     price: 89.99, url: 'https://www.directv.com/stream/' },
  { id: 'slingo',   name: 'Sling Orange',       price: 45.99, url: 'https://www.sling.com/' },
  { id: 'slingb',   name: 'Sling Blue',         price: 54.99, url: 'https://www.sling.com/' },
  { id: 'espn',     name: 'ESPN Unlimited',     price: 31.99, url: 'https://www.espn.com/' },
  { id: 'espnplus', name: 'ESPN Select / ESPN+', price: 13.99, url: 'https://plus.espn.com/' },
  { id: 'peacock',  name: 'Peacock',            price: 12.99, url: 'https://www.peacocktv.com/' },
  { id: 'paramount',name: 'Paramount+',         price: 13.99, url: 'https://www.paramountplus.com/' },
  { id: 'foxone',   name: 'Fox One',            price: 19.99, url: 'https://www.foxone.com/' },
  { id: 'hbomax',   name: 'HBO Max',            price: 10.99, url: 'https://www.hbomax.com/' },
  { id: 'prime',    name: 'Prime Video',        price: 8.99, url: 'https://www.amazon.com/primevideo' },
  { id: 'netflix',  name: 'Netflix',            price: 8.99, url: 'https://www.netflix.com/' },
];

const LIVE = ['cable', 'yttv', 'hulu', 'fubo', 'directv'];
const NETWORKS = {
  'abc':         ['antenna', ...LIVE],
  'cbs':         ['antenna', ...LIVE, 'paramount'],
  'nbc':         ['antenna', ...LIVE, 'peacock'],
  'fox':         ['antenna', ...LIVE, 'foxone'],
  'cw':          ['antenna', ...LIVE],
  'espn':        [...LIVE, 'slingo', 'espn'],
  'espn2':       [...LIVE, 'slingo', 'espn'],
  'espnu':       [...LIVE, 'espn'],
  'espnews':     [...LIVE, 'espn'],
  'sec network': [...LIVE, 'espn'],
  'acc network': [...LIVE, 'espn'],
  'espn+':       ['espn', 'espnplus', 'hulu'],
  'cbssn':       LIVE,
  'fs1':         [...LIVE, 'slingb', 'foxone'],
  'fs2':         [...LIVE, 'foxone'],
  'btn':         [...LIVE, 'foxone'],
  'tnt':         ['cable', 'yttv', 'hulu', 'directv', 'slingo', 'slingb', 'hbomax'],
  'trutv':       ['cable', 'yttv', 'hulu', 'directv', 'slingo', 'slingb', 'hbomax'],
  'usa net':     [...LIVE, 'slingb'],
  'peacock':     ['peacock'],
  'paramount+':  ['paramount'],
  'prime video': ['prime'],
  'netflix':     ['netflix'],
  'nfl net':     [...LIVE, 'slingb'],
  'nfl network': [...LIVE, 'slingb'],
  'nbcsn':       LIVE, // verify
  'nba tv':      LIVE, // verify
};
const FREE = { 'cw': 'Free on The CW app' };

// networks: names from the feed, e.g. ['ESPN', 'ESPN+']. mine: service ids the user has.
function whereToWatch(networks, mine) {
  const keys = networks.map(n => n.toLowerCase());
  const carriers = new Set(keys.flatMap(k => NETWORKS[k] || []));
  const order = SERVICES.map(s => s.id).filter(id => carriers.has(id));
  return {
    yours: order.filter(id => mine.includes(id)),
    options: order.filter(id => !mine.includes(id)),
    free: keys.map(k => FREE[k]).find(Boolean) || null,
    unknown: networks.filter(n => !NETWORKS[n.toLowerCase()]),
  };
}

// Who covered and over/under from the pre-game line. details: "JAX -9.5" or "EVEN"; teams: [{abbr, name, score}].
function lineResult(details, overUnder, teams) {
  const out = {}, [a, b] = teams;
  const covered = (fav, dog, spread) => {
    const d = fav.score - dog.score + spread;
    return d > 0 ? `${fav.name} covered` : d < 0 ? `${dog.name} covered` : 'Push';
  };
  const m = /^(\S+)\s+(-?[\d.]+)$/.exec(details || '');
  const fav = m && teams.find(t => t.abbr === m[1]);
  if (fav) out.spread = covered(fav, teams.find(t => t !== fav), Number(m[2]));
  else if (/^(even|pk|pick)/i.test(details || '')) out.spread = covered(a, b, 0);
  if (overUnder) {
    const total = a.score + b.score;
    out.total = `${total > overUnder ? 'Over' : total < overUnder ? 'Under' : 'Push'} (${total} pts)`;
  }
  return out;
}

// Cheapest set of services that covers every remaining game any service can carry.
// games: national-network lists, one per upcoming game. mine: service ids the user already has ($0).
function cheapestPlan(games, mine) {
  const bit = i => 1n << BigInt(i);
  const count = m => m.toString(2).replace(/0/g, '').length;
  const free = games.map(n => !!whereToWatch(n, []).free);
  const maskOf = s => games.reduce((m, n, i) => (!free[i] && whereToWatch(n, [s.id]).yours.length ? m | bit(i) : m), 0n);
  const owned = SERVICES.filter(s => mine.includes(s.id)).map(s => ({ s, m: maskOf(s) })).filter(x => x.m);
  const base = owned.reduce((a, x) => a | x.m, 0n);
  const cands = SERVICES.filter(s => !mine.includes(s.id) && s.price !== null)
    .map(s => ({ s, m: maskOf(s) })).filter(x => x.m & ~base);
  const need = cands.reduce((a, x) => a | x.m, base);

  // Brute force is fine: ~15 candidates is 32k combinations.
  let best = { sub: 0, c: need === base ? 0 : Infinity, k: 0 };
  for (let sub = 1; sub < 1 << cands.length; sub++) {
    let m = base, c = 0, k = 0;
    for (let j = 0; j < cands.length; j++) if ((sub >> j) & 1) { m |= cands[j].m; c += cands[j].s.price; k++; }
    if (m === need && (c < best.c - 1e-9 || (Math.abs(c - best.c) < 1e-9 && k < best.k))) best = { sub, c, k };
  }
  const picked = cands.filter((_, j) => (best.sub >> j) & 1);
  return {
    total: games.length,
    free: free.filter(Boolean).length,
    coverable: count(need),
    noTv: games.length - free.filter(Boolean).length - count(need),
    yoursCover: count(base),
    plan: [...owned.map(x => ({ id: x.s.id, price: 0, owned: true, covers: count(x.m) })),
      ...picked.map(x => ({ id: x.s.id, price: x.s.price, owned: false, covers: count(x.m) }))],
    monthly: Math.round(best.c * 100) / 100,
    singles: cands.filter(x => x.s.price > 0)
      .map(x => ({ id: x.s.id, price: x.s.price, covers: count(x.m | base) }))
      .sort((a, b) => b.covers - a.covers || a.price - b.price).slice(0, 3),
  };
}

if (typeof module !== 'undefined') module.exports = { SERVICES, NETWORKS, whereToWatch, lineResult, cheapestPlan, PRICES_AS_OF };
