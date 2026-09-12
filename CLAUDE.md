# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"MyTheMatix" — a single-page Hebrew (RTL) registration form for a math
tutoring program. It is a **static site hosted on GitHub Pages**, plus a
**save-only Google Apps Script endpoint** that persists each submission to a
Google Sheet and writes the signature PNG to a Google Drive folder.

Live site: <https://ohadmath12.github.io/MyMath/>

There is no build step or package manager — `public/` is served verbatim and
the Apps Script file is pushed as-is into the Apps Script runtime. Security
validation helpers have a small Node test in `tests/security.test.js`.

### Why the split

Writing to Sheets/Drive requires OAuth (an API key only ever grants public
read), so a static page can never write there directly without embedding a
credential every visitor could read. Apps Script holds that credential and
**runs as the owner** — which is also why it can own Drive files. A service
account could not replace it: service accounts have no storage quota and cannot
own files in a consumer Drive.

Apps Script no longer serves the form. It used to, and that was the source of
a long tail of bugs: it wrapped the page in a cross-origin sandbox iframe on
`script.google.com`, which broke in-page anchors, made the favicon unreachable,
made `og:` tags impossible, and was the prime suspect for the page failing to
render on iOS. See `ISSUES.md`.

The one thing `doGet` still returns is a redirect stub pointing at `SITE_URL_`,
kept because the `/exec` link was already handed out and must not dead-end. It
redirects via `window.top` rather than a meta refresh on purpose — a meta
refresh would reload the real site *inside* that same sandbox iframe, restoring
every bug above.

## Layout

```
public/                 ← everything GitHub Pages serves, verbatim
  index.html            markup + inline SVG icon sprite (17 lucide symbols)
  styles.css            @font-face + .icon rules, then the original stylesheet
  app.js                one IIFE, vanilla DOM, ES5 (see below)
  .nojekyll             keeps Jekyll from eating files
  assets/
    logo.png            also serves as the favicon
    fonts/heebo-{hebrew,latin}.woff2
Code.gs                 doPost + saveRegistration and helpers, plus a doGet
                        that only redirects the old /exec URL to the site
appsscript.json         manifest (V8, executes as deployer, ANYONE_ANONYMOUS)
```

`.claspignore` restricts `clasp push` to exactly `Code.gs` and
`appsscript.json` — `public/` is never pushed to Apps Script.

**No external runtime dependencies.** Fonts are self-hosted and icons are an
inline sprite, deliberately: a render-blocking stylesheet on a third-party CDN
is a failure mode we cannot control, and a hung request shows a blank page.
Do not reintroduce a CDN `<link>`.

Heebo is a **variable** font — Google serves one file per unicode-range subset
covering the whole 100–900 axis, so the two files cover every weight the page
uses (400/500/600/700/800).

## Deployment

Two independent pipelines, split by path so they never both fire:

| Workflow | Fires on | Publishes |
|---|---|---|
| `.github/workflows/pages.yml` | `public/**` | the live site, via GitHub Pages |
| `.github/workflows/deploy.yml` | `Code.gs`, `appsscript.json` | the Apps Script endpoint, via clasp |

**Both publish straight to production on a push to `main`, with no review
gate.** Treat any such push as a release.

`pages.yml` needs no secrets — it uses the built-in `GITHUB_TOKEN` via OIDC.
Repo settings must have Pages → Source = **GitHub Actions** (not "Deploy from a
branch"), and the repo must stay **public** (Pages on a private repo requires
GitHub Pro).

### The Apps Script side

Managed via `clasp`, linked through `.clasp.json` (script ID; safe to commit).
The manual equivalent:

```
clasp push --force                  # uploads Code.gs / appsscript.json
clasp deploy --deploymentId AKfycbxe9SCJRyQAxbJV2bPN6ZiVwykl8xB1AYtgsv78jobOwj3y8mCedUaV8bvtFIvNwAaCfQ
```

Always reuse that `--deploymentId` — a bare `clasp deploy` mints a *new*
deployment and a new URL, which would silently break the live form, since
`ENDPOINT` in `public/app.js` is hard-coded to the current one. `--force` is
required non-interactively: without it the "manifest changed" prompt blocks on
stdin forever.

Prerequisites that live outside this repo:

- The **Apps Script API must be enabled for the deploying account**
  (`ohadmath12@gmail.com`) at `script.google.com/home/usersettings`. Account
  level, not project level.
- `CLASP_CREDENTIALS` holds that account's `~/.clasprc.json` from a
  `clasp login`. clasp v3 format is `{"tokens": {"default": {…}}}`; v2's
  `{"token": …}` will not work.

Known trap: `clasp push` failing with **"User has not enabled the Apps Script
API"** does *not* reliably mean the toggle is off — Google returns the same 403
when the request is effectively unauthenticated, so a missing or wrong-account
`CLASP_CREDENTIALS` looks identical. Check the toggle first, then the secret.

```
gh run list --repo ohadmath12/MyMath --limit 5
gh run view <run-id> --log-failed
clasp deployments      # live one should read "@N - ci <sha> <timestamp>"
```

## Testing

**The frontend can be exercised end-to-end locally**, which was impossible when
Apps Script served the page. The Apps Script response carries
`Access-Control-Allow-Origin: *`, so a form submitted from `localhost` writes a
real row to the real Sheet:

```
python3 -m http.server 8000 -d public
```

Use a junk name so the row is recognisable, and delete it afterwards.

There is still no offline emulator for `SpreadsheetApp`/`DriveApp`, so changes
to `Code.gs` itself can only be exercised against a real deployment.

Verifying a deploy actually landed is now straightforward — the site is plain
HTML, with none of the `\x3d` escaping Apps Script used to apply:

```
curl -sI https://ohadmath12.github.io/MyMath/
curl -s  https://ohadmath12.github.io/MyMath/ | grep -c 'og:image'
```

## Server config (Script Properties, not in code)

`saveRegistration` reads three values from
`PropertiesService.getScriptProperties()` at runtime, set in the Apps Script
project settings:

- `SPREADSHEET_ID` — target spreadsheet
- `SHEET_NAME` — target tab (defaults to `'Registrations'`)
- `SIGNATURE_FOLDER_ID` — Drive folder for signature PNGs

## Data flow

1. `public/index.html` renders the form and runs a signature pad on `<canvas>`
   (pointer/touch), with client-side required-field validation before submit.
2. On submit, `app.js` builds a `payload` (see the `submit` handler) including a
   base64 PNG data URL, a hidden honeypot, and POSTs it to `ENDPOINT`.
   **The request must use `Content-Type: text/plain`** — Apps Script has no
   `doOptions`, so a CORS preflight would get a 405 and the submission would
   never arrive. `text/plain` keeps it a CORS-simple request. Changing this to
   `application/json` silently breaks every submission.
3. `doPost` in `Code.gs` is a thin transport wrapper: it parses the JSON body,
   calls `saveRegistration`, and returns JSON. All logic lives in
   `saveRegistration`, which re-validates independently and never trusts the
   client:
   - `validateRequiredFields_` checks `REQUIRED_FIELDS_` and constrains
     `is_science` / `parent_role` to known values.
   - Honeypot: if filled, silently returns a fake success without persisting —
     no error is surfaced to a bot.
   - `normalizePayload_` / `sanitizeText_` trim, strip control chars, cap length
     per `FIELD_MAX_LENGTHS_`, and prefix `'` on values starting with `=+-@` to
     prevent formula injection in the Sheet.
   - Israeli ID checksum, email, school/class/units allowlists and the client
     submission identifier are validated again on the server.
   - `decodeSignature_` validates the PNG header, size and pixel dimensions.
4. A script lock (`LockService`) wraps the duplicate check and write. A stable
   `client_submission_id` is stored in trailing column X, so a browser retry
   returns the existing registration instead of creating a second row/file.
   The PNG goes to Drive first;
   if the Sheet append then fails, the just-created Drive file is trashed as a
   best-effort rollback (Apps Script has no cross-service transactions).
5. `SHEET_HEADERS_` is the single source of truth for column order — it must
   stay in sync with the Sheet's header row.

## Conventions to preserve when editing

- All user-facing strings are Hebrew and the page is `dir="rtl"` — keep new
  strings Hebrew and consistent in tone.
- Server errors returned to the client are generic, user-friendly Hebrew that
  never leaks internals. Put specifics in `exceptionLogging`/Stackdriver only.
- `app.js` is deliberately **ES5** — `.then()` callbacks, no `async`/`await`,
  no arrow functions, no optional chaining — because the audience is on phones
  and iOS forces every browser onto WebKit. The one modern API in use is
  feature-detected (`crypto.randomUUID`).
- Icons are `<svg class="icon"><use href="#icon-NAME"/></svg>`, resolved against
  the sprite at the top of `<body>`. Sized in `em` so they inherit from the
  parent's `font-size`. To add one, copy the symbol from `lucide-static` and
  strip the root `<svg>` attributes (the `.icon` CSS rule supplies them).
- Asset paths must stay **relative** (`./styles.css`). The site is served from
  the `/MyMath/` subpath, so a leading-slash path 404s. `og:image` is the
  exception — crawlers need it absolute.
- Any new form field needs a matching entry in `REQUIRED_FIELDS_` and/or
  `FIELD_MAX_LENGTHS_`, plus a new column in `SHEET_HEADERS_` *and* the real
  Sheet header row — the three must move in lockstep or `appendRegistration_`
  will misalign columns.
- This repo is the single source of truth. Don't edit `Code.gs` in the Apps
  Script web editor — the next `clasp push` overwrites it silently.

## Current architecture decision

Supabase/CRM is the long-term operational source of truth. The Sheet remains a
temporary intake/audit surface because the current CRM schema intentionally
does not store government ID or signature data. A future direct-to-CRM route
must first define private storage, retention, and access for those fields; the
Sheet should then become an optional sanitized operational mirror, not a
required hop.

## Known gaps

- Bot protection is the honeypot only, and `ENDPOINT` is public in client JS.
  Production still needs a server-side Turnstile check and real rate limiting,
  ideally through a same-origin edge gateway with a secret to Apps Script.
- The Sheet holds, for minors: full name, Israeli ID number, phone, email,
  school, parent details, and a signature image. Israel's Privacy Protection Law
  Amendment 13 took effect 14 Aug 2025 — worth confirming the Sheet and Drive
  folder aren't link-shared, and whether the ID number is needed at all.
