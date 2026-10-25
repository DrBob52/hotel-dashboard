# MMP hotel-rate watch: RUNBOOK

Operating notes for the checker. Every scheduled run starts from a fresh
container, so anything a run needs lives in this repo.

## Status

| Item | State | Verified |
| --- | --- | --- |
| marriott.com from the cloud container | **Blocked** by Akamai ("Access Denied", HTTP 403) | 2026-10-25 |
| Google Maps transit from the cloud container | Works (headless Chromium, no sign-in) | 2026-10-25 |
| Marriott rate names, banners, URL formats | Not yet recorded (needs a run that can load marriott.com) | |

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

Benchmark result (2026-10-25 lookup, for Wed Nov 4 2026, arrive by 9:00):
Residence Inn by Marriott Jersey City to 230 Vesey St, New York, NY 10281:
**18 min**, PATH from Grove St, 10 min walking, $3.25.

Commute times are cached per (hotel, destination) and re-checked monthly or
when a hotel is new.
