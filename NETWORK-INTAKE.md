# Network landing intake

Source: https://mythematix-network.ohadlavon1.chatgpt.site (owner-private until release).

- The dedicated Worker path `/api/network-lead` verifies this exact Origin, Turnstile hostname/action `network_lead`, and existing rate limits. It sends only allowlisted fields to the secret-protected existing Apps Script deployment.
- `NetworkLead.gs` validates again. Ganei Tikva uses existing CRM intake; server-owned `intake_channel=network_landing` labels new leads `דף הנחיתה`. Existing matching leads retain original details and receive source-specific history. CRM→Sheets mirror remains unchanged.
- Petah Tikva uses `ניהול לידים` workbook 15kR_-Sr6K5NRQM4zoD4-kU9Xq8qV1_5PWJIv5bLyOo4, sheet1800000004, row4 header contract. Stable receipt IDs, ScriptLock and readback protect retries. Do not delete the receipt column. Manual status/notes are preserved on retry. No partner-system or CRM write for PT.
- No registration, trial, marathon, message or payment creation. Existing routes, IDs and sharing are preserved.

## Database source attribution — installed 10/10/2026

`sql/20261010_network_lead_source.sql` was installed against live definition MD5 `7c4f54181ccc45e500ca9f1f41927c47`; resulting definition `55b017e7f1d79694d074b62974be8843`. Do not reapply. Before installation a rolled-back live transaction verified new source, identical retry, changed retry rejection, matching active lead reuse, unchanged regular public intake and zero student/message side effects. Post-install verified zero probe leads, anonymous execution false, expected definition hash. Function permissions were not changed.

## Release prerequisites / checks

Turnstile landing hostname added 10/10/2026, existing two hostnames retained, Managed mode and no pre-clearance retained. Publish Apps Script first, then Worker, then private Site. Only mark end-to-end complete after synthetic UI submissions are read back in both destinations and repeated delivery checked. A successful local mock test is not a live delivery test.

Frontend stores only a payload hash and receipt UUID in sessionStorage; raw contact data is not persisted there. Identical data in the same tab after reload reuses the receipt. This is not cross-device deduplication. PT intake currently deduplicates stable receipt IDs, not every independently repeated inquiry.
