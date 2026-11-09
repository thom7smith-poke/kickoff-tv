// Daily X drafts: images + captions for every sport playing today.
// Usage: node social/daily.js [--date 20261114]
// Output: social/drafts/<YYYY-MM-DD>/<n>-<sport>/caption.txt + 1.png (+ 2.png = post as a reply)
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');

const SPORTS = {
  cfb: { name: 'college football', path: 'football/college-football', q: '&groups=80', tags: '#CollegeFootball #CFB', script: 'guide.js' },
  nfl: { name: 'the NFL', path: 'football/nfl', q: '', tags: '#NFL', script: 'make.js' },
  cbb: { name: "men's college hoops", path: 'basketball/mens-college-basketball', q: '&groups=50', tags: '#CollegeBasketball', script: 'guide.js' },
  nba: { name: 'the NBA', path: 'basketball/nba', q: '', tags: '#NBA', script: 'make.js' },
};

const args = process.argv.slice(2);
const di = args.indexOf('--date');
const date = di >= 0 ? args[di + 1]
  : new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date()).replace(/-/g, '');
const day = new Date(`${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6)}T12:00:00`);
const dayLabel = day.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
const time = d => new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }).replace(':00', '').replace(' ', '');

// Pick up to 3 games worth naming: ranked matchups first, then national TV.
function highlights(events) {
  return events.filter(e => e.status.type.state === 'pre').map(e => {
    const c = e.competitions[0];
    const [away, home] = [...c.competitors].sort((a, b) => (b.homeAway === 'away') - (a.homeAway === 'away'));
    const nets = [...new Set((c.geoBroadcasts || []).filter(g => g.market?.type === 'National').map(g => g.media.shortName))];
    const ranks = [away, home].map(t => t.curatedRank?.current).filter(r => r && r <= 25);
    const linear = nets.some(n => !/\+|peacock|prime|netflix|youtube|accnx/i.test(n));
    const name = t => { const r = t.curatedRank?.current; return `${r && r <= 25 ? `#${r} ` : ''}${t.team.shortDisplayName}`; };
    return { e, score: ranks.length * 10 - (ranks.length ? Math.min(...ranks) / 10 : 0) + (linear ? 2 : nets.length ? 1 : 0),
      line: `${name(away)} at ${name(home)} · ${time(e.date)} ET · ${nets[0] || 'Local TV'}` };
  }).sort((a, b) => b.score - a.score).slice(0, 3).sort((a, b) => new Date(a.e.date) - new Date(b.e.date));
}

function caption(sport, events) {
  const top = highlights(events);
  return [
    `📺 Where to watch ${sport.name} · ${dayLabel}`,
    '',
    ...top.map(h => `🔥 ${h.line}`),
    '',
    `All ${events.length} game${events.length === 1 ? '' : 's'}, every channel → link in bio`,
    sport.tags,
  ].join('\n');
}

(async () => {
  const outDir = path.join(__dirname, 'drafts', `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6)}`);
  fs.rmSync(outDir, { recursive: true, force: true });
  let n = 0;
  for (const [key, sport] of Object.entries(SPORTS)) {
    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${sport.path}/scoreboard?limit=500&dates=${date}${sport.q}`);
    if (!res.ok) { console.error(`${key}: feed returned ${res.status}, skipped`); continue; }
    const events = (await res.json()).events.filter(e => e.status.type.state !== 'post');
    if (!events.length) { console.log(`${key}: no games`); continue; }

    execFileSync('node', [path.join(__dirname, sport.script), key, '--date', date], { stdio: 'ignore' });
    const made = sport.script === 'guide.js'
      ? [`${key}-guide-${date}.png`, `${key}-streaming-${date}.png`] // TV guide first, streaming-only as the reply
      : [`${key}-${date}.png`];
    const imgs = made.map(f => path.join(__dirname, 'out', f)).filter(f => fs.existsSync(f));
    if (!imgs.length) { console.error(`${key}: no image made, skipped`); continue; }

    const dir = path.join(outDir, `${++n}-${key}`);
    fs.mkdirSync(dir, { recursive: true });
    imgs.forEach((f, i) => fs.copyFileSync(f, path.join(dir, `${i + 1}.png`)));
    fs.writeFileSync(path.join(dir, 'caption.txt'), caption(sport, events) + '\n');
    if (imgs.length > 1) fs.writeFileSync(path.join(dir, 'reply.txt'), 'Streaming-only games 👇\n');
    console.log(`${key}: ${dir} (${imgs.length} image${imgs.length > 1 ? 's' : ''})`);
  }
  if (n) {
    try { execFileSync('osascript', ['-e', `display notification "${n} post${n > 1 ? 's' : ''} ready for ${dayLabel}" with title "KikoffTV drafts"`]); } catch {}
  } else console.log('No games today, no drafts.');
})();
