# MMP hotel rate watcher runbook

The implementation now targets a private Site, as approved by the user. Shared state is in D1; stored hotel images are in R2. GitHub source: https://github.com/DrBob52/hotel-dashboard. The legacy Claude Artifact source and runbook remain in the GitHub repository for reference.

Live publication, schedule state, pending requests, and last check status must be read from Sites get_site and watch_snapshot. A saved schedule is not proof that source access or a full check succeeds.

## Confirmed decisions and remaining source limits

- Combined Explore Associate & Friends labels may qualify only with explicit Associate-rate evidence. Generic terms listing associates, family, and friends are insufficient.
- Use the supplied GitHub repository and private Sites hosting, shared D1 storage, and R2 photos.
- Public rate displays were observed locally. Previous cloud access was denied by Marriott. Do not retry through another identity or network to get around a denial.
- Public whole-dollar totals do not establish exact cents or nightly breakdowns. The inspected rate-selection step required sign-in. Never estimate the missing evidence.
- The feasibility sample used one room and one adult. The live configuration records this as an unconfirmed default; no result should silently assume another occupancy.

## Run procedure and data tools

The authenticated private Site service endpoint `/api/worker` (JSON-RPC) and OAuth `/mcp` transport expose watch_snapshot, watch_request_check, watch_begin_run, watch_finish_run, watch_configure_schedule, watch_cache_commute, and watch_cache_thumbnail. Use the generated Site plugin when connected. For unattended service writes, obtain the existing service credential through Sites get_site in that fresh task and send OAI-Sites-Authorization only to this Site's /api/worker endpoint. The /mcp route uses separate MCP OAuth and returned HTTP 401 with the service header; /api/watch readback succeeded using supported Site service access. Never put service credentials in source, browser JavaScript, files, or prompts.

1. Read watch_snapshot and claim a pending request with watch_begin_run; otherwise begin a scheduled run. The returned claim token belongs only to that run. The response includes active criteria, their versions, exact date windows, cached commutes, and the rate policy.
2. Read the criteria text as well as structured fields. Use checker/collector.cjs observeWindow and observeHotel with the supplied Playwright page for normal public searches, or inspect the same public UI. The collector returns observations, not qualified matches. Its current discovery records are deliberately marked incomplete until all pages and geographies have been verified.
3. Stop at CAPTCHA, denied access, or authentication requirements. Return blocked/error for affected sets. Do not use another browser identity, network, or protected endpoint to get around the stop.
4. Independently verify each candidate, cache a Marriott photo with watch_cache_thumbnail, and save the exact route evidence with watch_cache_commute. The commuter record must include destination, mode, arriveBy, weekdayVerified, includesWalkingWaitsTransfers, evidence, mapsUrl, and checkedAt.
5. Finish with watch_finish_run using runId, claim, and perCriteria. A blocked set uses {status:"blocked",error:"specific observed reason"}. An ok set requires allWindowsChecked:true, windowsChecked equal to the returned window count, allGeographiesChecked:true, criteriaTextReviewed:true, hotelsChecked, and listings. Partial coverage cannot produce a successful empty set.
6. Each listing includes hotelCode, hotelName, address, criteriaId, stored thumb, main, others, commute, and why. Every stay needs exactTotalVerified, priceEvidence, rateDetailsText, rateName, per-night breakdown, prices, dates, corporate-code booking URL, supervisorVerifiedAt, and supervisorEvidence. A combined label additionally requires associateEvidence quoted from its Marriott details. See lib/watch-domain.mjs for validation.
7. Read watch_snapshot again to confirm persistence. Unchanged criteria are refreshed atomically. Paused, deleted, or edited sets cannot receive obsolete in-flight results. Failures retain prior matches and original verification times, marking them stale.

Phone checks use two steps: tap Run check now on the dashboard to save a deduplicated request, then open ChatGPT → Scheduled → MMP hotel rate checks and choose Run now. No task-specific URL is required. Direct task invocation is not exposed by the available Site integration. The task must claim the queued request through watch_begin_run and persist its outcome through watch_finish_run. Do not claim that saving a request wakes a worker. The user confirmed the scheduled task exists; its end-to-end execution still needs verification.

Desired schedule: start at 7:30am and 7:30pm America/New_York for an 8:00am/8:00pm completion target. Runtime cannot be promised until a full check succeeds and is timed.

## Local feasibility findings

The following observations were collected October 25, 2026, around 3:45pm Eastern. The Playwright browser was local to the Codex desktop chat. Fresh cloud access has not been established by these observations.

## Access and stopping rules

Use only the normal public marriott.com site for hotel and rate evidence. Use Google Maps transit directions for commute evidence. Do not sign in, create an account, enter personal information, or book.

If either source presents a CAPTCHA, access-denied page, or automation restriction, stop source access and report it. Do not change browser identity, solve challenges, rotate proxies, replay protected requests, or switch access methods to evade a restriction.

No CAPTCHA or access-denied page was observed during this local test. Marriott's rate-selection step presented a sign-in dialog; no fields were filled, and the dialog was closed. No access beyond that gate was attempted.

Outbound website access worked in the supplied browser. No network allowlist failure was demonstrated, so there is no evidence-based list of domains to unblock. Cloud network policy and cloud access remain untested.

## Marriott sample and observed labels

Source entry point: https://www.marriott.com/

Search destination: 230 Vesey Street, New York, NY. Marriott resolved it to 230 Vesey St, New York, NY 10281, USA.

Dates: Monday October 26 to Thursday October 29, 2026; three nights. One room, one adult, no children. Corporate code MMP was visibly selected. The search counter reported 153 results; this is a broad search count, not a count of qualified MMP matches.

Inspected property: Residence Inn by Marriott New York Downtown Manhattan/World Trade Center Area, 170 Broadway, New York, NY 10007. Property code NYCRL. This is a different property from the Jersey City benchmark.

Observed rate title:
- Explore Associate & Friends Rate

Do not add that title to an accepted-rate allowlist until the eligibility question is resolved. Its rate details describe eligibility across associates, family, and friends after validation. Neither a separately named Explore Associate-only rate nor a separately named Explore Family rate was established.

Other visible rate labels included Flexible Rate, Member Rate, Non-Member Rate, and packages. They are ineligible under the brief. The presence of MMP in the search form does not make every returned rate eligible.

Observed availability badge:
- SPECIAL RATE AVAILABLE

This badge alone does not establish Associate/Family eligibility. No corporate-code-unavailable fallback banner was encountered or verified. Leave the fallback-banner registry incomplete; do not invent exact strings or treat absence of a known banner as proof of eligibility.

### Price presentation

For the Executive Studio room under the observed combined Explore label:

| Marriott display state | Average nightly display | Full stay display |
| --- | ---: | ---: |
| Taxes/fees toggle off | USD 786 | USD 2,358 |
| Taxes/fees toggle on | USD 907 | USD 2,722 |

The first display separately states that a USD 25 destination fee is included. It must not be described as a room-only base rate. The second display states that taxes and all fees are included. These are whole-dollar displays, not verified exact cents. Capture the nightly and full-stay values independently: displayed nightly rate multiplied by nights does not necessarily equal the displayed total.

This sample is above both price caps and is not a match, regardless of the pending rate-label decision. No qualified listings have been established.

Opening the special rate's Select control displayed:
- Sign In to Book This Rate

The full price summary beyond that gate was not inspected. The rate-details information icon itself was accessible without sign-in, but the inspected details modal did not provide the required exact full-stay breakdown.

## Reproduce the public sample

1. Open the Marriott homepage in a normal browser context.
2. Enter 230 Vesey Street, New York, NY in Destination.
3. Open the dates control. Click Reset before selecting a new range. Clicking a date while an existing start/end range is selected can change just the checkout or start a new range.
4. Select October 26 and October 29, 2026, and click Done.
5. Open Lowest Regular Rate, choose Corp/Promo Code, enter MMP, and click Done.
6. Confirm one room and one adult for this sample, then click Find Hotels.
7. Wait for actual hotel cards. A transient zero-result counter and loading placeholders appeared before the search populated. Never treat those as a completed empty search.
8. Confirm the rendered dates, destination, and MMP code.
9. Open a property's View Rates link, then expand a room's View Rates button. Read the exact rate heading and its Rate Details modal.
10. Close the rate-details modal. Explicitly set the taxes-and-fees checkbox and verify the state before reading prices.
11. Stop if sign-in is required for further evidence. Do not accept a candidate missing required rate or exact-price evidence.

The test used the normal public UI. It did not call private booking APIs or use another booking site.

### Selectors observed during this test

Prefer accessible labels and verify them against the current page before reuse. Transient snapshot references are not production selectors.

- Homepage destination: getByRole('textbox', { name: 'Destination', exact: true })
- Calendar dates: getByRole('gridcell', { name: 'Mon Oct 26 2026', exact: true })
- Calendar reset: getByRole('button', { name: 'Reset', exact: true })
- Corporate-code textbox: getByRole('textbox', { name: 'ENTER CODE' })
- Homepage submit button: getByRole('button', { name: /Find Hotels/ })
- Search results: getByRole('link', { name: 'View Rates' })
- Room expansion: getByTestId('rate-button')
- Rate details within the selected rate row: getByTestId('rate-modal')
- Tax-state verification: getByRole('checkbox', { name: 'Show with taxes and fees' })

The corporate-rate radio input was visually covered by its label; clicking the displayed Corp/Promo Code label worked. The taxes-and-fees control's visible label was clicked successfully. Nested/duplicate controls and dynamic homepage re-rendering made some raw references obsolete. Scope locators to the relevant dialog, room, and rate rather than assuming the first global match is correct.

## Booking link format and clean-session verification

The search UI generated /search/findHotels.mi with fromDate, toDate, clusterCode=corp, corporateCode=MMP, and destinationAddress.destination parameters. Property View Rates links pointed to /search/availabilityCalendar.mi with propertyCode.

A property link assembled from these observed parameter names was opened in a new browser context without inherited cookies. It returned HTTP 200 and landed on the correct property with the requested dates, three nights, one room, one guest, and MMP visibly prefilled:

https://www.marriott.com/search/availabilityCalendar.mi?propertyCode=NYCRL&isSearch=true&fromDate=10%2F26%2F2026&toDate=10%2F29%2F2026&clusterCode=corp&corporateCode=MMP&numAdultsPerRoom=1&roomCount=1&showFullPrice=true

Reusable candidate format:

    https://www.marriott.com/search/availabilityCalendar.mi?propertyCode={PROPERTY_CODE}&isSearch=true&fromDate={MM%2FDD%2FYYYY}&toDate={MM%2FDD%2FYYYY}&clusterCode=corp&corporateCode=MMP&numAdultsPerRoom={ADULTS}&roomCount={ROOMS}

Only the listed NYCRL sample has passed this clean-session check. Each new or changed candidate must be reopened and verified individually before publication.

The resulting address was https://www.marriott.com/reservation/rateListMenu.mi. That address alone omits the property, dates, and code; do not store it as a portable booking link.

The showFullPrice=true parameter did not enable taxes-and-fees display in the fresh context. The checker must inspect and set the actual checkbox. Do not assume URL parameters control display state.

## Google Maps benchmark commute

Origin: Residence Inn by Marriott Jersey City, 80 Christopher Columbus Dr, Jersey City, NJ 07302.

Destination: 230 Vesey St, New York, NY 10281.

Mode: transit. Date: Monday October 26, 2026. Arrival setting: 9:00am, local New York time.

Google Maps displayed an 18-minute timed itinerary, departing 8:41am and arriving 8:59am:

| Segment | Evidence from Google Maps |
| --- | --- |
| Hotel to Grove Street | About 2 minutes walking, 351 feet |
| Grove Street to World Trade Center | PATH, 8:43am to 8:51am; 8 minutes, 2 stops |
| World Trade Center to destination | About 8 minutes walking, 0.3 mile |
| Door-to-door scheduled duration | 18 minutes |
| Transfers | None |

The itinerary includes both walks. It is timed to a scheduled train and does not show a separate ordinary waiting allowance. Nearby displayed departures were five minutes apart. A production commute policy must capture routine wait/transfer evidence instead of describing this tightly timed itinerary as a measured ordinary-wait total. Do not replace missing evidence with an unlabeled estimate.

Entry link:

https://www.google.com/maps/dir/?api=1&origin=Residence+Inn+by+Marriott+Jersey+City%2C+80+Christopher+Columbus+Drive%2C+Jersey+City%2C+NJ&destination=230+Vesey+Street%2C+New+York%2C+NY&travelmode=transit

The entry link defaults to Leave now. Explicitly choose Arrive by, enter 9:00 AM, and set the weekday before reading results.

Time-specific observed route link:

https://www.google.com/maps/dir/Residence+Inn+by+Marriott+Jersey+City,+80+Christopher+Columbus+Dr,+Jersey+City,+NJ+07302/230+Vesey+St,+New+York,+NY+10281/@40.7194593,-74.0476978,14z/am=t/data=!4m18!4m17!1m5!1m1!1s0x89c250ae0a76a127:0x1f127c0e6199930e!2m2!1d-74.0409582!2d40.7191013!1m5!1m1!1s0x89c25a1b0cd3c8cb:0xe84d008d21ac0f87!2m2!1d-74.0156903!2d40.7124742!2m3!6e1!7e2!8j1793005200!3e3

Future commute records must be keyed by hotel, exact destination, transit mode, weekday/arrival policy, and verification date. Recheck at least monthly and whenever a new hotel or destination is introduced.

## Production procedure after the prerequisites are resolved

This procedure is required behavior, not a statement that a checker is installed.

1. Fetch active criteria and preserve their verbatim text alongside structured fields. Treat unresolved free-text rules as questions; do not broaden eligibility silently.
2. Generate check-in windows in America/New_York. Criteria 1 allows check-in today through today + 28 days, inclusive, with preferred three-night Sunday/Monday/Tuesday starts and backup two-night Sunday/Monday/Tuesday/Wednesday starts. For the October 25 sample date, the latest permissible check-in is November 22. Checkouts may fall after that boundary; the boundary applies to check-in. Exclude Friday-night stays and split bookings.
3. Criteria 2 searches one-night stays starting December 22 through 26, 2026, inclusive, checking out by December 27. It has an USD 80 cap including taxes and mandatory fees. Criteria 1 has an USD 70 average-nightly cap before taxes and must display the full final total.
4. Search Lower Manhattan, Jersey City, Hoboken, Newark near Penn/PATH, Brooklyn, and Long Island City/Queens. Do not eliminate a property solely by straight-line distance.
5. Require an exact accepted rate name, dates, code, occupancy, all mandatory fees, and the appropriate price basis. Fail closed on unrecognized names, fallback warnings, partial data, rounded amounts near a cap, or missing exact totals.
6. Resolve each commute using fresh or valid monthly Google Maps evidence for the exact destination, weekday, and arrival time, including walks, ordinary waits, and transfers. The limit is strictly less than 45 minutes.
7. Rank windows per hotel: preferred duration tier, then lowest full-stay total. Keep one card per hotel per set; retain other verified windows as links.
8. The supervising agent independently opens each new/changed booking link in a fresh context and confirms property, dates, MMP, exact accepted rate, prices, and route evidence before publication.
9. Commit a successful set refresh atomically: replace that set's matches and compute new/removed/dates-changed against its previous successful result. Never turn a failed or partial search into a successful empty result.
10. On any set failure, retain its prior matches, mark them stale using their original verification time, and record a scoped error and run history. Pause/delete changes made during a run must prevent obsolete results from reappearing.
11. Read back the saved run and listings from the deployed database. A local data file or a successful script exit is not a verified cloud refresh.

Future delegated search tasks must contain the exact accepted/rejected names, cap and tax basis, commute policy, date windows, and a strict result schema with source evidence. This environment does not expose Sonnet as a subagent model; do not claim Sonnet delegation was performed.

## Deployment and operations acceptance checklist

- Owner-private mobile/desktop dashboard, light/dark modes, criteria CRUD/pause, evidence cards, and working images.
- Shared persistent criteria, listings, run history, run requests, and commute cache; no hardcoded live listings.
- Authenticated writer usable by a fresh scheduled session without credentials embedded in page source.
- Separate tests of source access, cloud writer authorization, and persisted readback.
- Actual scheduled runs timed ahead of 8:00am and 8:00pm America/New_York, with daylight saving handled and no claim that job creation guarantees timely completion.
- Working phone trigger with requested/running/finished/error state, deduplication, and failure reporting. A recorded request is not proof that a worker wakes to handle it.
- Full check for both sets, independently verified new/changed matches, and measured end-to-end runtime.
- Committed and pushed source, this runbook, selectors, rate/banners registry, schema, and migrations. Fresh runs must not depend on uncommitted local files.

Use the live Site state for the shipped schedule and check status. The cloud source restriction and incomplete exact-rate evidence remain operational limitations until a successful full check proves otherwise.

## Rollback and recovery

Preserve prior successful results and a source revision for recovery. Restore a prior version only after checking database migration compatibility; never erase listings to conceal a source failure.

For a source restriction, stop and ask the user to choose an allowed continuation. A Mac-based browser checker can be evaluated separately with a cloud dashboard if the user chooses that path; it is not permission to bypass an access restriction or sign in.

For a platform mismatch, use the user's deployment choice before provisioning. For a missing repository, obtain the repository URL rather than creating or pushing to an arbitrary account/repository.

## Additional holiday sample

On October 25, the local collector also opened Courtyard by Marriott New York World Trade Center Area for December 22–23, 2026. Its combined Associate/Friends rate displayed USD 324 per night with taxes and fees enabled, above the USD 80 cap. Its generic eligibility terms mentioned both associates and friends; they did not establish a distinct Associate-priced offer. This was a sample, not a complete holiday search.

The rate-details selector must include both aria-label=dialogTitle and aria-describedby=rateDetailsContent, and visibility. The site contains multiple hidden destination-fee dialogs using the same generic label.
