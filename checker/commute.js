// Google Maps transit commute lookups (arrive-by, weekday), read from the
// public Google Maps website with Playwright. See RUNBOOK.md "Google Maps".
//
// CLI:
//   node checker/commute.js --origin "<street address>" --dest "<address>" [--arrive 09:00] [--date YYYY-MM-DD]
//   node checker/commute.js --batch lookups.json      # [{key, origin, destination, arriveBy?}]
// Prints JSON. Exit code 3 means Google blocked the browser: stop, don't retry.

const { chromium } = require('playwright');

class BlockedError extends Error {
  constructor(message) { super(message); this.name = 'BlockedError'; this.blocked = true; }
}

// Next Wednesday at least 3 days out: a plain weekday inside Google's ~100-day
// transit planning window.
function defaultDate(now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 3));
  while (d.getUTCDay() !== 3) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// Google's !8j value is the local wall-clock time written as if it were UTC.
function arriveStamp(date, arriveBy) {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = arriveBy.split(':').map(Number);
  return Date.UTC(y, m - 1, d, hh, mm, 0) / 1000;
}

function enc(s) {
  return encodeURIComponent(s).replace(/%20/g, '+');
}

function mapsUrl({ origin, destination, arriveBy = '09:00', date = defaultDate() }) {
  return `https://www.google.com/maps/dir/${enc(origin)}/${enc(destination)}/data=!4m6!4m5!2m3!6e1!7e2!8j${arriveStamp(date, arriveBy)}!3e3?hl=en`;
}

function toMinutes(line) {
  const m = /^(?:(\d+)\s*hr)?\s*(?:(\d+)\s*min)?$/.exec(line.trim());
  if (!m || (!m[1] && !m[2])) return null;
  return (Number(m[1] || 0) * 60) + Number(m[2] || 0);
}

function clockToMinutes(s) {
  const m = /(\d{1,2}):(\d{2})\s*([AP]M)/i.exec(s);
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if (m[3].toUpperCase() === 'PM') h += 12;
  return h * 60 + Number(m[2]);
}

// One route option's text, as Google renders it, e.g.
//   18 min / 8:41 AM (Wednesday)—8:59 AM / PATH / 8:43 AM from Grove St / $3.25  10 min / Details
function parseTrip(text) {
  const lines = text.replace(/[-​-‍﻿]/g, '').split('\n').map((l) => l.trim()).filter(Boolean);
  let minutes = null, departs = null, arrives = null, routeLine = null, from = null, walkMinutes = null;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (minutes == null && toMinutes(l) != null) { minutes = toMinutes(l); continue; }
    const range = /(\d{1,2}:\d{2}\s*[AP]M).*?[—–-]\s*(\d{1,2}:\d{2}\s*[AP]M)/i.exec(l);
    if (range && departs == null) {
      departs = range[1];
      arrives = range[2];
      routeLine = lines[i + 1] || null;
      continue;
    }
    const fromM = /\d{1,2}:\d{2}\s*[AP]M\s+from\s+(.+)$/i.exec(l);
    if (fromM && !from) { from = fromM[1].trim(); continue; }
    const walk = /(?:^|\s)(\d+)\s*min$/.exec(l);
    if (walk && minutes != null && departs && walkMinutes == null && l !== lines[0]) walkMinutes = Number(walk[1]);
  }
  const lineNames = routeLine
    ? routeLine.split(/\s{1,}/).map((s) => s.trim()).filter((s) => s && !/^\d{1,2}:\d{2}/.test(s))
    : [];
  return { minutes, departs, arrives, lines: lineNames, from, walkMinutes };
}

async function assertNotBlocked(page) {
  const url = page.url();
  if (/google\.[a-z.]+\/sorry\//.test(url)) throw new BlockedError(`Google "unusual traffic" page at ${url}`);
  if (/consent\.google\./.test(url)) throw new BlockedError(`Google consent page at ${url}`);
  const text = await page.evaluate(() => document.body ? document.body.innerText.slice(0, 3000) : '');
  if (/unusual traffic|not a robot|captcha/i.test(text)) throw new BlockedError('Google asked for a CAPTCHA / unusual-traffic check');
}

async function lookupCommute(page, { origin, destination, arriveBy = '09:00', date = defaultDate() }) {
  const url = mapsUrl({ origin, destination, arriveBy, date });
  const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  if (resp && resp.status() === 429) throw new BlockedError('Google answered HTTP 429');
  await assertNotBlocked(page);
  const found = await page.waitForSelector('[data-trip-index]', { timeout: 25000 }).then(() => true).catch(() => false);
  if (!found) {
    await assertNotBlocked(page);
    const text = await page.evaluate(() => document.body.innerText.slice(0, 2000));
    return { origin, destination, arriveBy, date, minutes: null, error: /could not calculate|no routes|can't find/i.test(text) ? 'No transit route found' : 'Route list did not load', mapsUrl: url };
  }
  await page.waitForTimeout(800);
  // Line names: subway lines are icons (img alt "R", "4"), PATH and buses are
  // text. Walk the option's nodes in order after its time range.
  // The time range arrives as separate text nodes ("8:23 AM (Wednesday)", "—",
  // "8:56 AM"), and icon-font glyphs (private-use characters) sit between them.
  const readTrips = () => page.$$eval('[data-trip-index]', (els) => els.map((e) => {
    const clean = (s) => s.replace(/[\uE000-\uF8FF\u200B-\u200D\uFEFF]/g, '').trim();
    const segs = [];
    let phase = 0; // 0 before the dash, 1 expecting the arrival time, 2 reading lines
    const tw = document.createTreeWalker(e, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    while (tw.nextNode()) {
      const n = tw.currentNode;
      if (n.nodeType === 3) {
        const t = clean(n.nodeValue);
        if (!t) continue;
        if (phase === 0) {
          if (/[—–]/.test(t)) phase = /\d:\d\d/.test(t.split(/[—–]/)[1] || '') ? 2 : 1;
          continue;
        }
        if (phase === 1) { phase = 2; if (/^\d{1,2}:\d{2}\s*[AP]M$/i.test(t)) continue; }
        if (/^(\d+\s*hr\s*)?\d+\s*min$/.test(t)) continue;
        if (/^\d{1,2}:\d{2}\s*[AP]M/i.test(t) || /^\$/.test(t) || t === 'Details' || /^from$|^from\s/i.test(t)) break;
        segs.push(t);
      } else if (phase > 0 && n.tagName === 'IMG') {
        const a = clean(n.alt || '');
        if (a && !/^(walk|train|bus|subway|tram|light rail|ferry|rail|transit)$/i.test(a)) segs.push(a);
      }
    }
    return { index: Number(e.getAttribute('data-trip-index')), text: e.innerText, segs: segs.filter((s, i) => s !== segs[i - 1]) };
  }));
  const parse = (t) => {
    const p = parseTrip(t.text);
    return { index: t.index, ...p, lines: t.segs.length ? t.segs : p.lines.filter(Boolean) };
  };
  let trips = (await readTrips()).map(parse);
  const limit = clockToMinutes(`${Number(arriveBy.slice(0, 2)) % 12 || 12}:${arriveBy.slice(3, 5)} ${Number(arriveBy.slice(0, 2)) < 12 ? 'AM' : 'PM'}`);
  const valid = trips.filter((t) => t.minutes != null && (t.arrives == null || clockToMinutes(t.arrives) <= limit));
  if (!valid.length) return { origin, destination, arriveBy, date, minutes: null, error: 'No option arrives in time', mapsUrl: url, options: trips };
  let best = valid.reduce((a, b) => (b.minutes < a.minutes ? b : a));
  // Only the selected option shows its boarding stop and walking time.
  if (!best.from) {
    // A notification banner can cover the lower options, so select by keyboard.
    await page.focus(`[data-trip-index="${best.index}"]`, { timeout: 5000 }).then(() => page.keyboard.press('Enter')).catch(() => {});
    await page.waitForTimeout(2000);
    const again = (await readTrips()).find((t) => t.index === best.index);
    if (again) best = parse(again);
  }
  const walkOnly = !best.departs && !best.lines.length;
  const summary = walkOnly
    ? 'Walk'
    : [best.lines.length ? best.lines.join(' → ') : 'Transit', best.from ? `from ${best.from}` : null].filter(Boolean).join(' ');
  return {
    origin, destination, arriveBy, date,
    minutes: best.minutes,
    lines: best.lines,
    summary,
    walkMinutes: best.walkMinutes,
    departs: best.departs,
    arrives: best.arrives,
    mapsUrl: url,
    options: trips.map((t) => t.minutes),
    checkedAt: new Date().toISOString()
  };
}

async function withBrowser(fn) {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ locale: 'en-US', timezoneId: 'America/New_York', viewport: { width: 1366, height: 900 } });
    const page = await ctx.newPage();
    return await fn(page);
  } finally {
    await browser.close();
  }
}

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const batchFile = arg('batch');
  let jobs;
  if (batchFile) jobs = JSON.parse(require('fs').readFileSync(batchFile, 'utf8'));
  else if (arg('origin') && arg('dest')) jobs = [{ origin: arg('origin'), destination: arg('dest'), arriveBy: arg('arrive'), date: arg('date') }];
  else {
    console.error('usage: node checker/commute.js --origin "<address>" --dest "<address>" [--arrive 09:00] [--date YYYY-MM-DD] | --batch file.json');
    process.exit(2);
  }
  const results = await withBrowser(async (page) => {
    const out = [];
    for (const job of jobs) {
      const clean = Object.fromEntries(Object.entries(job).filter(([, v]) => v != null));
      try {
        out.push({ key: job.key, ...(await lookupCommute(page, clean)) });
      } catch (e) {
        if (e.blocked) { out.push({ key: job.key, origin: job.origin, blocked: true, error: e.message }); return out; }
        out.push({ key: job.key, origin: job.origin, error: e.message });
      }
      await page.waitForTimeout(2000 + Math.floor(Math.random() * 2000));
    }
    return out;
  });
  console.log(JSON.stringify(batchFile ? results : results[0], null, 2));
  if (results.some((r) => r.blocked)) process.exit(3);
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });

module.exports = { lookupCommute, mapsUrl, parseTrip, defaultDate, withBrowser, BlockedError };
