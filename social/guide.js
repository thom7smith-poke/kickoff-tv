// TV-guide style grid for X: channels down the side, times across the top, games as blocks.
// Usage: node social/guide.js [cfb cbb nfl nba] [--date 20261114]
// Writes social/out/<sport>-guide-<date>.png (TV channels) and <sport>-streaming-<date>.png (streaming-only games).
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const SITE = require('../config.js');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SPORTS = {
  cfb: { name: 'College Football', emoji: '🏈', path: 'football/college-football', q: 'groups=80', hours: 3.5 },
  cbb: { name: "Men's College Hoops", emoji: '🏀', path: 'basketball/mens-college-basketball', q: 'groups=50', hours: 2 },
  nfl: { name: 'NFL', emoji: '🏈', path: 'football/nfl', q: '', hours: 3.25 },
  nba: { name: 'NBA', emoji: '🏀', path: 'basketball/nba', q: '', hours: 2.5 },
};
// Channel order, like a cable lineup: broadcast first, then sports networks. Unlisted channels go last.
const ORDER = ['ABC', 'CBS', 'NBC', 'Fox', 'CW', 'ESPN', 'ESPN2', 'ESPNU', 'ESPNEWS', 'SEC Network', 'ACC Network', 'BTN',
  'FS1', 'FS2', 'CBSSN', 'TNT', 'truTV', 'USA Net', 'NBCSN', 'NFL Net', 'NBA TV',
  'ESPN+', 'Peacock', 'Paramount+', 'Prime Video', 'Netflix', 'ACCNX', 'SECN+', 'B1G+', 'YouTube'];
const isStreaming = n => /\+|peacock|prime|netflix|youtube|accnx|flo|stadium|espn3/i.test(n);
const W = 1600, LEFT = 170, PAD = 48, ROW = 46, HEAD = 196, FOOT = 86;

const args = process.argv.slice(2);
const di = args.indexOf('--date');
const date = di >= 0 ? args.splice(di, 2)[1]
  : new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date()).replace(/-/g, '');
const picked = args.length ? args : ['cfb', 'cbb'];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const etHour = d => { // hours since midnight ET
  const p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(d);
  return Number(p.find(x => x.type === 'hour').value) + Number(p.find(x => x.type === 'minute').value) / 60;
};
const hourLabel = h => `${((Math.floor(h) + 11) % 12) + 1}${h % 1 ? ':30' : ''}${Math.floor(h) % 24 < 12 ? 'a' : 'p'}`;

// Put each game on its first national channel, then stack overlapping games on one channel into lanes.
// mode: 'tv' (cable/broadcast), 'streaming' (streaming-only games) or 'all'.
function layout(events, hours, mode) {
  const byCh = new Map();
  for (const e of events) {
    if (e.status.type.state === 'post') continue;
    const c = e.competitions[0];
    const nets = [...new Set((c.geoBroadcasts || []).filter(g => g.market?.type === 'National').map(g => g.media.shortName))];
    const tv = nets.filter(n => !isStreaming(n)), st = nets.filter(isStreaming);
    const ch = mode === 'tv' ? tv[0] : mode === 'streaming' ? (!tv.length && st[0]) : tv[0] || st[0];
    if (!ch) continue;
    const start = etHour(new Date(e.date));
    if (!byCh.has(ch)) byCh.set(ch, []);
    byCh.get(ch).push({ e, c, start, end: start + hours });
  }
  const rank = ch => { const i = ORDER.findIndex(o => o.toLowerCase() === ch.toLowerCase()); return i < 0 ? 999 : i; };
  return [...byCh].sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b)).map(([ch, games]) => {
    const lanes = [];
    for (const g of games.sort((a, b) => a.start - b.start)) {
      const lane = lanes.find(l => l.at(-1).end <= g.start + 0.01);
      lane ? lane.push(g) : lanes.push([g]);
    }
    return { ch, lanes, st: isStreaming(ch) };
  });
}

function html(sport, rows, mode) {
  const all = rows.flatMap(r => r.lanes.flat());
  const t0 = Math.floor(Math.min(...all.map(g => g.start)));
  const t1 = Math.min(Math.ceil(Math.max(...all.map(g => g.end))), t0 + 16);
  const gridW = W - PAD * 2 - LEFT, px = gridW / (t1 - t0);
  const laneCount = rows.reduce((n, r) => n + r.lanes.length, 0);
  const H = Math.max(900, HEAD + laneCount * ROW + FOOT + 20);
  const day = new Date(`${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6)}T12:00:00`)
    .toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  const brand = /tv$/i.test(SITE.name) ? `${esc(SITE.name.slice(0, -2))}<em>${esc(SITE.name.slice(-2))}</em>` : esc(SITE.name);
  const logo = t => t.logo ? `<img src="${esc(t.logo.replace('/500/', '/500-dark/'))}" onerror="this.onerror=null;this.src='${esc(t.logo)}'">` : '';
  // Short blocks (hoops) use abbreviations so names aren't cut off.
  const name = (c, short) => { const r = c.curatedRank?.current; return `${r && r <= 25 ? `<b class="rk">${r}</b>` : ''}${esc(short ? c.team.abbreviation : c.team.shortDisplayName)}`; };

  const ticks = [];
  for (let h = t0; h <= t1; h += 0.5) ticks.push(`<div class="tick${h % 1 ? ' half' : ''}" style="left:${(h - t0) * px}px">${h % 1 || h === t1 ? '' : `<span>${hourLabel(h)}</span>`}</div>`);

  const body = rows.map(({ ch, lanes, st }) => `<div class="ch${st && mode === 'all' ? ' st' : ''}" style="height:${lanes.length * ROW}px"><div class="chn">${esc(ch)}</div><div class="lanes">${
    lanes.map(lane => `<div class="lane">${lane.map(({ c, start, end }) => {
      const [away, home] = [...c.competitors].sort((a, b) => (b.homeAway === 'away') - (a.homeAway === 'away'));
      const ranked = [away, home].filter(t => t.curatedRank?.current <= 25).length;
      const x = (start - t0) * px, w = Math.min(end, t1) - start, short = w * px < 300;
      return `<div class="g${ranked === 2 ? ' hot' : ranked ? ' rk1' : ''}" style="left:${x + 2}px;width:${w * px - 4}px">
        ${logo(away.team)}<span class="nm">${name(away, short)}</span><span class="at">@</span>${logo(home.team)}<span class="nm">${name(home, short)}</span></div>`;
    }).join('')}</div>`).join('')}</div></div>`).join('');

  return `<!doctype html><meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Barlow:wght@500;600;700&family=Barlow+Condensed:ital,wght@0,600;0,700;0,800;1,800&display=block" rel="stylesheet">
  <style>
  *{box-sizing:border-box;margin:0}
  body{width:${W}px;height:${H}px;background:#0a0d0c radial-gradient(1000px 500px at 90% -20%,rgba(46,224,127,.16),transparent 70%);color:#f2f5f3;
    font-family:Barlow,sans-serif;padding:40px ${PAD}px 0;overflow:hidden}
  .top{display:flex;align-items:flex-end;justify-content:space-between;height:${HEAD - 70}px}
  .k{font-family:"Barlow Condensed";font-size:24px;letter-spacing:.16em;font-weight:700;color:#2ee07f}
  h1{font-family:"Barlow Condensed";font-size:72px;line-height:.9;font-weight:800;font-style:italic;text-transform:uppercase;margin-top:4px}
  .d{font-family:"Barlow Condensed";font-size:26px;font-weight:600;color:#8a9592;text-transform:uppercase;letter-spacing:.06em;text-align:right}
  .d b{display:block;color:#f2f5f3;font-size:34px}
  .grid{position:relative;margin-top:16px;border:1px solid #232b29;border-radius:16px;background:#101514;overflow:hidden}
  .times{position:relative;height:40px;margin-left:${LEFT}px;border-bottom:1px solid #232b29}
  .tick{position:absolute;top:0;height:9999px;border-left:1px solid #1d2423}
  .tick.half{border-left-style:dashed;border-color:#171d1c}
  .tick span{position:absolute;top:8px;left:6px;font-family:"Barlow Condensed";font-size:20px;font-weight:700;color:#8a9592;white-space:nowrap}
  .ch{display:flex;border-bottom:1px solid #1d2423;position:relative}
  .ch:nth-child(even){background:rgba(255,255,255,.015)}
  .ch.st .chn{color:#8a9592}
  .ch.st:not(.st ~ .st){border-top:2px solid #2ee07f}
  .chn{width:${LEFT}px;flex:none;display:flex;align-items:center;padding:0 16px;font-family:"Barlow Condensed";font-size:22px;font-weight:800;
    text-transform:uppercase;letter-spacing:.03em;background:#121716;border-right:1px solid #232b29;position:relative;z-index:2}
  .lanes{flex:1;position:relative}
  .lane{position:relative;height:${ROW}px}
  .g{position:absolute;top:5px;height:${ROW - 10}px;border-radius:8px;background:#1d2524;border:1px solid #2a3432;display:flex;align-items:center;gap:6px;
    padding:0 10px;overflow:hidden;white-space:nowrap;font-size:17px;font-weight:600}
  .g img{width:22px;height:22px;object-fit:contain;flex:none}
  .g .nm{overflow:hidden;text-overflow:ellipsis}
  .g .at{color:#5d6866;font-weight:500}
  .g.rk1{border-color:rgba(46,224,127,.55);background:linear-gradient(90deg,rgba(46,224,127,.16),#1d2524 70%)}
  .g.hot{border-color:#2ee07f;background:linear-gradient(90deg,rgba(46,224,127,.32),rgba(46,224,127,.1));box-shadow:0 0 0 1px #2ee07f inset}
  .rk{font-family:"Barlow Condensed";color:#2ee07f;font-weight:800;margin-right:4px;font-size:18px}
  footer{position:absolute;left:${PAD}px;right:${PAD}px;bottom:0;height:${FOOT}px;display:flex;justify-content:space-between;align-items:center}
  footer b{font-family:"Barlow Condensed";font-size:40px;font-weight:800;font-style:italic;text-transform:uppercase}
  footer em{color:#2ee07f}
  .key{display:flex;gap:18px;font-size:17px;color:#8a9592;align-items:center}
  .key i{display:inline-block;width:18px;height:12px;border-radius:3px;margin-right:6px;vertical-align:-1px}
  footer .url{font-size:24px;color:#8a9592;font-weight:600}
  </style>
  <div class="top"><div><div class="k">${{ tv: 'TV GUIDE', streaming: 'STREAMING GUIDE', all: 'TV &amp; STREAMING GUIDE' }[mode]} ${sport.emoji}</div><h1>${esc(sport.name)}</h1></div>
    <div class="d"><b>${esc(day)}</b>All times ET</div></div>
  <div class="grid"><div class="times">${ticks.join('')}</div>${body}</div>
  <footer><b>${brand}</b><div class="key"><span><i style="background:#2ee07f"></i>Top 25 vs Top 25</span><span><i style="background:rgba(46,224,127,.35);border:1px solid #2ee07f"></i>Top 25</span></div><span class="url">${esc(SITE.url)}</span></footer>`;
}

(async () => {
  const out = path.join(__dirname, 'out');
  fs.mkdirSync(out, { recursive: true });
  for (const key of picked) {
    const sport = SPORTS[key];
    if (!sport) { console.error(`Unknown sport "${key}". Use: ${Object.keys(SPORTS).join(' ')}`); continue; }
    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${sport.path}/scoreboard?limit=500&dates=${date}${sport.q ? '&' + sport.q : ''}`);
    if (!res.ok) { console.error(`${key}: feed returned ${res.status}`); continue; }
    const events = (await res.json()).events;
    // Busy days get separate TV and streaming images; light days get one combined guide.
    const tvLanes = layout(events, sport.hours, 'tv').reduce((n, r) => n + r.lanes.length, 0);
    for (const mode of tvLanes < 5 ? ['all'] : ['tv', 'streaming']) {
      const rows = layout(events, sport.hours, mode);
      if (!rows.length) continue;
      const file = path.join(out, `${key}-${mode === 'streaming' ? 'streaming' : 'guide'}-${date}`);
      const page = html(sport, rows, mode);
      const h = Number(/height:(\d+)px;background/.exec(page)[1]);
      fs.writeFileSync(`${file}.html`, page);
      // 2x pixel density so the small text stays sharp when people zoom in on X.
      execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=2', '--virtual-time-budget=8000',
        `--window-size=${W},${h}`, `--screenshot=${file}.png`, `file://${file}.html`], { stdio: 'ignore' });
      fs.unlinkSync(`${file}.html`);
      console.log(`${key}: ${file}.png (${rows.length} channels, ${rows.reduce((n, r) => n + r.lanes.flat().length, 0)} games)`);
    }
  }
})();
