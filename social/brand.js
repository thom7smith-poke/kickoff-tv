// X profile picture (400x400) and banner (1500x500). Run: node social/brand.js → social/brand/*.png
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const SITE = require('../config.js');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const out = path.join(__dirname, 'brand');
fs.mkdirSync(out, { recursive: true });

const FONTS = '<link href="https://fonts.googleapis.com/css2?family=Barlow:wght@500;600;700&family=Barlow+Condensed:ital,wght@0,600;0,700;0,800;1,800&display=block" rel="stylesheet">';
const brand = /tv$/i.test(SITE.name) ? `${SITE.name.slice(0, -2)}<em>${SITE.name.slice(-2)}</em>` : SITE.name;
const tv = size => `<svg width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect x="104" y="146" width="304" height="204" rx="30" fill="#121716" stroke="#2ee07f" stroke-width="22"/>
  <path d="M214 362l-22 34M298 362l22 34M176 398h160" stroke="#2ee07f" stroke-width="20" stroke-linecap="round"/>
  <path d="M228 200v96l84-48z" fill="#f2f5f3" stroke="#f2f5f3" stroke-width="14" stroke-linejoin="round"/></svg>`;

const avatar = `<!doctype html><meta charset="utf-8"><style>
  *{margin:0}body{width:400px;height:400px;display:grid;place-items:center;
  background:radial-gradient(circle at 50% 45%,rgba(46,224,127,.28),rgba(46,224,127,0) 62%),#0a0d0c}
  svg{filter:drop-shadow(0 0 18px rgba(46,224,127,.45));margin-top:6px}</style>${tv(340)}`;

// Abstract guide grid for the banner: channel rows with game blocks (no real teams, so it never goes stale).
const rows = [['ABC', [[0, 3.5, 2], [4, 3.5, 1]]], ['ESPN', [[0.5, 3.5, 1], [4.5, 3, 0]]], ['FOX', [[0, 3.5, 0], [3.8, 3.5, 2]]],
  ['CBS', [[1.5, 3.5, 2]]], ['NBC', [[1, 3.5, 0], [5, 2.5, 1]]], ['ESPN2', [[0, 3, 0], [3.4, 3.5, 0]]]];
const grid = rows.map(([ch, games]) => `<div class="r"><b>${ch}</b><div class="lane">${games.map(([x, w, hot]) =>
  `<i class="${['', 'rk', 'hot'][hot]}" style="left:${x * 9}%;width:${w * 9 - 1}%"></i>`).join('')}</div></div>`).join('');

const banner = `<!doctype html><meta charset="utf-8">${FONTS}<style>
  *{margin:0;box-sizing:border-box}
  body{width:1500px;height:500px;overflow:hidden;color:#f2f5f3;font-family:Barlow,sans-serif;position:relative;
    background:radial-gradient(700px 380px at 72% 30%,rgba(46,224,127,.20),transparent 70%),radial-gradient(500px 300px at 10% 110%,rgba(46,224,127,.08),transparent 70%),#0a0d0c}
  body::before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(90deg,rgba(255,255,255,.025) 0 1px,transparent 1px 60px)}
  .copy{position:absolute;left:96px;top:54px}
  .k{font-family:"Barlow Condensed";font-weight:700;letter-spacing:.2em;color:#2ee07f;font-size:26px}
  h1{font-family:"Barlow Condensed";font-weight:800;font-style:italic;font-size:140px;line-height:.86;text-transform:uppercase;margin:10px 0 14px;letter-spacing:.005em}
  h1 em{color:#2ee07f}
  .tag{font-family:"Barlow Condensed";font-weight:700;font-size:40px;text-transform:uppercase;letter-spacing:.04em}
  .sports{margin-top:10px;font-size:22px;color:#8a9592;font-weight:600}
  .guide{position:absolute;right:70px;top:70px;width:560px;border:1px solid #232b29;border-radius:18px;background:rgba(16,21,20,.85);padding:14px 16px;
    transform:perspective(1200px) rotateY(-14deg) rotateX(4deg);box-shadow:0 30px 80px rgba(0,0,0,.5)}
  .r{display:flex;align-items:center;height:46px;border-bottom:1px solid #1d2423}.r:last-child{border:0}
  .r b{width:80px;font-family:"Barlow Condensed";font-weight:800;font-size:20px;color:#8a9592}
  .lane{position:relative;flex:1;height:100%}
  .lane i{position:absolute;top:9px;height:28px;border-radius:7px;background:#1d2524;border:1px solid #2a3432}
  .lane i.rk{border-color:rgba(46,224,127,.6);background:linear-gradient(90deg,rgba(46,224,127,.22),#1d2524)}
  .lane i.hot{border-color:#2ee07f;background:linear-gradient(90deg,rgba(46,224,127,.5),rgba(46,224,127,.18));box-shadow:0 0 18px rgba(46,224,127,.35)}
  .url{position:absolute;right:76px;bottom:40px;font-family:"Barlow Condensed";font-weight:700;font-size:30px;letter-spacing:.06em;color:#f2f5f3}
  .url span{color:#2ee07f}
  </style>
  <div class="copy"><div class="k">THE SPORTS TV GUIDE</div><h1>${brand}</h1>
    <div class="tag">Every game. Every channel.</div>
    <div class="sports">College Football · NFL · NBA · College Hoops</div></div>
  <div class="guide">${grid}</div>
  <div class="url"><span>▶</span> ${SITE.url.toUpperCase()}</div>`;

for (const [name, html, w, h] of [['avatar', avatar, 400, 400], ['banner', banner, 1500, 500]]) {
  const f = path.join(out, name);
  fs.writeFileSync(`${f}.html`, html);
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=2', '--virtual-time-budget=8000',
    `--window-size=${w},${h}`, `--screenshot=${f}.png`, `file://${f}.html`], { stdio: 'ignore' });
  fs.unlinkSync(`${f}.html`);
  console.log(`${f}.png`);
}
