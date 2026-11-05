# Marathon registration and management

The owner manages future marathons and groups in the private Apps Script web app. Google Sheets is the single data store; the form and management app read/write the same records. No separate synchronization database exists.

Public flow: GitHub Pages `/marathons/` → existing Cloudflare Worker `/api/marathon` → secret-authenticated dedicated Apps Script → marathon workbook.

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
1. Share the single `/marathons/` link. The parent selects school/city, grade and level, enters contact details, and can add the exam date. No marathon catalog or price is displayed.
2. General requests enter `בקשות כלליות — ממתינים לשיבוץ`. Filter by school, grade and level. The source log retains the parent details and optional exam date.
3. Create an internal marathon with name, grade, school (or all schools) and internal price; draft marathons can receive requests. Assign a matching request using `שיוך למרתון`.
4. Select the marathon in the top list, create groups with date and name/time, then choose a group for each student. Capacity is enforced at six.
5. Before grouping, payment or attendance, a general request can return to the inbox. Existing historical registrations retain their own original campaign/price. No automatic parent messages are sent.

`הרשמה פתוחה` / `הרשמה סגורה` are retained for backward compatibility with cached old forms. New general requests do not depend on a campaign being open. Closed campaigns cannot receive new general assignments.
Campaigns live in `מרתונים להרשמה` A:G. Child groups use existing `מרתונים` A:K; J links the campaign and K stores capacity. Participants use existing A:X; X links the campaign, S identifies their assigned child group. Old rows/formulas are preserved.

General intake starts at `ממתין לשיבוץ`: I (price), X (campaign) and S (group) are blank, J (charge) is zero, and no payment is recorded. Selecting an internal campaign freezes its price in I; J remains zero until grouping. Legacy event-specific requests retain their quoted-price validation. Assignment sets B/R/S and lets formulas calculate charge. Transfers retain price and payment. Paid participants cannot return to pending; attendance locks reassignment. Raw owner cell edits are not the capacity-enforced workflow; use the manager.

`קליטת טופס מרתונים` stores normalized intake durably before participant processing. UUID receipts prevent retry duplicates. Equivalent still-unassigned requests (student/phone/school/grade/level/exam date) are audited without adding another participant. A later exam or an already-assigned request can produce a new inbox item; assigning the same student twice to one campaign is blocked. New `kind: interest`, `city`, and `examDate` fields are stored in the existing S-column source JSON, preserving legacy receipt serialization. Same student/phone/campaign legacy registration is audited without duplicate charges. Ambiguous names/phones or changed campaigns go to review. The five-minute retry trigger handles interrupted writes. Parent details and full source are in the private intake log. CRM transfer remains unimplemented and is a separate future action.

## Verification
Local tests: `node tests/marathon.test.cjs`, `node --test tests/marathon-worker.test.mjs tests/worker.test.mjs`, and `node tests/security.test.js`. Tests include anonymous/other-account admin denial.

Native V2 test passed 2026-10-03 in isolated workbook `1p56jWvDZPFs1Smtm9b4Jeqgvx5KuE7sE2FKd3nUrFVc`: pending formulas/no charge, assignment charge, capacity six, preserved price/payment after transfer, duplicate/retry behavior. Test campaign `TEST-760d4c0f`. Test helper removed before deployment. Historical production values and formulas compared unchanged after schema extension.

See the workspace `work/marathon-custom-status.json` for actual publication state and deployed URLs; source presence does not mean publication.

## Deployment guard
`.github/workflows/marathon-script.yml` uses the existing production publishing credentials and an isolated clasp directory explicitly targeting the marathon project. It pulls native source first and refuses writes if any maintained native file differs from the verified baseline or the intended new source. It retains the native manifest and tracker and updates the two existing deployment IDs, without changing access or URLs. `MARATHON_MODE: inspect` is read-only; `publish` enables deployment. Do not publish the public generic form before both the Apps Script and Worker allowlist are ready.
