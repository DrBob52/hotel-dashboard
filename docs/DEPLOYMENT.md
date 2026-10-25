# Deployment and verification

Private Site: https://mmp-rate-watch-dk52.dkhulusi.chatgpt.site

The Sites access policy was read back as custom with only the owner allowed. Shared D1 criteria and run history were read back from the deployed API. Both supplied criteria are present. The deployed writer was tested through /api/worker using supported service access acquired from Sites get_site, without placing credentials in source or browser code.

Cloud schedule: MMP hotel rate checks, ID Automation_6a94f2faa7808191bac54fad619400b9. Saved enabled for 7:30am and 7:30pm America/New_York, targeting results by 8:00am/8:00pm. Creation is confirmed; no successful fresh scheduled run has been verified. The native creation response had no task URL and no next-run timestamp.

Manual checks use two steps: save a request on the dashboard, then open ChatGPT → Scheduled → MMP hotel rate checks → Run now. No task-specific URL is required. Queue creation, deduplication, claim, and failure persistence were verified. Direct invocation from the Site is not exposed by the available integration. The user confirmed the task exists; a fresh scheduled-task execution and successful full search remain unverified. The dashboard distinguishes a saved request from a running check.

Initial hosted verification attempt: run 256facdc-9c36-4143-8ffc-c24de2dd2868 ended failed, with Lower Manhattan blocked and holidays incomplete. No complete full search or verified hotel match has been claimed. Full-check duration is unknown. Source observations and limitations are recorded in RUNBOOK.md.

Validation: production build and TypeScript check passed; nine domain tests passed for date windows, holiday boundaries, request deduplication, blocked-result retention, incomplete coverage, in-flight edits, deletion, stale editors, and missing evidence. Browser checks passed for criteria create/edit/pause/resume/delete, queue creation, mobile width, and light/dark mode. Test criteria were removed from the local preview. Hotel thumbnail rendering with a real qualifying listing remains unverified because none has been established.

The original Claude Artifact sources and documentation are retained separately. No deployed access has been made public, and no booking or sign-in to Marriott was performed.
