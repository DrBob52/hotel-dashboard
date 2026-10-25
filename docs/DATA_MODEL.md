# Private Site data model

The current dashboard stores shared state in the D1 watch_state table. A single payload is updated with a compare-and-swap revision, so each refresh is atomic and concurrent edits cannot be overwritten. Its top-level collections retain the legacy criteria, listings, checks, runs, state, config, and commute names. Legacy Artifact documentation is preserved separately.

Criteria hold verbatim text, commute destination and limit, arrival time, cap and tax basis, date shapes, paused state, and an optimistic version. Initial seeding occurs only when the state row is absent, so deleted criteria are not recreated.

Runs move requested → running → finished, partial, or failed. Claim tokens prevent two workers from completing the same run. Requests are deduplicated while one is active and expire after 45 minutes. Successful set refreshes require complete search coverage and verification; failed sets retain previous listings with stale flags and original verification timestamps.

Listings remain one card per hotel per set. Main and alternative windows require exact totals, nightly breakdown, rate-name and Associate evidence, independently verified deep links, and current Google Maps commute evidence. Marriott thumbnails are stored in R2 and served under /api/images/<sha256>.

The Site MCP tools read/claim/write data through the same mutation functions as the browser. Browser writes are limited to criteria and check requests. Authentication and owner-only access are provided by the private Sites gateway; no credentials are present in the browser bundle.

Read site/lib/watch-domain.mjs for validation and site/lib/watch-store.ts for storage. Only read-only source observations are accepted from the collector; it does not claim they are qualified listings.
