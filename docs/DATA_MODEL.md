# Dashboard data model

All state lives in the dashboard Artifact's shared database (`db` capability).
The page reads it live. Claude sessions read and write it with the
`ArtifactData` tool, using the Artifact URL recorded in `RUNBOOK.md`.

Paths are `collection/docId`. Times are ISO 8601 strings in UTC
(`2026-10-25T20:02:11Z`). Stay dates are local hotel dates `YYYY-MM-DD`.
Money is a JSON number in USD.

Who writes what:

| Path | Written by |
| --- | --- |
| `criteria/<id>` | The page (create, edit, pause, delete). The checker only reads. |
| `listings/<criteriaId>__<hotelCode>` | The checker. The page deletes them when a criteria set is deleted. |
| `checks/<criteriaId>` | The checker. The page deletes it when a criteria set is deleted. |
| `runs/<runId>` | The page creates manual requests; the checker creates scheduled runs and updates both. |
| `state/current` | The checker. |
| `config/main` | Claude (setup). |
| `commute/<key>` | The checker (commute cache). |

## `criteria/<id>`

```json
{
  "name": "Lower Manhattan weeknights",
  "text": "Free text exactly as the user wrote it",
  "paused": false,
  "order": 1,
  "commute": {
    "destination": "230 Vesey Street, New York, NY",
    "maxMinutes": 45,
    "comparison": "lt",
    "mode": "transit",
    "arriveBy": "09:00"
  },
  "price": {
    "amount": 70,
    "comparison": "lte",
    "per": "night",
    "basis": "pretax"
  },
  "dates": {
    "mode": "rolling",
    "rollingDays": 28,
    "from": null,
    "to": null,
    "checkoutBy": null,
    "noFridayNights": true,
    "stays": [
      { "dow": 0, "nights": 3, "tier": 1 },
      { "dow": 0, "nights": 2, "tier": 2 }
    ]
  },
  "rates": { "accept": "mmp-explore" },
  "areas": ["Lower Manhattan", "Jersey City"],
  "benchmark": "Residence Inn by Marriott Jersey City",
  "createdAt": "…",
  "updatedAt": "…"
}
```

- `commute.comparison`: `lt` means strictly under `maxMinutes` ("under 45
  minutes"); `lte` means at most.
- `price.basis`: `pretax` compares Marriott's average nightly rate before
  taxes; `total` compares the full stay total including taxes and mandatory
  fees, divided by nights.
- `dates.mode`: `rolling` means check-in from today through today +
  `rollingDays`. `fixed` means check-in from `from` through `to`.
  `checkoutBy` is the latest allowed check-out date, or null.
- `dates.stays`: the allowed stay shapes. `dow` is the check-in weekday
  (0 = Sunday), `nights` the length, `tier` 1 for preferred and 2 for backup.
  Seven entries with the same `nights` and tier mean "any check-in day".
- `rates.accept`: `mmp-explore` accepts only the Explore Associate and Explore
  Family rate names recorded in `RUNBOOK.md`.

## `listings/<criteriaId>__<hotelCode>`

One card: one hotel for one criteria set. `hotelCode` is Marriott's
five-letter property code.

```json
{
  "criteriaId": "lower-manhattan-weeknights",
  "hotelCode": "NYCRJ",
  "hotelName": "Residence Inn by Marriott Jersey City",
  "area": "Jersey City",
  "address": "…",
  "thumb": "/_blob/<assetId>",
  "benchmark": true,
  "main": {
    "checkIn": "2026-11-02",
    "checkOut": "2026-11-05",
    "nights": 3,
    "tier": 1,
    "rateName": "Rate name exactly as Marriott shows it",
    "nightlyPretax": 65.0,
    "nightly": [ { "date": "2026-11-02", "amount": 60.0 } ],
    "nightlyInclTax": 82.13,
    "total": 246.4,
    "taxesFees": 51.4,
    "bookingUrl": "https://www.marriott.com/…"
  },
  "others": [
    { "checkIn": "2026-11-03", "checkOut": "2026-11-05", "nights": 2, "tier": 2,
      "total": 150.0, "nightlyPretax": 62.0, "bookingUrl": "https://www.marriott.com/…" }
  ],
  "commute": {
    "minutes": 18,
    "summary": "PATH from Grove St",
    "lines": ["PATH"],
    "walkMinutes": 10,
    "mapsUrl": "https://www.google.com/maps/dir/…",
    "checkedAt": "…"
  },
  "why": [
    { "label": "Rate", "ok": true, "evidence": "Explore Associate Rate" }
  ],
  "firstSeenAt": "…",
  "lastVerifiedAt": "…",
  "badges": { "isNew": true, "datesChanged": false, "previous": null },
  "stale": false,
  "staleSince": null
}
```

- `main` is the best matching window: preferred tier first, then lowest total.
- `nightly` is present when nightly rates differ; the card shows the breakdown.
- `badges.isNew` is true on the first check that finds the hotel for this set.
  `badges.datesChanged` is true when `main` moved to different dates since the
  previous check; `badges.previous` then holds `{checkIn, checkOut}`.
- A check that fails for a criteria set leaves its listings in place and sets
  `stale: true`, `staleSince: <time of the failed check>`.

## `checks/<criteriaId>`

```json
{
  "criteriaId": "…",
  "runId": "…",
  "lastCheckedAt": "…",
  "label": "8:00pm check",
  "status": "ok",
  "error": null,
  "matchCount": 3,
  "staysChecked": 140,
  "hotelsChecked": 22
}
```

`status` is `ok`, `error` or `blocked`. On `error` or `blocked`, `error` holds
a short reason and `lastGoodAt` the time of the last successful check.

## `runs/<runId>`

```json
{
  "kind": "manual",
  "status": "requested",
  "requestedAt": "…",
  "requestedBy": "<viewer id or null>",
  "triggerFiredAt": null,
  "startedAt": null,
  "finishedAt": null,
  "summary": { "added": 0, "removed": 0, "changed": 0 },
  "perCriteria": { "<criteriaId>": { "status": "ok", "matches": 3, "error": null } },
  "error": null
}
```

`status` moves `requested` → `running` → `finished` | `partial` | `failed`.
A dashboard request whose trigger call fails is set to `not_started`.
The checker prunes runs older than 90 days.

## `state/current`

```json
{
  "lastRunId": "…",
  "lastCheckAt": "…",
  "lastStatus": "finished",
  "lastSummary": { "added": 2, "removed": 1, "changed": 1 }
}
```

## `config/main`

```json
{
  "schedule": { "tz": "America/New_York", "times": ["08:00", "20:00"] },
  "trigger": { "id": "trig_…", "url": "https://claude.ai/…" },
  "runner": "mac"
}
```

`trigger` is what "Run check now" fires through the viewer's Claude Code
Remote connector. It is an id, not a secret: firing it needs the viewer's own
claude.ai login.

## `commute/<key>`

`key` is `<hotelCode>__<destination slug>`.

```json
{
  "hotelCode": "NYCRJ",
  "origin": "Residence Inn by Marriott Jersey City",
  "destination": "230 Vesey Street, New York, NY",
  "arriveBy": "09:00",
  "minutes": 18,
  "summary": "PATH from Grove St",
  "lines": ["PATH"],
  "walkMinutes": 10,
  "mapsUrl": "https://www.google.com/maps/dir/…",
  "checkedAt": "…"
}
```

Re-check when `checkedAt` is older than 30 days.
