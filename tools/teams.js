// Builds teams.json for the season-plan team picker. ESPN's team list feed blocks browsers (no CORS),
// so we fetch it here and ship it with the site. Re-run when teams change: node tools/teams.js
const fs = require('fs'), path = require('path');
const SPORTS = { cfb: 'football/college-football', nfl: 'football/nfl', nba: 'basketball/nba' };

(async () => {
  const out = {};
  for (const [key, p] of Object.entries(SPORTS)) {
    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${p}/teams?limit=1000`);
    if (!res.ok) throw new Error(`${key}: ${res.status}`);
    const teams = (await res.json()).sports[0].leagues[0].teams.map(({ team: t }) => ({
      id: t.id, name: t.displayName, logo: t.logos?.[0]?.href, color: t.color,
    }));
    if (!teams.length) throw new Error(`${key}: no teams`);
    out[key] = teams.sort((a, b) => a.name.localeCompare(b.name));
    console.log(`${key}: ${teams.length} teams`);
  }
  fs.writeFileSync(path.join(__dirname, '..', 'teams.json'), JSON.stringify(out));
})();
