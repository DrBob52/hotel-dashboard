# MMP hotel-rate watch: RUNBOOK

Operating notes for the checker. Every scheduled run starts from a fresh
container, so anything a run needs lives in this repo.

## Status

| Item | State | Verified |
| --- | --- | --- |
| marriott.com from the cloud container | **Blocked** by Akamai ("Access Denied", HTTP 403) | 2026-10-25 |
| Google Maps transit from the cloud container | Works (headless Chromium, no sign-in), `checker/commute.js` | 2026-10-25 |
| Dashboard Artifact + database, both criteria sets seeded | Live | 2026-10-25 |
| Marriott rate names, banners, URL formats | Not yet recorded (needs the Mac runner's first run) | |
| Schedule (8:00am / 8:00pm ET) and "Run check now" trigger | Not set up yet (depends on the Mac runner) | |

## Architecture

The user chose the Mac fallback: Marriott searching runs in the user's own
Chrome on their Mac through Claude in Chrome, because marriott.com refuses the
cloud container. Everything else stays in the cloud:

- **Dashboard**: claude.ai Artifact
  <https://claude.ai/artifact/WskigVyR4QQ5m8fziTtq2S>. Source:
  `dashboard/index.html`. Republish from that file (same path keeps the URL).
  Capabilities: `db`, `user`, `assets`, and `mcp` with the single tool
  `Claude Code Remote` / `fire_trigger`.
- **Data**: the Artifact's database. Shapes in `docs/DATA_MODEL.md`. Read and
  write it with the `ArtifactData` tool and the URL above. Never hardcode
  listings into the page.
- **Commute lookups**: `checker/commute.js` (Playwright, Google Maps web).
  Works from the cloud container; results cached in `commute/<key>` for 30 days.
- **"Run check now"**: the page writes `runs/<id>` with `status: "requested"`,
  then calls `fire_trigger` on `config/main.trigger.id` through the viewer's
  own Claude Code Remote connector. No secret is in the page source. If
  `config/main.trigger` is null the request is only recorded.
- **Thumbnails**: the Artifact's CSP blocks external images, so Marriott photos
  must be uploaded to the Artifact's asset store (Artifact tool, `asset: true`)
  and the listing's `thumb` set to the returned `/_blob/<id>` URL.

## Network policy (cloud environment)

The environment uses a Custom network policy. Besides the default package
managers, it must allow:

- `marriott.com`, `*.marriott.com` (site, search, `cache.marriott.com` photos)
- `google.com`, `*.google.com` (Google Maps web)
- `*.gstatic.com` (Maps scripts, tiles, fonts)

`*.googleapis.com` is on the default list already.

## Marriott: cloud access result (2026-10-25)

With the domains allowed, the proxy tunnel opens but Marriott's Akamai edge
refuses the request itself:

- `curl` to `https://www.marriott.com/`: HTTP 403, `server: AkamaiGHost`,
  body "Access Denied ... Reference #18.xxxx", `errors.edgesuite.net` link.
- Playwright Chromium, default settings (UA contains `HeadlessChrome/153`):
  HTTP 403 "Access Denied" on `https://www.marriott.com/default.mi` and on a
  `search/findHotels.mi` URL. The denial is immediate, with no JS challenge.

Per the source rules, the checker does **not** try to get around this: no
stealth plugins, no user-agent spoofing, no CAPTCHA solving, no proxy
rotation. If a run sees this page it stops, marks the affected criteria sets'
listings stale, and records the error.

Detect it by any of: HTTP status 403 on the document, page title
`Access Denied`, body text containing `errors.edgesuite.net`.

## Google Maps transit lookups

Use the module:

```
node checker/commute.js --origin "<street address>" --dest "230 Vesey Street, New York, NY 10281"
node checker/commute.js --batch lookups.json   # [{key, origin, destination, arriveBy?}]
```

It prints JSON (`minutes`, `lines`, `summary`, `walkMinutes`, `departs`,
`arrives`, `mapsUrl`, `options`). Exit code 3 means Google showed an
unusual-traffic, CAPTCHA or consent page: stop, mark the commute as unknown,
and report it. Do not retry or work around it. Allow about 5 to 7 seconds per
lookup; the module waits 2 to 4 seconds between lookups.

**Always pass the hotel's street address, never its name.** Names are
ambiguous: "Fairfield Inn & Suites New York Brooklyn" resolved to a hotel near
Midwood (70 min by express bus) instead of 181 3rd Ave (33 min by the R).

How the page is read (Google's class names are obfuscated; these hooks are
stable as of 2026-10-25):

- Each route option is a `div[data-trip-index="N"]`.
- Its text holds the duration (`18 min`, `1 hr 10 min`) and the time range,
  split across text nodes (`8:23 AM (Wednesday)`, `—`, `8:56 AM`).
- Subway lines are icons: `img[alt="R"]` with `src` under
  `maps.gstatic.com/mapfiles/transit/iw2/svg/us-ny-mta/`. PATH and buses are
  plain text. Generic icons (`Walk`, `Train`, `Bus`) are skipped.
- Icon-font glyphs (Unicode private-use characters) sit in the text; strip
  them before parsing.
- Only the selected option shows `8:43 AM from Grove St` and the walking total
  (`$3.25  10 min`). To read them for another option, focus it and press
  Enter: a "Continue your trip" banner covers the lower options and swallows
  mouse clicks.
- The walking-only alternative also has a `data-trip-index` but no time range;
  it counts if it's the shortest (summary `Walk`).

Arrive-by transit directions load from a plain URL, no form driving needed:

```
https://www.google.com/maps/dir/<ORIGIN>/<DESTINATION>/data=!4m6!4m5!2m3!6e1!7e2!8j<ARRIVE>!3e3?hl=en
```

- `<ORIGIN>`, `<DESTINATION>`: URL-encoded place name or address
  (`+` for spaces). A hotel name works ("Residence Inn by Marriott Jersey City").
- `!6e1`: arrive by. (`!6e0` would be depart at.)
- `!8j<ARRIVE>`: arrival time as Unix seconds of the **local** wall-clock
  time written as if it were UTC. 9:00 AM on Wed Nov 4 2026 is
  `Date.UTC(2026, 10, 4, 9, 0, 0) / 1000` = `1793782800`.
- `!3e3`: transit mode.
- Use a weekday (Tue to Thu) in the next couple of weeks; Google only plans
  transit about 100 days ahead.

The side panel's text (`document.body.innerText`) lists route options as:

```
18 min
8:41 AM (Wednesday)—8:59 AM
PATH
8:43 AM from Grove St
$3.25  10 min        <- fare, total walking
```

Take the **shortest total duration** among the listed options that arrive by
the target time. The duration is door to door (walking, waits and transfers
included). Record minutes, the line names (e.g. `PATH`), the boarding stop,
and the URL itself as the card's Google Maps link.

Reference results (2026-10-25, weekday, arrive by 9:00, to 230 Vesey St):

| Origin | Minutes | Route |
| --- | --- | --- |
| Residence Inn by Marriott Jersey City (benchmark) | 18 | PATH from Grove St, 10 min walking |
| 181 3rd Ave, Brooklyn | 33 | R from Union St, 17 min walking |
| 29-21 41st Ave, Long Island City | 37 | E from Queens Plaza, 12 min walking |

The cloud container has Playwright preinstalled; `require('playwright')`
works from any directory. Don't `npm install playwright` there (another
version won't find the preinstalled Chromium).

Commute times are cached per (hotel, destination) and re-checked monthly or
when a hotel is new.
