const SPORTS = {
  cfb: { label: 'College Football', path: 'football/college-football', q: '&groups=80' },
  nfl: { label: 'NFL', path: 'football/nfl', q: '' },
  nba: { label: 'NBA', path: 'basketball/nba', q: '', daily: true },
};
const $ = id => document.getElementById(id);
const svcName = Object.fromEntries(SERVICES.map(s => [s.id, s.name]));
const svcUrl = Object.fromEntries(SERVICES.map(s => [s.id, s.url]));

const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

let mine = load('services', null);
let favs = load('favs', []);
let sport = SPORTS[load('sport')] ? load('sport') : 'cfb';
let filter = 'all', weeks = [], weekIdx = -1, day = null, homeNav = null, events = [], timer = null, openId = null;

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const fmtDay = (d, o) => new Date(d).toLocaleDateString([], o);
const fmtTime = d => new Date(d).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

document.title = `${SITE.name}: ${SITE.tagline}`;
$('site-name').textContent = `📺 ${SITE.name}`;

const ymd = d => d.toISOString().slice(0, 10).replace(/-/g, '');
const dayDate = s => new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6)}T12:00:00`);

// Football pages by week, NBA by day. ESPN picks the current week/day when no params are sent.
async function fetchGames(quiet) {
  const sp = SPORTS[sport], w = weeks[weekIdx], want = sport;
  if (!quiet) $('games').innerHTML = '<p class="msg">Loading games…</p>';
  try {
    const params = sp.daily ? (day ? `&dates=${day}` : '') : (w ? `&seasontype=${w.type}&week=${w.week}` : '');
    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${sp.path}/scoreboard?limit=300${sp.q}${params}`);
    if (!res.ok) throw new Error(res.status);
    const d = await res.json();
    if (want !== sport) return; // user switched sport mid-load
    if (sp.daily && !day) day = (d.day?.date || new Date().toISOString().slice(0, 10)).replace(/-/g, '');
    if (sp.daily && !homeNav) homeNav = day;
    if (!sp.daily && !weeks.length) {
      weeks = d.leagues[0].calendar.filter(s => ['2', '3'].includes(s.value) && s.entries)
        .flatMap(s => s.entries.map(e => ({ type: s.value, week: e.value, label: e.label, start: e.startDate, end: e.endDate })));
      weekIdx = weeks.findIndex(x => x.type == d.season.type && x.week == d.week?.number);
      homeNav = weekIdx;
    }
    events = d.events;
    render();
    if (openId) showGame(openId);
    clearInterval(timer);
    if (events.some(e => e.status.type.state === 'in')) timer = setInterval(() => fetchGames(true), 60000);
  } catch {
    if (!quiet) $('games').innerHTML = '<p class="msg">Couldn\'t load games. Check your connection and try again.</p>';
  }
  navLabel();
}

function navLabel() {
  const away = homeNav !== null && (SPORTS[sport].daily ? day !== homeNav : weekIdx !== homeNav);
  $('today').hidden = !away;
  $('today').textContent = SPORTS[sport].daily ? '↺ Today' : '↺ This week';
  const short = d => fmtDay(d, { month: 'short', day: 'numeric' });
  if (SPORTS[sport].daily) {
    const today = ymd(new Date(Date.now() - new Date().getTimezoneOffset() * 60000));
    const rel = { [today]: 'Today', [ymd(new Date(dayDate(today).getTime() + 864e5))]: 'Tomorrow', [ymd(new Date(dayDate(today).getTime() - 864e5))]: 'Yesterday' };
    $('week-label').innerHTML = day ? `${rel[day] || fmtDay(dayDate(day), { weekday: 'long' })}<small>${short(dayDate(day))}</small>` : 'Today';
    $('prev').disabled = $('next').disabled = !day;
    return;
  }
  const cur = weeks[weekIdx];
  $('week-label').innerHTML = cur ? `${esc(cur.label)}<small>${short(cur.start)} – ${short(new Date(cur.end) - 1)}</small>` : 'This week';
  $('prev').disabled = weekIdx <= 0;
  $('next').disabled = weekIdx < 0 || weekIdx >= weeks.length - 1;
}

function step(n) {
  if (SPORTS[sport].daily) day = ymd(new Date(dayDate(day).getTime() + n * 864e5));
  else weekIdx += n;
  fetchGames();
}

function setSport(s) {
  sport = s; save('sport', s);
  weeks = []; weekIdx = -1; day = null; homeNav = null; events = [];
  document.querySelectorAll('[data-sport]').forEach(b => b.setAttribute('aria-selected', b.dataset.sport === s));
  $('top25').hidden = s !== 'cfb';
  if (filter === 'top25' && s !== 'cfb') document.querySelector('[data-filter="all"]').click();
  $('search').placeholder = `Search ${SPORTS[s].label} teams`;
  fetchGames();
}

// Light/dark logo with a colored dot when the team has no logo.
const logo = (t, cls = 'logo') => t.logo
  ? `<picture><source srcset="${esc(t.logo.replace('/500/', '/500-dark/'))}" media="(prefers-color-scheme: dark)"><img class="${cls}" src="${esc(t.logo)}" alt="" loading="lazy"></picture>`
  : `<span class="dot" style="background:#${esc(t.color || '888')}"></span>`;
const rank = c => { const r = c.curatedRank?.current; return r && r <= 25 ? r : null; };
const isLocal = g => ['Home', 'Away'].includes(g.market?.type);
const bc = c => (c.geoBroadcasts || c.broadcasts || []).filter(g => g.media); // scoreboard vs team schedule feeds
const nets = c => [...new Set(bc(c).filter(g => !isLocal(g)).map(g => g.media.shortName))];
const locals = c => [...new Set(bc(c).filter(isLocal).map(g => g.media.shortName))];
const sides = c => [...c.competitors].sort((a, b) => (b.homeAway === 'away') - (a.homeAway === 'away'));
const statusText = (e, long) => {
  const st = e.status.type;
  if (st.state === 'pre') return long ? `${fmtDay(e.date, { weekday: 'long', month: 'short', day: 'numeric' })} · ${fmtTime(e.date)}` : fmtTime(e.date);
  return st.state === 'in' ? `LIVE · ${st.shortDetail}` : st.shortDetail;
};

function gameRow(e, showDay) {
  const c = e.competitions[0], st = e.status.type, n = nets(c);
  const w = whereToWatch(n, mine || []);
  const ok = w.yours.length || w.free;
  const team = t => `<span class="team${st.completed && !t.winner ? ' lost' : ''}">${logo(t.team)}
      <span class="nm">${rank(t) ? `<span class="rk">${rank(t)}</span>` : ''}${esc(t.team.shortDisplayName)}</span>
      ${st.state !== 'pre' ? `<span class="sc">${esc(t.score)}</span>` : ''}</span>`;
  return `<button class="game" data-id="${esc(e.id)}" aria-label="${esc(e.name)}, ${esc(statusText(e))}, ${esc(n.join(', ') || 'TV to be announced')}">
    <span class="time${st.state === 'in' ? ' live' : ''}">${showDay && st.state === 'pre' ? `${fmtDay(e.date, { weekday: 'short' })}<br>` : ''}${st.state === 'in' ? 'LIVE' : esc(statusText(e))}</span>
    <span class="teams">${sides(c).map(team).join('')}</span>
    <span class="tv${ok ? ' ok' : ''}">${ok ? '✓ ' : ''}${esc(n[0] || (locals(c).length ? 'Local TV' : 'TBA'))}${n.length > 1 ? ` +${n.length - 1}` : ''}</span>
  </button>`;
}

function showGame(id) {
  const e = events.find(x => x.id === id);
  if (!e) return;
  openId = id;
  const c = e.competitions[0], st = e.status.type, n = nets(c);
  const w = whereToWatch(n, mine || []);
  const side = t => {
    const fav = favs.includes(t.team.id);
    return `<div class="side">${logo(t.team, '')}
      <b>${rank(t) ? `<span class="rk">${rank(t)}</span>` : ''}${esc(t.team.shortDisplayName)}</b>
      <div class="sub">${esc(t.records?.[0]?.summary || '')}</div>
      ${st.state !== 'pre' ? `<div class="big">${esc(t.score)}</div>` : ''}
      <button class="follow" data-team="${esc(t.team.id)}" aria-pressed="${fav}">${fav ? '★ Following' : '☆ Follow'}</button></div>`;
  };
  const [away, home] = sides(c);
  const loc = locals(c);
  let watch = n.length ? `<div class="nets">${n.map(x => `<span>${esc(x)}</span>`).join('')}</div>`
    : loc.length ? '' : '<p class="no">TV channel not announced yet.</p>';
  if (loc.length) watch += `<p class="no"><b>Local TV:</b> ${loc.map(esc).join(', ')}. Shown in each team's home area on cable,
    satellite or the team's own streaming app.${sport === 'nba' ? ' Outside those areas, use NBA League Pass.' : ''}</p>`;
  if (w.yours.length) watch += `<div class="yes">✓ You can watch with ${w.yours.map(id => esc(svcName[id])).join(', ')}</div>`;
  else if (w.free) watch += `<div class="yes">✓ ${esc(w.free)}</div>`;
  else if (n.length) watch += `<p class="no">${mine?.length ? 'Not on your services.' : 'Tell us your services to see if you can watch.'}</p>`;
  const opts = w.options.filter(id => svcUrl[id]);
  if (!w.yours.length && opts.length) watch += `<div class="opts">${opts.map(id =>
    `<a href="${esc(svcUrl[id])}" target="_blank" rel="sponsored noopener">Watch with ${esc(svcName[id])}</a>`).join('')}</div>`;
  if (w.unknown.length) watch += `<p class="no">Check ${w.unknown.map(esc).join(', ')} for how to stream.</p>`;
  if (st.completed) watch = n.length ? `<div class="nets">${n.map(x => `<span>${esc(x)}</span>`).join('')}</div>` : loc.length ? `<p class="no">Local TV: ${loc.map(esc).join(', ')}</p>` : '';

  // The scoreboard drops odds once a game starts; the game summary keeps the last pre-game line.
  if (!c.odds?.length && !extra.has(id)) {
    extra.set(id, 'loading');
    fetch(`https://site.api.espn.com/apis/site/v2/sports/${SPORTS[sport].path}/summary?event=${id}`)
      .then(r => r.json()).then(s => { extra.set(id, s.pickcenter?.[0] || null); if (openId === id) showGame(id); })
      .catch(() => extra.delete(id));
  }
  const pending = extra.get(id) === 'loading';
  const v = c.venue, odds = c.odds?.[0] || (pending ? null : extra.get(id)), start = sport === 'nba' ? 'Tipoff' : 'Kickoff';
  const res = st.completed && odds && lineResult(odds.details, odds.overUnder,
    [away, home].map(t => ({ abbr: t.team.abbreviation, name: t.team.shortDisplayName, score: Number(t.score) })));
  const rows = [
    [start, `${fmtDay(e.date, { weekday: 'short', month: 'short', day: 'numeric' })}, ${fmtTime(e.date)}`],
    ['Stadium', v && (v.fullName?.includes(v.address?.city) ? v.fullName
      : [v.fullName, [v.address?.city, v.address?.state].filter(Boolean).join(', ')].filter(Boolean).join(' · '))],
    [st.state === 'pre' ? 'Line' : `Line at ${start.toLowerCase()}`,
      odds ? [odds.details, odds.overUnder && `O/U ${odds.overUnder}`].filter(Boolean).join(' · ') : pending ? 'Loading…' : null],
    ['Result', res && [res.spread, res.total].filter(Boolean).join(' · ')],
    ['Weather', e.weather && [e.weather.displayValue, e.weather.temperature && `${e.weather.temperature}°`].filter(Boolean).join(', ')],
  ].filter(([, val]) => val);

  $('game-body').innerHTML = `
    <div class="status${st.state === 'in' ? ' live' : ''}">${esc(statusText(e, true))}</div>
    ${c.notes?.[0]?.headline ? `<div class="note">${esc(c.notes[0].headline)}</div>` : ''}
    <div class="match">${side(away)}<div class="vs">${c.neutralSite ? 'vs' : '@'}</div>${side(home)}</div>
    ${watch ? `<div class="sec"><h4>${st.completed ? 'Aired on' : 'Where to watch'}</h4>${watch}</div>` : ''}
    ${rows.length ? `<div class="sec"><h4>Game info</h4><dl>${rows.map(([k, val]) => `<dt>${k}</dt><dd>${esc(val)}</dd>`).join('')}</dl></div>` : ''}
    <div class="sec"><h4>Watch the whole season</h4><div class="opts">${[away, home].map(t =>
      `<button data-plan="${esc(t.team.id)}">Cheapest way to watch ${esc(t.team.shortDisplayName)}</button>`).join('')}</div></div>
    <div class="acts">${st.state === 'pre' ? '<button data-act="cal">📅 Add to calendar</button>' : ''}<button data-act="share">↗ Share</button></div>`;
  if (!$('game').open) $('game').showModal();
}

const extra = new Map(); // game id -> pre-game line from the summary feed ('loading' while fetching, null if none)

function addToCalendar(e) {
  const c = e.competitions[0], start = new Date(e.date);
  const end = new Date(start.getTime() + (sport === 'nba' ? 2.5 : 3.5) * 36e5);
  const t = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const ic = s => String(s).replace(/[\\,;]/g, m => `\\${m}`);
  const tv = [...nets(c), ...locals(c)].join(', ') || 'TV to be announced';
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:-//${SITE.name}//EN`, 'BEGIN:VEVENT', `UID:${e.id}@${SITE.url}`,
    `DTSTAMP:${t(new Date())}`, `DTSTART:${t(start)}`, `DTEND:${t(end)}`, `SUMMARY:${ic(`${e.shortName} on ${tv}`)}`,
    `LOCATION:${ic(c.venue?.fullName || '')}`, `DESCRIPTION:${ic(`Watch on ${tv}. https://${SITE.url}`)}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  a.download = `${e.shortName.replace(/\W+/g, '-')}.ics`;
  a.click();
}

async function shareGame(e, btn) {
  const c = e.competitions[0], [away, home] = sides(c);
  const score = e.status.type.state === 'pre' ? '' : ` ${away.team.abbreviation} ${away.score}, ${home.team.abbreviation} ${home.score} ·`;
  const text = `${e.shortName} ·${score} ${statusText(e, true)} · ${nets(c).join(', ') || 'Local TV'}`;
  const url = location.href.split('#')[0];
  try {
    if (navigator.share) await navigator.share({ title: SITE.name, text, url });
    else { await navigator.clipboard.writeText(`${text}\n${url}`); btn.textContent = '✓ Copied'; }
  } catch {} // user cancelled the share sheet
}

const canWatch = e => { const w = whereToWatch(nets(e.competitions[0]), mine || []); return w.yours.length > 0 || !!w.free; };
const isFav = e => e.competitions[0].competitors.some(c => favs.includes(c.team.id));

function render() {
  const q = $('search').value.trim().toLowerCase();
  const list = events.filter(e => {
    const cs = e.competitions[0].competitors;
    if (q && !cs.some(c => `${c.team.displayName} ${c.team.abbreviation}`.toLowerCase().includes(q))) return false;
    if (filter === 'mine' && !canWatch(e)) return false;
    if (filter === 'top25' && !cs.some(rank)) return false;
    return true;
  }).sort((a, b) => new Date(a.date) - new Date(b.date));

  if (!list.length) { $('games').innerHTML = `<p class="empty">${filter === 'mine' && !mine?.length ? 'Pick your services to see what you can watch.' : 'No games match.'}</p>`; return; }
  const day = e => fmtDay(e.date, { weekday: 'long', month: 'short', day: 'numeric' });
  const ranked = e => e.competitions[0].competitors.some(rank);
  const live = e => e.status.type.state === 'in';
  const rest = list.filter(e => !live(e));
  const groups = [['Live now', list.filter(live)], ['Your teams', rest.filter(isFav)], ['Top 25', rest.filter(e => !isFav(e) && ranked(e))]];
  for (const e of rest.filter(e => !isFav(e) && !ranked(e))) {
    const g = groups.find(([k]) => k === day(e));
    g ? g[1].push(e) : groups.push([day(e), [e]]);
  }
  $('games').innerHTML = groups.filter(([, es]) => es.length)
    .map(([k, es]) => `<h2>${esc(k)}</h2><div class="day">${es.map(e => gameRow(e, k === 'Your teams' || k === 'Top 25')).join('')}</div>`).join('');
}

function openServices() {
  const sel = mine || [];
  $('svc-list').innerHTML = SERVICES.map(s =>
    `<button class="chip" data-svc="${s.id}" aria-pressed="${sel.includes(s.id)}">${esc(s.name)}</button>`).join('');
  $('services').showModal();
}

$('svc-list').addEventListener('click', e => {
  const b = e.target.closest('[data-svc]');
  if (b) b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') !== 'true');
});
$('services').addEventListener('close', () => {
  mine = [...$('svc-list').querySelectorAll('[aria-pressed="true"]')].map(b => b.dataset.svc);
  save('services', mine);
  render();
});
$('svc-done').addEventListener('click', () => $('services').close());
$('open-services').addEventListener('click', openServices);
$('search').addEventListener('input', render);
document.querySelector('.filters').addEventListener('click', e => {
  const b = e.target.closest('[data-filter]');
  if (!b) return;
  filter = b.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach(x => x.setAttribute('aria-pressed', x === b));
  render();
});
$('games').addEventListener('click', e => { const b = e.target.closest('.game'); if (b) showGame(b.dataset.id); });
$('game').addEventListener('click', e => {
  if (e.target === $('game') || e.target.closest('.close')) return $('game').close(); // backdrop or ✕
  const act = e.target.closest('[data-act]')?.dataset.act, game = events.find(x => x.id === openId);
  if (act === 'cal') return addToCalendar(game);
  if (act === 'share') return shareGame(game, e.target.closest('[data-act]'));
  const pl = e.target.closest('[data-plan]');
  if (pl) { $('game').close(); return showPlan(pl.dataset.plan); }
  const f = e.target.closest('.follow');
  if (!f) return;
  const id = f.dataset.team;
  favs = favs.includes(id) ? favs.filter(x => x !== id) : [...favs, id];
  save('favs', favs);
  render();
  showGame(openId);
});
$('game').addEventListener('close', () => { openId = null; });
$('today').addEventListener('click', () => { if (SPORTS[sport].daily) day = homeNav; else weekIdx = homeNav; fetchGames(); });
$('prev').addEventListener('click', () => step(-1));
$('next').addEventListener('click', () => step(1));
$('sports').addEventListener('click', e => { const b = e.target.closest('[data-sport]'); if (b && b.dataset.sport !== sport) setSport(b.dataset.sport); });

let installEvt;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; $('install').hidden = false; });
$('install').addEventListener('click', () => { installEvt?.prompt(); $('install').hidden = true; });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');

setSport(sport);
if (mine === null) openServices();

// ---- Season plan: cheapest way to watch one team's remaining games ----
const BASE = 'https://site.api.espn.com/apis/site/v2/sports';
const teamLists = {};
const money = n => `$${n.toFixed(2)}`;

async function openPicker() {
  $('team-q').value = '';
  $('picker').showModal();
  if (!teamLists[sport]) {
    $('team-list').innerHTML = '<p class="msg">Loading teams…</p>';
    try {
      const d = await (await fetch(`${BASE}/${SPORTS[sport].path}/teams?limit=1000${SPORTS[sport].q}`)).json();
      teamLists[sport] = d.sports[0].leagues[0].teams.map(({ team: t }) => ({ id: t.id, name: t.displayName, logo: t.logos?.[0]?.href, color: t.color }))
        .sort((a, b) => (favs.includes(b.id) - favs.includes(a.id)) || a.name.localeCompare(b.name));
    } catch { $('team-list').innerHTML = '<p class="msg">Couldn\'t load teams. Try again.</p>'; return; }
  }
  listTeams();
}

function listTeams() {
  const q = $('team-q').value.trim().toLowerCase();
  const list = (teamLists[sport] || []).filter(t => t.name.toLowerCase().includes(q)).slice(0, 60);
  $('team-list').innerHTML = list.length ? list.map(t => `<button data-team-pick="${esc(t.id)}">${logo(t)}<span>${esc(t.name)}</span>${favs.includes(t.id) ? '<span class="rk">★</span>' : ''}</button>`).join('')
    : '<p class="msg">No teams match.</p>';
}

async function showPlan(teamId) {
  $('plan-body').innerHTML = '<p class="msg">Checking the schedule…</p>';
  if (!$('plan').open) $('plan').showModal();
  let d;
  try { d = await (await fetch(`${BASE}/${SPORTS[sport].path}/teams/${teamId}/schedule`)).json(); }
  catch { $('plan-body').innerHTML = '<p class="msg">Couldn\'t load the schedule. Try again.</p>'; return; }
  const team = d.team, logoT = { logo: team.logo || team.logos?.[0]?.href, color: team.color };
  const games = (d.events || []).filter(e => e.competitions[0].status.type.state === 'pre');
  const p = cheapestPlan(games.map(e => nets(e.competitions[0])), mine || []);
  // The team's own local channel (mostly NBA): broadcasts tagged with this team's home/away side.
  const ownLocal = e => {
    const c = e.competitions[0], side = c.competitors.find(x => x.id === team.id)?.homeAway;
    return [...new Set(bc(c).filter(g => g.market?.type?.toLowerCase() === side).map(g => g.media.shortName))];
  };
  const localOnly = games.filter(e => !nets(e.competitions[0]).length && ownLocal(e).length);
  const localNames = [...new Set(localOnly.flatMap(ownLocal))].slice(0, 2);
  const tba = p.noTv - localOnly.length;
  const coveredBy = n => {
    if (whereToWatch(n, []).free) return whereToWatch(n, []).free;
    const hit = p.plan.find(x => whereToWatch(n, [x.id]).yours.length);
    return hit ? svcName[hit.id] : '';
  };

  const gamesWithTv = p.coverable + p.free === 1 ? 'the 1 game' : `all ${p.coverable + p.free} games`;
  let body;
  if (!games.length) body = '<p class="no">No games left on the schedule.</p>';
  else if (!p.coverable && !p.free) body = `<p class="no">None of the remaining games have a national TV channel yet. Channels are usually announced 1–2 weeks ahead, so check back.</p>`;
  else if (p.plan.every(x => x.owned)) body = `<div class="best"><div class="amt">✓ You're set</div><p>Your services cover ${gamesWithTv} that ${p.coverable + p.free === 1 ? 'has' : 'have'} a TV channel.</p></div>`;
  else body = `<div class="best">
      <div class="lbl">Cheapest plan</div><div class="amt">${p.monthly ? `${money(p.monthly)}<small>/mo</small>` : 'Free'}</div>
      <p>Covers ${gamesWithTv} with a TV channel${p.yoursCover ? `, using what you already have` : ''}.</p>
      ${p.plan.map(x => `<div class="pl"><span><b>${esc(svcName[x.id])}</b><small>${x.covers} game${x.covers === 1 ? '' : 's'}</small></span>
        ${x.owned ? '<span class="have">You have it</span>' : svcUrl[x.id]
          ? `<a href="${esc(svcUrl[x.id])}" target="_blank" rel="sponsored noopener">${x.price ? `${money(x.price)}/mo` : 'Free'} ›</a>` : ''}</div>`).join('')}
    </div>
    ${p.plan.filter(x => !x.owned).length > 1 && p.singles.length ? `<div class="sec"><h4>Or just one ${p.yoursCover ? 'more ' : ''}service</h4><div class="opts">${p.singles.map(x =>
      `<a href="${esc(svcUrl[x.id])}" target="_blank" rel="sponsored noopener"><span>${esc(svcName[x.id])} · ${x.covers} of ${p.coverable} games</span><span class="pr">${money(x.price)}/mo</span></a>`).join('')}</div></div>` : ''}`;

  const notes = [
    p.free && `${p.free} game${p.free === 1 ? ' is' : 's are'} free on The CW app.`,
    localOnly.length && `${localOnly.length} game${localOnly.length === 1 ? ' is' : 's are'} only on local TV (${localNames.map(esc).join(', ')}). In the team's area, get it through cable, satellite or the channel's own app.${sport === 'nba' ? ' Elsewhere, use NBA League Pass.' : ''}`,
    tba > 0 && `${tba} game${tba === 1 ? ' has' : 's have'} no TV channel announced yet. We'll include ${tba === 1 ? 'it' : 'them'} once announced.`,
  ].filter(Boolean);

  const row = e => {
    const c = e.competitions[0], me = c.competitors.find(x => x.id === team.id), opp = c.competitors.find(x => x.id !== team.id);
    const n = nets(c), by = n.length ? coveredBy(n) : '';
    return `<li><span class="when">${fmtDay(e.date, { month: 'short', day: 'numeric' })}</span>
      <span class="opp">${me?.homeAway === 'away' ? '@' : 'vs'} ${esc(opp?.team.shortDisplayName || 'TBD')}</span>
      <span class="ch">${esc(n.join(', ') || (ownLocal(e).length ? 'Local TV' : 'TBA'))}${by ? `<small>${esc(by)}</small>` : ''}</span></li>`;
  };

  $('plan-body').innerHTML = `
    <div class="plan-head">${logo(logoT, 'big')}<div><h3>Cheapest way to watch ${esc(team.displayName)}</h3>
      <p>${games.length} game${games.length === 1 ? '' : 's'} left${mine?.length ? '' : ' · <button class="link" data-act="svc">add your services</button> to count what you have'}</p></div></div>
    ${body}
    ${notes.length ? `<ul class="notes">${notes.map(x => `<li>${x}</li>`).join('')}</ul>` : ''}
    ${games.length ? `<details class="sec"><summary>See all ${games.length} games</summary><ul class="sched">${games.map(row).join('')}</ul></details>` : ''}
    <p class="fine">Prices as of ${PRICES_AS_OF}, before taxes and promos. A TV antenna is a one-time buy (about $30). Confirm channels with each provider.</p>`;
}

for (const id of ['plan', 'picker']) $(id).addEventListener('click', e => {
  if (e.target === $(id) || e.target.closest('.close')) return $(id).close();
  if (e.target.closest('[data-act="svc"]')) { $(id).close(); openServices(); }
});
$('team-q').addEventListener('input', listTeams);
$('team-list').addEventListener('click', e => {
  const b = e.target.closest('[data-team-pick]');
  if (b) { $('picker').close(); showPlan(b.dataset.teamPick); }
});
$('open-plan').addEventListener('click', openPicker);
