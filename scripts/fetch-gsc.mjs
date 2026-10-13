// Fetch Google Search Console data for licenta-disertatie-romania.com into licenta-stats/gsc.json.
// No dependencies: signs the service-account JWT with node:crypto.
//
// Key, in order of precedence:
//   GSC_KEY_JSON  the service-account JSON, raw or base64 (the cloud routine sets this)
//   GSC_KEY_FILE  path to the JSON file (handy locally)
// Never print the key.
//
// Usage: node scripts/fetch-gsc.mjs

import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = 'sc-domain:licenta-disertatie-romania.com';
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'licenta-stats', 'gsc.json');
const RANGES = [7, 28, 90];
const TOP = 25;

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
const round = (n, d) => Math.round(n * 10 ** d) / 10 ** d;
const metrics = (r) => ({
  clicks: r.clicks,
  impressions: r.impressions,
  ctr: round(r.ctr, 4),
  position: round(r.position, 1),
});

const accessToken = await token(loadKey());

// Daily series for the longest range; the last day with final data anchors every range.
const today = day(new Date());
const daily = await query(accessToken, {
  startDate: addDays(today, -(Math.max(...RANGES) + 6)),
  endDate: today,
  dimensions: ['date'],
});
if (!daily.length) throw new Error('No data returned');
const lastDay = daily.at(-1).keys[0];

const ranges = {};
for (const n of RANGES) {
  const startDate = addDays(lastDay, -(n - 1));
  const base = { startDate, endDate: lastDay };
  const [[total = { clicks: 0, impressions: 0, ctr: 0, position: 0 }], queries, pages, countries, devices] =
    await Promise.all([
      query(accessToken, base),
      ...['query', 'page', 'country', 'device'].map((d) =>
        query(accessToken, { ...base, dimensions: [d], rowLimit: TOP }),
      ),
    ]);
  const byDate = new Map(daily.map((r) => [r.keys[0], r]));
  const days = [];
  for (let d = startDate; d <= lastDay; d = addDays(d, 1)) {
    const r = byDate.get(d) || { clicks: 0, impressions: 0, ctr: 0, position: 0 };
    days.push({ date: d, ...metrics(r) });
  }
  const table = (rows) => rows.map((r) => ({ key: r.keys[0], ...metrics(r) }));
  ranges[n] = {
    startDate,
    endDate: lastDay,
    totals: metrics(total),
    days,
    queries: table(queries),
    pages: table(pages).map((p) => ({ ...p, key: p.key.replace(/^https?:\/\/[^/]+/, '') || '/' })),
    countries: table(countries),
    devices: table(devices),
  };
}

const out = { site: 'licenta-disertatie-romania.com', lastDay, ranges };
fs.mkdirSync(path.dirname(OUT), { recursive: true });
const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : null;
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
console.log(
  `gsc.json: data through ${lastDay}` +
    (prev ? ` (was ${prev.lastDay})` : '') +
    `, 28 days: ${ranges[28].totals.clicks} clicks, ${ranges[28].totals.impressions} impressions`,
);
