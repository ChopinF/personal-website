import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = 'sc-domain:licenta-disertatie-romania.com';
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'stats', 'gsc.csv');
const HISTORY_DAYS = 486;

function loadKey() {
  let raw = process.env.GSC_KEY_JSON;
  if (raw) {
    raw = raw.trim();
    if (!raw.startsWith('{')) raw = Buffer.from(raw, 'base64').toString('utf8');
  } else if (process.env.GSC_KEY_FILE) {
    raw = fs.readFileSync(process.env.GSC_KEY_FILE, 'utf8');
  } else {
    throw new Error('Set GSC_KEY_JSON or GSC_KEY_FILE');
  }
  return JSON.parse(raw);
}

async function token(key) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  });
  const jwt = unsigned + '.' + crypto.sign('RSA-SHA256', Buffer.from(unsigned), key.private_key).toString('base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  });
  const body = await res.json();
  if (!body.access_token) throw new Error(`Token request failed: ${res.status} ${body.error || ''}`);
  return body.access_token;
}

async function query(accessToken, body) {
  const res = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  const json = await res.json();
  if (!res.ok) throw new Error(`Search Console ${res.status}: ${json.error?.message || ''}`);
  return json.rows || [];
}

const day = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => day(new Date(Date.parse(s) + n * 864e5));

const accessToken = await token(loadKey());
const today = day(new Date());
const rows = await query(accessToken, {
  startDate: addDays(today, -HISTORY_DAYS),
  endDate: today,
  dimensions: ['date'],
  rowLimit: 1000,
});
const seen = rows.filter((r) => r.impressions > 0);
if (!seen.length) throw new Error('No data returned');

const byDate = new Map(seen.map((r) => [r.keys[0], r]));
const firstDay = seen[0].keys[0];
const lastDay = rows.at(-1).keys[0];
const lines = ['Date,Clicks,Impressions,CTR,Position'];
for (let d = firstDay; d <= lastDay; d = addDays(d, 1)) {
  const r = byDate.get(d);
  lines.push(r ? `${d},${r.clicks},${r.impressions},${(r.ctr * 100).toFixed(2)}%,${r.position.toFixed(1)}` : `${d},0,0,0.00%,`);
}

const prevLast = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8').trim().split('\n').at(-1).split(',')[0] : null;
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, lines.join('\n') + '\n');
console.log(`gsc.csv: ${lines.length - 1} days, ${firstDay} to ${lastDay}` + (prevLast ? ` (last day was ${prevLast})` : ''));
