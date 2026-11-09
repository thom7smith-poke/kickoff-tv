const API = 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?groups=80&limit=300';
const $ = id => document.getElementById(id);
const svcName = Object.fromEntries(SERVICES.map(s => [s.id, s.name]));
const svcUrl = Object.fromEntries(SERVICES.map(s => [s.id, s.url]));

const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

let mine = load('services', null);
let favs = load('favs', []);
let filter = 'all', weeks = [], weekIdx = -1, events = [], timer = null;

const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

async function fetchWeek(w) {
  $('games').innerHTML = '<p class="msg">Loading games…</p>';
  try {
    const res = await fetch(w ? `${API}&seasontype=${w.type}&week=${w.week}` : API);
    if (!res.ok) throw new Error(res.status);
    const d = await res.json();
    if (!weeks.length) {
      weeks = d.leagues[0].calendar.filter(s => s.value !== '4')
        .flatMap(s => s.entries.map(e => ({ type: s.value, week: e.value, label: e.label })));
      weekIdx = weeks.findIndex(x => x.type == d.season.type && x.week == d.week?.number);
    }
    events = d.events;
    render();
    clearInterval(timer);
    if (events.some(e => e.status.type.state === 'in')) timer = setInterval(() => fetchWeek(weeks[weekIdx]), 60000);
  } catch (err) {
    console.error(err);
    $('games').innerHTML = '<p class="msg">Couldn\'t load games. Check your connection and try again.</p>';
  }
  const w2 = weeks[weekIdx];
  $('week-label').textContent = w2 ? w2.label : 'This week';
  $('prev').disabled = weekIdx <= 0;
  $('next').disabled = weekIdx < 0 || weekIdx >= weeks.length - 1;
}

function teamRow(c, pre) {
  const t = c.team, rank = c.curatedRank?.current;
  const fav = favs.includes(t.id);
  return `<div class="team">
    <span class="dot" style="background:#${esc(t.color || '888')}"></span>
    <span class="name">${rank && rank <= 25 ? `<span class="rank">${rank}</span>` : ''}${esc(t.shortDisplayName)}
      <span class="rec">${esc(c.records?.[0]?.summary || '')}</span></span>
    ${!pre && c.score !== undefined ? `<span class="score">${esc(c.score)}</span>` : ''}
    <button class="star" data-team="${esc(t.id)}" aria-pressed="${fav}" aria-label="${fav ? 'Unfavorite' : 'Favorite'} ${esc(t.shortDisplayName)}">${fav ? '★' : '☆'}</button>
  </div>`;
}

function gameCard(e) {
  const c = e.competitions[0], st = e.status.type;
  const nets = [...new Set((c.geoBroadcasts || []).map(g => g.media.shortName))];
  const w = whereToWatch(nets, mine || []);
  const time = st.state === 'pre'
    ? new Date(e.date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : st.state === 'in' ? `<span class="live">● LIVE · ${esc(st.shortDetail)}</span>` : esc(st.shortDetail);
  const teams = [...c.competitors].sort((a, b) => (a.homeAway === 'away' ? -1 : 1));
  let watch = nets.length ? nets.map(n => `<span class="net">${esc(n)}</span>`).join('') : '<span class="net">TV TBA</span>';
  if (w.yours.length) watch += `<div class="yes">✓ Watch on ${w.yours.map(id => esc(svcName[id])).join(', ')}</div>`;
  else if (w.free) watch += `<div class="yes">✓ ${esc(w.free)}</div>`;
  else if (w.options.length) watch += `<div class="get">Not on your services. Get it with ${w.options.filter(id => svcUrl[id]).slice(0, 3)
      .map(id => `<a href="${esc(svcUrl[id])}" target="_blank" rel="sponsored noopener">${esc(svcName[id])}</a>`).join(' · ')}</div>`;
  return `<article class="game"><div class="top"><span>${time}</span><span>${esc(c.venue?.address?.city || '')}</span></div>
    ${teams.map(t => teamRow(t, st.state === "pre")).join('')}<div class="watch">${watch}</div></article>`;
}

const canWatch = e => {
  const nets = (e.competitions[0].geoBroadcasts || []).map(g => g.media.shortName);
  const w = whereToWatch(nets, mine || []);
  return w.yours.length > 0 || !!w.free;
};
const isFav = e => e.competitions[0].competitors.some(c => favs.includes(c.team.id));

function render() {
  const q = $('search').value.trim().toLowerCase();
  const list = events.filter(e => {
    const cs = e.competitions[0].competitors;
    if (q && !cs.some(c => `${c.team.displayName} ${c.team.abbreviation}`.toLowerCase().includes(q))) return false;
    if (filter === 'mine' && !canWatch(e)) return false;
    if (filter === 'top25' && !cs.some(c => c.curatedRank?.current <= 25)) return false;
    return true;
  }).sort((a, b) => new Date(a.date) - new Date(b.date));

  if (!list.length) { $('games').innerHTML = '<p class="empty">No games match.</p>'; return; }
  const day = e => new Date(e.date).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
  const groups = [['Your teams', list.filter(isFav)]];
  for (const e of list.filter(e => !isFav(e))) {
    const g = groups.find(([k]) => k === day(e));
    g ? g[1].push(e) : groups.push([day(e), [e]]);
  }
  $('games').innerHTML = groups.filter(([, es]) => es.length)
    .map(([k, es]) => `<h2>${esc(k)}</h2>${es.map(gameCard).join('')}`).join('');
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
$('games').addEventListener('click', e => {
  const b = e.target.closest('.star');
  if (!b) return;
  const id = b.dataset.team;
  favs = favs.includes(id) ? favs.filter(x => x !== id) : [...favs, id];
  save('favs', favs);
  render();
});
$('prev').addEventListener('click', () => fetchWeek(weeks[--weekIdx]));
$('next').addEventListener('click', () => fetchWeek(weeks[++weekIdx]));

let installEvt;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; $('install').hidden = false; });
$('install').addEventListener('click', () => { installEvt?.prompt(); $('install').hidden = true; });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');

fetchWeek();
if (mine === null) openServices();
