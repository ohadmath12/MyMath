# Marathon registration and management

The owner manages future marathons and groups in the private Apps Script web app. Google Sheets is the single data store; the form and management app read/write the same records. No separate synchronization database exists.

Public flow: GitHub Pages `/marathons/` → existing Cloudflare Worker `/api/marathons` and `/api/marathon` → secret-authenticated dedicated Apps Script → marathon workbook.

Private flow: owner Google login → `doGet` HTML → authenticated `mwAdmin*` RPCs → same workbook. Every administrative RPC verifies the active user is the owner. Never use effective-user identity to authenticate web visitors. Anonymous public POST only accepts the catalog/intake operations. No participant data is exposed in catalog responses.

## Infrastructure
- Workbook: `1QEgeUA2bXlBFs2sl5QoZUxgBzvRlvxcbVJb0ptGgdG4`.
- Dedicated script: `10yjfPOG85mOasZ9Yoma3qXio6PQq_IsKNWnASjo44haCgH0VFdmkniBe`.
- Native `MarathonForm.gs` is the concatenation of `Intake.gs` and `Admin.gs`.
- Native `MarathonAdmin.html` is `Admin.html`.
- Existing `קוד.gs` maps to `Tracker.gs`; retain it.
- The existing repository clasp configuration belongs to regular registration. DO NOT retarget it or deploy marathon files through that workflow.
- Worker secrets: `MARATHON_SCRIPT_URL`, `MARATHON_GATEWAY_SECRET`. Matching secret remains in the dedicated script properties. Never put values in Git or documentation.

## Owner workflow
1. Create a campaign with its name, grade ז–יב, school (or all schools), and price. It starts as a draft.
2. Select `הרשמה פתוחה`; the event appears in the public form. The manager provides the preselected-event link to copy and publish manually.
3. Registrations appear in the pending column; the board refreshes every 30 seconds or on demand.
4. Create dated groups with a name/time, six seats each. Assign with each participant's dropdown. The server also enforces the six-seat limit.
5. Close registration through the status selector. No automatic parent messages are sent.

Campaigns live in `מרתונים להרשמה` A:G. Child groups use existing `מרתונים` A:K; J links the campaign and K stores capacity. Participants use existing A:X; X links the campaign, S identifies their assigned child group. Old rows/formulas are preserved.

New intake starts at `ממתין לשיבוץ`: quoted price is frozen in I, charge J is zero, and no payment is recorded. Assignment sets B/R/S and lets formulas calculate charge. Transfers retain price and payment. Paid participants cannot return to pending; attendance locks reassignment. Raw owner cell edits are not the capacity-enforced workflow; use the manager.

`קליטת טופס מרתונים` stores normalized intake durably before participant processing. UUID receipts prevent retry duplicates; same student/phone/campaign registration is audited without duplicate charges. Ambiguous names/phones or changed campaigns go to review. The five-minute retry trigger handles interrupted writes. Parent details and full source are in the private intake log. CRM transfer remains unimplemented and is a separate future action.

## Verification
Local tests: `node tests/marathon.test.cjs`, `node --test tests/marathon-worker.test.mjs tests/worker.test.mjs`, and `node tests/security.test.js`. Tests include anonymous/other-account admin denial.

Native V2 test passed 2026-10-03 in isolated workbook `1p56jWvDZPFs1Smtm9b4Jeqgvx5KuE7sE2FKd3nUrFVc`: pending formulas/no charge, assignment charge, capacity six, preserved price/payment after transfer, duplicate/retry behavior. Test campaign `TEST-760d4c0f`. Test helper removed before deployment. Historical production values and formulas compared unchanged after schema extension.

See the workspace `work/marathon-custom-status.json` for actual publication state and deployed URLs; source presence does not mean publication.
