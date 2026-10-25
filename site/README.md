# MMP Rate Watch

Private Marriott Explore hotel dashboard. The browser reads shared Cloudflare D1 state; R2 serves hotel photos. The Site is owner-private, and the same platform access boundary protects its API and MCP tools. Source is also mirrored to https://github.com/DrBob52/hotel-dashboard.

## Current limits

Public rates were observed locally, but no complete verified search has finished. The previous cloud container received Marriott HTTP 403. The observed combined Associate/Friends label requires explicit Associate-rate evidence, and whole-dollar displays are not exact price summaries. The UI must show failed or blocked checks honestly and retain older matches.

The collector gathers public observations; it does not manufacture verified listings. Every successful write requires complete date/geography coverage, exact price evidence, valid commute evidence, stored thumbnails, and independent link verification. See RUNBOOK.md.

## Development

Use Node 22.13 or later. Run `npm run install:ci`, `npm run db:generate` for new schema changes, and the Sites build helper. Apply pending local migrations using the generated dist/server/wrangler.json and .wrangler/state. Run `npm run dev` for the local preview.

Validation: `node --test scripts/watch-domain.test.mjs` and `npx tsc --noEmit`.

## Operations

The authenticated `/api/worker` service endpoint and OAuth `/mcp` transport expose watch_snapshot, watch_request_check, watch_begin_run, watch_finish_run, watch_configure_schedule, watch_cache_commute, and watch_cache_thumbnail. No secret is in browser code. Future tasks use the connected Site plugin or supported service access; do not store tokens in files or prompts.

A phone run request is queued separately from worker startup. When a hosted task URL is configured, the button opens that task for a second Run now tap. A queued request must never be reported as a running check.
