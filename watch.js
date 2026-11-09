// Which streaming services carry which networks. Carriage deals change, so re-check this each season.
// Put your affiliate links in `url` — that's the money.
const SERVICES = [
  { id: 'cable',    name: 'Cable / Satellite',  url: '' },
  { id: 'antenna',  name: 'TV Antenna',         url: 'https://www.amazon.com/s?k=hdtv+antenna' },
  { id: 'yttv',     name: 'YouTube TV',         url: 'https://tv.youtube.com/' },
  { id: 'hulu',     name: 'Hulu + Live TV',     url: 'https://www.hulu.com/live-tv' },
  { id: 'fubo',     name: 'Fubo',               url: 'https://www.fubo.tv/' },
  { id: 'directv',  name: 'DIRECTV Stream',     url: 'https://www.directv.com/stream/' },
  { id: 'slingo',   name: 'Sling Orange',       url: 'https://www.sling.com/' },
  { id: 'slingb',   name: 'Sling Blue',         url: 'https://www.sling.com/' },
  { id: 'espn',     name: 'ESPN Unlimited',     url: 'https://www.espn.com/' },
  { id: 'espnplus', name: 'ESPN Select / ESPN+', url: 'https://plus.espn.com/' },
  { id: 'peacock',  name: 'Peacock',            url: 'https://www.peacocktv.com/' },
  { id: 'paramount',name: 'Paramount+',         url: 'https://www.paramountplus.com/' },
  { id: 'foxone',   name: 'Fox One',            url: 'https://www.foxone.com/' },
  { id: 'hbomax',   name: 'HBO Max',            url: 'https://www.hbomax.com/' },
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

if (typeof module !== 'undefined') module.exports = { SERVICES, NETWORKS, whereToWatch };
