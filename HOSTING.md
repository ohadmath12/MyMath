# How to expose MyTheMatix on the internet — options & recommendation

Constraints taken as given: **must be free**, and **updating must be easy via
GitHub Actions**. Architecture, deployment and technology are all open to change.

---

## TL;DR

**Move the page off Apps Script and onto Cloudflare Workers (static assets),
keeping Apps Script only as the write-backend behind a small `/api/register`
function.**

```
Browser ──HTTPS──► Cloudflare Worker            ──POST──► Apps Script doPost ──► Google Sheet
  (real origin,     ├── static assets (HTML/CSS/JS/logo)   (shared secret)        + Drive folder
   no iframe)       └── /api/register  (Turnstile + rate limit + forward)
```

Why this and not something else:

- It is the **only change that fixes all three open bugs in `ISSUES.md` at
  once** — they are all symptoms of the Apps Script iframe sandbox, not of our
  code. Serving the page from a normal origin makes them evaporate.
- Cost: **$0**. Workers free tier is 100k requests/day and *static asset
  requests are free and unlimited*; the free `*.workers.dev` hostname is a real
  origin. A custom domain (~$10/yr) is optional, not required.
- Deployment becomes `cloudflare/wrangler-action@v4` + one non-expiring API
  token secret — strictly simpler and more robust than the current clasp/OAuth
  pipeline.
- Persistence logic that already works and is already hardened (locking,
  formula-injection escaping, Drive rollback) is **not rewritten**.

Full replacement of Apps Script is possible and also free, but it has a real
trap (service accounts cannot write to a consumer Drive) and is best treated as
an optional phase 2. See [Option B](#option-b--all-in-on-cloudflare-drop-apps-script).

---

## 1. What the app actually is

Derived from the repo, so the recommendation is anchored to reality:

| | |
|---|---|
| Frontend | One static page. `Index.html`, 1,233 lines / 165 KB. Vanilla DOM, no framework, no build step. |
| Interactivity | 15 form controls + a `<canvas>` signature pad → base64 PNG. |
| Backend surface | Exactly one call: `saveRegistration(payload)` (`Code.gs:78`). |
| Persistence | One row appended to a Google Sheet + one PNG written to a Drive folder. |
| Auth | None. Public, anonymous (`ANYONE_ANONYMOUS`, `executeAs: USER_DEPLOYING`). |
| Traffic shape | Near-zero baseline, **bursty** — a link blasted to a parents' WhatsApp group. |
| Audience | Hebrew RTL, parents, overwhelmingly **on phones**. |

Two things follow immediately:

1. The backend is *trivial* — one append. Almost any host can do it. The
   interesting constraint is not compute, it's that **the tutor reads
   registrations in a spreadsheet**. Don't take the Sheet away.
2. The frontend is a **static file**. It does not need Apps Script at all, and
   Apps Script is actively bad at serving it (next section).

---

## 2. Why the current hosting is the problem

Apps Script does not serve `Index.html` as a page. It serves a wrapper on
`script.google.com` whose body is an iframe pointed at
`*.googleusercontent.com/userCodeAppPanel`, and injects our markup into it
cross-origin via `postMessage`, once, at load. Two documents, two origins,
ours is the inner one. (Verified against the live URL — see `ISSUES.md`.)

Every open bug is a direct consequence:

| Issue | Root cause | Survives the move? |
|---|---|---|
| **#3 Blank page on iPhone** (Safari + Chrome iOS + WhatsApp browser — all WebKit) | Content lives in a `100%`-height iframe inside Google's wrapper table; iOS WebKit's iframe height behaviour collapses it. Chromium at iPhone viewport renders fine, so it is engine + iframe specific, not our CSS. | **No — fixed.** No iframe, no wrapper. |
| **#2 CTA leads to a blank page** | `href="#registration-section"` navigates the iframe to `/userCodeAppPanel#…`, which reloads the bare sandbox shell; the init handshake never re-runs. | **No — fixed.** Hash links work normally on a real page. |
| **#1 Wrong favicon** | `<link rel="icon">` is inside the injected markup, so it only ever lands in the iframe. The tab is owned by the outer document, which has no icon. Fixing it needs `setFaviconUrl(url)` — which needs a public HTTPS URL anyway. | **No — fixed**, and the hosting decision it was blocked on is this document. |

Beyond the bugs, things that are simply **impossible** on Apps Script:

- **No custom domain, ever.** Apps Script web apps always live at
  `script.google.com/macros/s/AKfycbxe.../exec`. The only "workaround" is
  embedding that same iframe in your own page — i.e. keeping the bug.
  For a paid tutoring program, a 90-character Google URL is a trust problem.
- **No WhatsApp/social link preview.** Open Graph tags in the injected markup
  never reach the crawler — the outer document owns `<head>`, and it has no
  `og:*`. Since the primary distribution channel is a WhatsApp message, this
  matters more than it sounds.
- **No SEO / indexing.**
- **No staging.** Today a push to `main` touching the 3 source files publishes
  straight to the live public site. The only way to test is production.
- **Concurrency ceiling.** Anonymous web apps all execute *as the deploying
  user*, so all traffic shares that account's quota: **30 simultaneous
  executions**, and `LockService` serialises writes on top. Fine at trickle;
  a burst of parents opening a WhatsApp link at once is exactly the load shape
  this is weakest against.
- **Fragile CI.** The current pipeline needs an OAuth refresh token in
  `CLASP_CREDENTIALS`, plus an account-level Apps Script API toggle that lives
  outside the repo — and `CLAUDE.md` already documents the trap where a bad
  secret and a disabled toggle return the *same* 403.

Also worth noting, since `CLAUDE.md` currently claims otherwise: the client is
**not** dependency-free. `Index.html:9-12` pulls four external resources, two of
them render-blocking stylesheets (Google Fonts Heebo, and `lucide.css` — 97 KB
fetched to use **17 icons**). A render-blocking stylesheet that hangs shows a
blank page until timeout, which is a third-party failure mode we don't control
and a live suspect for issue #3.

---

## 3. Recommendation — Option A: static on Cloudflare, Apps Script as the write API

### Architecture

```
┌──────────────────────────────────────────────────────────┐
│ Cloudflare Worker  (free plan, mythematix.workers.dev)   │
│                                                          │
│  GET  /*             → static assets (free & unlimited)  │
│                        index.html, styles.css, app.js,   │
│                        logo.webp, icons.svg              │
│                                                          │
│  POST /api/register  → 1. verify Turnstile token         │
│                        2. rate-limit by IP               │
│                        3. forward + shared secret        │
└───────────────────────────┬──────────────────────────────┘
                            │  server-to-server, no CORS
                            ▼
┌──────────────────────────────────────────────────────────┐
│ Apps Script  doPost()   (unchanged persistence logic)    │
│   validate → sanitize → Drive PNG → Sheet append         │
└──────────────────────────────────────────────────────────┘
```

### Why the Worker proxy rather than posting to Apps Script directly

Posting from the browser straight to `/exec` works, but only via a known hack:
Apps Script exposes no `doOptions`, so any CORS preflight gets a 405. You must
send `Content-Type: text/plain;charset=utf-8` to keep it a "simple request".
That's stable and widely used, but it is a workaround.

Routing through the Worker means the browser talks to **its own origin** — no
CORS at all, no hack — and buys three things for free along the way:

1. **Turnstile verification server-side** before anything touches Apps Script.
   (Today the only bot defence is a honeypot.)
2. **Rate limiting at the edge**, protecting the 30-simultaneous-execution
   ceiling from a burst or an abuser.
3. **The Apps Script URL stops being a public endpoint in client JS.** It stays
   technically reachable, so the shared secret is the real gate — but the
   scraping surface disappears.

### What changes in the repo

```
├── public/                 ← static assets, served by the Worker
│   ├── index.html          ← Index.html, minus the base64 blobs
│   ├── styles.css          ← extracted from the inline <style>
│   ├── app.js              ← extracted from the inline <script>, + Turnstile
│   ├── logo.webp           ← real file, not a 62 KB base64 string ×2
│   └── icons.svg           ← 17 inline symbols, replacing 97 KB of lucide.css
├── src/index.ts            ← the Worker: /api/register
├── wrangler.toml
├── Code.gs                 ← saveRegistration → doPost wrapper; logic unchanged
└── .github/workflows/
    ├── deploy-site.yml     ← wrangler-action; runs on public/ + src/ changes
    └── deploy.yml          ← existing clasp workflow; only on Code.gs changes
```

`Code.gs` needs one small addition, not a rewrite — a `doPost` that unwraps the
JSON, checks the shared secret, and calls the existing `saveRegistration`:

```js
function doPost(e) {
  var body = JSON.parse(e.postData.contents);
  if (body.secret !== PropertiesService.getScriptProperties().getProperty('API_SECRET')) {
    return json_({ ok: false });          // no detail leaked
  }
  return json_(saveRegistration(body.payload));
}
```

`doGet` can then either 302 to the new site or be deleted.

### Deployment

```yaml
name: Deploy site
on:
  push:
    branches: [main]
    paths: ['public/**', 'src/**', 'wrangler.toml']
  workflow_dispatch:
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: cloudflare/wrangler-action@v4
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

That is the whole thing. One scoped API token as a repo secret — no OAuth
refresh token, no account-level toggle living outside the repo, no
"manifest changed" stdin prompt, no `--deploymentId` you must remember to reuse
or you silently mint a new public URL.

You also get **preview deployments per branch/PR**, which finally gives a
staging environment — the thing `ISSUES.md` says it needs to reproduce the iOS
bug safely without touching production.

### Cost

| | Free tier | This app's usage |
|---|---|---|
| Workers requests | 100,000/day | form posts only — static assets don't count |
| Static asset requests | **free & unlimited** | all page loads |
| Worker CPU | 10 ms/invocation | a JSON forward; nowhere near |
| Turnstile | unlimited, free | — |
| `*.workers.dev` hostname | included | — |
| Custom domain | needs a domain you own (~$10/yr) | **optional** |

Genuinely $0 unless you choose to buy a domain. Worth noting `.workers.dev` is
occasionally caught by school/corporate content filters — given the audience,
a real domain is the one paid upgrade actually worth considering.

### Effort

Roughly a day. The bulk is mechanical: split `Index.html` into three files,
replace the two 62 KB base64 blobs with a real image, inline 17 SVG icons,
self-host or drop the Heebo font, swap `google.script.run` for `fetch`.

---

## 4. Alternatives considered

### Option B — all-in on Cloudflare, drop Apps Script

Worker serves the site *and* writes the data: registration row via the Google
Sheets API using a service-account JWT signed with WebCrypto, signature PNG to
R2 (10 GB + 1M writes/month free).

**Upside:** one stack, one pipeline, one set of secrets. The clasp fragility
disappears entirely.

**The trap:** you cannot keep signatures in Drive this way. **Service accounts
have no storage quota and cannot own files** — creating a file in a folder
shared from a `gmail.com` account fails with `storageQuotaExceeded`. The
documented fixes are a Shared Drive (Workspace only, not free) or OAuth
delegation (back to managing refresh tokens — the exact thing we're escaping).
Hence signatures must move to R2, which is fine technically but means the PNG
is no longer sitting next to the Sheet in the owner's own Drive.

**Verdict:** viable, free, and cleaner in the long run — but it rewrites
working, hardened persistence code and changes where the owner's data lives.
Do it as **phase 2** if the clasp pipeline keeps hurting, not as the first move.

### Option C — GitHub Pages + direct POST to Apps Script

Static site on GitHub Pages (free, `actions/deploy-pages`), browser posts
straight to `/exec` with the `text/plain` CORS trick. Turnstile can still be
verified server-side from Apps Script via `UrlFetchApp` (20k/day quota is
ample).

**Upside:** zero new vendors, no Cloudflare account, simplest possible
pipeline. Fixes all three bugs, same as Option A.

**Downside:** no edge function → no rate limiting, the Apps Script URL is back
in client JS, the CORS workaround stays, and Pages gives one environment (no
per-PR previews). Also custom domains on Pages are fine, but Pages is
HTTPS-static-only with no server-side anything, so you're stuck if you ever
need a redirect, a header, or a secret.

**Verdict:** the right pick **only if** you want to avoid a Cloudflare account.
Otherwise Option A is the same effort for strictly more capability.

### Option D — Firebase Hosting + Cloud Functions + Firestore

Same-vendor coherence with the existing Google data, good custom-domain story.
**Rejected on the "free" constraint:** Cloud Functions requires the Blaze
pay-as-you-go plan with a card on file. Actual bills would be ~zero, but it is
not free-by-construction, and it's meaningfully heavier ops than a single
Worker for one form endpoint.

### Option E — Vercel / Netlify

Both work and both have usable free tiers. Rejected as the recommendation
because their free tiers are commercial-use-restricted and have historically
moved more than Cloudflare's, and neither offers anything Option A doesn't for
this workload.

### Option F — a hosted form product (Tally / Fillout / Jotform)

Signature fields and Hebrew RTL are supported, and it removes essentially all
engineering. **Rejected:** it throws away the bespoke landing page — the
program description, payment terms, and terms-and-conditions sections that make
up two-thirds of the page — and you'd be embedding it in a site you have to
host anyway. Worth reconsidering only if the custom page stops mattering.

---

## 5. Worth fixing while you're in there

Found while reading the code; independent of which option you pick.

1. **Idempotency is generated but never used.** The client builds
   `client_submission_id` (`Index.html:1209`) and sends it, but it appears in
   neither `FIELD_MAX_LENGTHS_`, `SHEET_HEADERS_`, nor any server code — so it
   is silently dropped. A double-tap on a flaky phone connection writes two
   rows. Persist it and skip on repeat.

2. **165 KB page, ~76% of it avoidable.** The 62,831-character base64 logo is
   embedded **twice** (favicon at `:7` and header at `:642`) — ~125 KB of the
   file. On a real host that's one cached `.webp`. Plus 97 KB of `lucide.css`
   for 17 icons that should be inline SVG. Both matter a lot on the mobile
   connections this audience is on, and removing the two external stylesheets
   also eliminates the third-party failure mode suspected in issue #3.

3. **PII sensitivity.** The Sheet holds, for minors: full name, **Israeli ID
   number**, phone, email, school, class, parent name and email, plus a
   **signature image**. Israel's Privacy Protection Law Amendment 13 took
   effect 14 Aug 2025 with GDPR-style obligations and administrative fines.
   Not legal advice — but three cheap, clearly-good steps: (a) ask whether the
   ID number is genuinely needed at registration, since dropping it removes the
   most sensitive field entirely; (b) confirm the Drive signatures folder and
   the Sheet are not link-shared and are restricted to the owner; (c) add a
   short Hebrew privacy notice to the form covering what's collected, why, and
   retention. Verify the rest with counsel.

4. **No confirmation to the registrant.** A parent submits and gets an on-page
   message only. A confirmation email is easy from either backend and removes a
   whole class of "did it go through?" follow-ups — which is also what drives
   the duplicate submissions in (1).

---

## 6. Suggested order

1. **Split the frontend** into `public/` — real logo file, inline SVG icons,
   drop the two external stylesheets. Pure refactor, no behaviour change, and
   independently valuable under every option.
2. **Stand up the Worker** with `/api/register` forwarding to a new Apps Script
   `doPost`. Deploy to `*.workers.dev` and test the real URL on the actual
   iPhone — production is untouched throughout, which is exactly the safe
   staging path `ISSUES.md` asks for.
3. **Confirm issue #3 is gone on the phone**, then fix #2 and #1 (both become
   trivial or moot on a normal origin).
4. **Cut over**: point `doGet` at a 302 to the new URL so the old link in
   circulation keeps working, and reshare the new one.
5. Optional: buy a domain; then Option B if the clasp pipeline keeps hurting.

---

## Sources

- [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) — free plan limits; static asset requests free and unlimited
- [Migrate from Pages to Workers](https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/) — Workers with static assets is the recommended path for new projects
- [cloudflare/wrangler-action](https://github.com/cloudflare/wrangler-action) — the deploy action
- [Turnstile is free for everyone](https://blog.cloudflare.com/turnstile-ga/)
- [Apps Script quotas & limitations](https://developers.google.com/apps-script/guides/services/quotas) — 30 simultaneous executions/user, 6 min/execution
- [Apps Script HTML Service restrictions](https://developers.google.com/apps-script/guides/html/restrictions) and [IFRAME sandbox mode](https://developers.google.com/apps-script/migration/iframe) — the sandbox model behind issues #1–#3
- [Is it possible to run an Apps Script web app on my own domain?](https://groups.google.com/g/google-apps-script-community/c/c2BDl3nMsFI) — no true custom domain support
- [So you want to send JSON to a Google Apps Script Web App](https://blog.greenflux.us/so-you-want-to-send-json-to-a-google-apps-script-web-app/) — no `doOptions`, hence the `text/plain` CORS workaround
- [Service accounts do not have storage quota](https://discuss.google.dev/t/storagequotaexceeded-the-users-drive-storage-quota-has-been-exceeded-for-service-account/104375) and [Drive API error guide](https://developers.google.com/workspace/drive/api/guides/handle-errors) — the Option B trap
- [Israel marks a new era in privacy law: Amendment 13](https://iapp.org/news/a/israel-marks-a-new-era-in-privacy-law-amendment-13-ushers-in-sweeping-reform) and [Pearl Cohen: Amendment takes effect](https://www.pearlcohen.com/israel-significant-amendment-to-the-privacy-law-takes-effect/) — effective 14 Aug 2025
