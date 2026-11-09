// Daily "where to watch" graphics for X.  Usage: node social/make.js [cfb nfl nba cbb] [--date 20261114]
// Writes social/out/<sport>-<date>.png (1080x1350). Sports with no games that day are skipped.
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');

const SITE = 'thom7smith-poke.github.io/kickoff-tv'; // change if you buy a domain
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const MAX_ROWS = 8;
const SPORTS = {
  cfb: { name: 'College Football', path: 'football/college-football', q: 'groups=80' },
  nfl: { name: 'NFL', path: 'football/nfl', q: '' },
  nba: { name: 'NBA', path: 'basketball/nba', q: '' },
  cbb: { name: "Men's College Hoops", path: 'basketball/mens-college-basketball', q: 'groups=50' },
};

const args = process.argv.slice(2);
const di = args.indexOf('--date');
const date = di >= 0 ? args.splice(di, 2)[1]
  : new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date()).replace(/-/g, '');
const picked = args.length ? args : Object.keys(SPORTS);
const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

// National channels if any; otherwise the local ones, marked local.
function tv(c) {
  const g = c.geoBroadcasts || [];
  const nat = [...new Set(g.filter(b => b.market?.type === 'National').map(b => b.media.shortName))];
  if (nat.length) return { label: nat.slice(0, 2).join(' / '), national: true };
  const local = [...new Set(g.map(b => b.media.shortName))];
  return { label: local.length ? `${local[0]} (local)` : 'TBA', national: false };
}

function pick(events) {
  const rows = events.filter(e => e.status.type.state !== 'post').map(e => {
    const c = e.competitions[0];
    const teams = [...c.competitors].sort((a, b) => (a.homeAway === 'away' ? -1 : 1));
    const ranked = teams.filter(t => t.curatedRank?.current <= 25).length;
    const t = tv(c);
    return { e, teams, t, score: ranked * 2 + (t.national && !/\+|YouTube|Flo/i.test(t.label) ? 1 : 0) };
  });
  const top = [...rows].sort((a, b) => b.score - a.score).slice(0, MAX_ROWS);
  top.sort((a, b) => new Date(a.e.date) - new Date(b.e.date));
  return { top, more: rows.length - top.length };
}

function html(sport, top, more) {
  const day = new Date(`${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6)}T12:00:00`)
    .toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  const time = d => new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });
  const team = t => {
    const r = t.curatedRank?.current;
    return `<span class="dot" style="background:#${esc(t.team.color || '888')}"></span>${r && r <= 25 ? `<b class="rk">${r}</b>` : ''}${esc(t.team.shortDisplayName)}`;
  };
  const rows = top.map(({ e, teams, t }) => `<div class="row">
      <div class="time">${e.status.type.state === 'in' ? 'LIVE' : time(e.date)}</div>
      <div class="m"><div>${team(teams[0])}</div><div class="at">${team(teams[1])}</div></div>
      <div class="tv ${t.national ? '' : 'loc'}">${esc(t.label)}</div></div>`).join('');
  return `<!doctype html><meta charset="utf-8"><style>
  *{box-sizing:border-box;margin:0}
  body{width:1080px;height:1350px;background:#0f3d2e;color:#fff;font-family:-apple-system,"SF Pro Display",system-ui,sans-serif;padding:64px 64px 0;display:flex;flex-direction:column}
  .k{font-size:28px;letter-spacing:.18em;font-weight:700;color:#9fd3b8}
  h1{font-size:76px;line-height:1;margin:14px 0 6px;letter-spacing:-.02em}
  .d{font-size:32px;color:#cfe5d9;margin-bottom:34px}
  .list{background:#fff;color:#16191a;border-radius:28px;padding:10px 34px;flex:1;margin-bottom:28px;display:flex;flex-direction:column;justify-content:${top.length > 6 ? 'space-between' : 'flex-start'}}
  .row{display:flex;align-items:center;gap:22px;padding:12px 0;border-bottom:2px solid #eef0ec}
  .row:last-child{border:0}
  .time{width:150px;font-size:28px;font-weight:700;color:#4a5356}
  .m{flex:1;font-size:31px;font-weight:650;line-height:1.3}
  .at{color:#16191a}.at::before{content:"@ ";color:#9aa3a5;font-weight:500}
  .dot{display:inline-block;width:16px;height:16px;border-radius:50%;margin-right:12px;vertical-align:2px}
  .rk{font-size:22px;color:#7a8487;margin-right:8px}
  .tv{font-size:26px;font-weight:800;background:#0f3d2e;color:#fff;padding:10px 18px;border-radius:12px;max-width:330px;text-align:center}
  .tv.loc{background:#eef0ec;color:#4a5356;font-weight:650}
  .more{font-size:26px;color:#636b6e;text-align:center;padding:14px 0 6px}
  footer{display:flex;justify-content:space-between;align-items:center;height:110px;font-size:30px;font-weight:700}
  footer span{color:#9fd3b8;font-weight:600}
  </style>
  <div class="k">WHERE TO WATCH</div><h1>${esc(sport.name)}</h1><div class="d">${esc(day)} · Times ET</div>
  <div class="list">${rows}${more > 0 ? `<div class="more">+${more} more games today</div>` : ''}</div>
  <footer>🏈 Kickoff TV<span>${SITE}</span></footer>`;
}

(async () => {
  const out = path.join(__dirname, 'out');
  fs.mkdirSync(out, { recursive: true });
  for (const key of picked) {
    const sport = SPORTS[key];
    if (!sport) { console.error(`Unknown sport "${key}". Use: ${Object.keys(SPORTS).join(' ')}`); continue; }
    const url = `https://site.api.espn.com/apis/site/v2/sports/${sport.path}/scoreboard?limit=400&dates=${date}${sport.q ? '&' + sport.q : ''}`;
    const res = await fetch(url);
    if (!res.ok) { console.error(`${key}: feed returned ${res.status}`); continue; }
    const { top, more } = pick((await res.json()).events);
    if (!top.length) { console.log(`${key}: no games ${date}, skipped`); continue; }
    const file = path.join(out, `${key}-${date}`);
    fs.writeFileSync(`${file}.html`, html(sport, top, more));
    execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--window-size=1080,1350',
      `--screenshot=${file}.png`, `file://${file}.html`], { stdio: 'ignore' });
    fs.unlinkSync(`${file}.html`);
    console.log(`${key}: ${file}.png (${top.length} games${more > 0 ? `, +${more} more` : ''})`);
  }
})();
