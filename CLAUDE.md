# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Google Apps Script web app ("MyTheMatix") that serves a single-page Hebrew
(RTL) registration form for a math tutoring program, and saves submissions to
a Google Sheet plus a Google Drive folder (signature images). There is no
build step, package manager, or test suite — this is 3 hand-written source
files deployed as-is into the Apps Script runtime.

## Source files (only these 3 are deployed)

- `Code.gs` — server-side Apps Script (V8 runtime). Handles `doGet()` (serves
  the page) and `saveRegistration(payload)` (validates, sanitizes, persists).
- `Index.html` — the entire client: inline `<style>` (~line 13–634), the form
  markup, and inline `<script>` (~line 951+) in a single IIFE. No external
  JS/CSS dependencies, no framework — vanilla DOM APIs.
- `appsscript.json` — manifest (V8 runtime, webapp executes as the deploying
  user, access `ANYONE_ANONYMOUS`).

`.claspignore` restricts `clasp push` to exactly these 3 files — everything
else (docs, the logo PNG) is intentionally excluded from deployment.

## Deployment

Managed via `clasp` (Google's Apps Script CLI), already linked to the live
project through `.clasp.json` (contains the script ID; safe to commit, no
secrets).

```
clasp push                          # uploads Code.gs / Index.html / appsscript.json
clasp deploy --deploymentId <ID>    # publishes to the live /exec URL (find ID via `clasp deployments`)
```

Reuse the existing `--deploymentId` so the public `.../exec` URL stays
stable — don't create a fresh deployment unless intentionally rotating the
URL. Full step-by-step context (including the from-scratch browser-only
path) is in `DEPLOYMENT_GUIDE.md`; rationale for using `clasp` vs. also
adding CI/CD is in `DEPLOYMENT_AUTOMATION.md`.

**CI/CD:** `.github/workflows/deploy.yml` runs the two commands above
automatically on every push to `main` that touches `Code.gs`,
`Index.html`, or `appsscript.json` — a push to `main` publishes straight
to the live site, with no review gate in between. It authenticates using
the `CLASP_CREDENTIALS` repo secret (contents of a `clasp login` session).

There is no local dev server or test harness — the only way to actually
exercise `saveRegistration` end-to-end is a real deployment (Apps Script has
no meaningful offline emulator for `SpreadsheetApp`/`DriveApp`). Sanity-check
HTML/CSS/client-JS changes by opening `Index.html` directly in a browser,
but note `google.script.run` calls will not work outside a real deployment.

## Server config (Script Properties, not in code)

`saveRegistration` reads three values from
`PropertiesService.getScriptProperties()` at runtime — these live in the
Apps Script project settings, not in this repo:

- `SPREADSHEET_ID` — target spreadsheet
- `SHEET_NAME` — target tab name (defaults to `'Registrations'` if unset)
- `SIGNATURE_FOLDER_ID` — Drive folder for signature PNGs

## Data flow / architecture

1. Client (`Index.html`) renders the form, runs a signature-pad on
   `<canvas>` (pointer/touch drawing), and does client-side required-field
   validation before allowing submit.
2. On submit, it builds a `payload` object (see the field list in the
   `submit` handler around Index.html:1194) including a base64 PNG data URL
   for the signature, a hidden honeypot field, and calls
   `google.script.run...saveRegistration(payload)`.
3. Server (`Code.gs`) re-validates independently (never trusts the client):
   - `validateRequiredFields_` checks `REQUIRED_FIELDS_` are present and that
     `is_science`/`parent_role` are constrained to known values.
   - Honeypot: if filled, silently returns a fake success (`buildSuccessResponse_`)
     without persisting anything — no error is surfaced to a bot.
   - `normalizePayload_`/`sanitizeText_` trims, strips control chars, caps
     length per `FIELD_MAX_LENGTHS_`, and prefixes a leading `'` on values
     starting with `=+-@` to prevent formula injection when the value lands
     in a Sheet cell.
   - `decodeSignature_` validates the `data:image/png;base64,` prefix and a
     max length before decoding.
4. A script lock (`LockService`) wraps the write so concurrent submissions
   don't race. The signature PNG is saved to Drive first; if the subsequent
   Sheet append fails, the just-created Drive file is trashed as a best-effort
   rollback (Apps Script has no real cross-service transactions).
5. `SHEET_HEADERS_` in `Code.gs` is the single source of truth for column
   order — it must stay in sync with the header row created in the Sheet
   during setup (see `DEPLOYMENT_GUIDE.md` Part 1).

## Conventions to preserve when editing

- All user-facing strings (errors, labels, button text) are Hebrew and the
  page is `dir="rtl"` — keep new strings Hebrew and consistent in tone with
  existing ones.
- Server errors returned to the client are generic/user-friendly Hebrew
  messages that never leak internal details (e.g. `'לא הצלחנו לשמור את
  ההרשמה...'`) — keep it that way; put specifics only in
  `exceptionLogging`/Stackdriver, not in thrown error text.
- Any new form field added client-side needs a matching entry in
  `REQUIRED_FIELDS_` and/or `FIELD_MAX_LENGTHS_` in `Code.gs`, and a new
  column in `SHEET_HEADERS_` (plus the actual Sheet header row) — the three
  must be kept in lockstep or `appendRegistration_` will misalign columns.
