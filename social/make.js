// Daily "where to watch" graphics for X.  Usage: node social/make.js [cfb nfl nba cbb] [--date 20261114]
// Writes social/out/<sport>-<date>.png (1080x1350). Sports with no games that day are skipped.
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');

const SITE = require('../config.js'); // name and address live in config.js
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const MAX_ROWS = 8;
const SPORTS = {
  cfb: { name: 'College Football', emoji: '🏈', path: 'football/college-football', q: 'groups=80' },
  nfl: { name: 'NFL', emoji: '🏈', path: 'football/nfl', q: '' },
  nba: { name: 'NBA', emoji: '🏀', path: 'basketball/nba', q: '' },
  cbb: { name: "Men's College Hoops", emoji: '🏀', path: 'basketball/mens-college-basketball', q: 'groups=50' },
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
    const r = t.curatedRank?.current, src = t.team.logo;
    return `${src ? `<img class="lg" src="${esc(src.replace('/500/', '/500-dark/'))}" onerror="this.onerror=null;this.src='${esc(src)}'" alt="">`
      : `<span class="dot" style="background:#${esc(t.team.color || "888")}"></span>`}${r && r <= 25 ? `<b class="rk">${r}</b>` : ''}${esc(t.team.shortDisplayName)}`;
  };
  const brand = /tv$/i.test(SITE.name) ? `${esc(SITE.name.slice(0, -2))}<em>${esc(SITE.name.slice(-2))}</em>` : esc(SITE.name);
  const rows = top.map(({ e, teams, t }) => `<div class="row">
      <div class="time">${e.status.type.state === 'in' ? '<span class="live">LIVE</span>' : time(e.date)}</div>
      <div class="m"><div>${team(teams[0])}</div><div class="at">${team(teams[1])}</div></div>
      <div class="tv ${t.national ? '' : 'loc'}">${esc(t.label)}</div></div>`).join('');
  return `<!doctype html><meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Barlow:wght@500;600;700&family=Barlow+Condensed:ital,wght@0,600;0,700;0,800;1,800&display=block" rel="stylesheet">
  <style>
  *{box-sizing:border-box;margin:0}
  body{width:1080px;height:1350px;background:#0a0d0c radial-gradient(900px 500px at 85% -10%,rgba(46,224,127,.18),transparent 70%);
    color:#f2f5f3;font-family:Barlow,system-ui,sans-serif;padding:60px 64px 0;display:flex;flex-direction:column}
  .cond{font-family:"Barlow Condensed","Arial Narrow",sans-serif}
  .k{font-family:"Barlow Condensed";font-size:34px;letter-spacing:.16em;font-weight:700;color:#2ee07f}
  h1{font-family:"Barlow Condensed";font-size:104px;line-height:.92;margin:6px 0 8px;font-weight:800;font-style:italic;text-transform:uppercase}
  .d{font-family:"Barlow Condensed";font-size:36px;font-weight:600;color:#8a9592;text-transform:uppercase;letter-spacing:.06em;margin-bottom:22px}
  .list{background:#121716;border:2px solid #232b29;border-radius:28px;padding:6px 34px;flex:1;margin-bottom:24px;display:flex;flex-direction:column;justify-content:${top.length > 6 ? 'space-between' : 'flex-start'}}
  .row{display:flex;align-items:center;gap:22px;padding:8px 0;border-bottom:2px solid #232b29}
  .row:last-child{border:0}
  .time{width:150px;font-family:"Barlow Condensed";font-size:34px;font-weight:700;color:#8a9592}
  .live{color:#ff4d4f}
  .m{flex:1;font-size:31px;font-weight:600;line-height:1.25}
  .at::before{content:"@ ";color:#5d6866;font-weight:500}
  .dot{display:inline-block;width:16px;height:16px;border-radius:50%;margin-right:12px;vertical-align:2px}
  .lg{width:46px;height:46px;object-fit:contain;vertical-align:middle;margin:-6px 14px 0 0}
  .rk{font-family:"Barlow Condensed";font-size:28px;font-weight:800;color:#2ee07f;margin-right:8px}
  .tv{font-family:"Barlow Condensed";font-size:32px;font-weight:800;text-transform:uppercase;letter-spacing:.03em;background:#2ee07f;color:#03140a;padding:8px 18px;border-radius:12px;max-width:330px;text-align:center;line-height:1.1}
  .tv.loc{background:#1a201f;color:#8a9592;font-weight:700;font-size:26px}
  .more{font-family:"Barlow Condensed";font-size:30px;font-weight:700;color:#8a9592;text-align:center;padding:10px 0 6px;text-transform:uppercase;letter-spacing:.06em}
  footer{display:flex;justify-content:space-between;align-items:center;height:110px}
  footer b{font-family:"Barlow Condensed";font-size:48px;font-weight:800;font-style:italic;text-transform:uppercase}
  footer em{color:#2ee07f}
  footer span{font-size:28px;color:#8a9592;font-weight:600}
  </style>
  <div class="k">WHERE TO WATCH ${sport.emoji}</div><h1>${esc(sport.name)}</h1><div class="d">${esc(day)} · Times ET</div>
  <div class="list">${rows}${more > 0 ? `<div class="more">+${more} more games today</div>` : ''}</div>
  <footer><b>${brand}</b><span>${esc(SITE.url)}</span></footer>`;
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
    execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--virtual-time-budget=6000', '--window-size=1080,1350',
      `--screenshot=${file}.png`, `file://${file}.html`], { stdio: 'ignore' });
    fs.unlinkSync(`${file}.html`);
    console.log(`${key}: ${file}.png (${top.length} games${more > 0 ? `, +${more} more` : ''})`);
  }
})();
