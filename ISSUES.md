# Known issues

> **Status update — superseded by the GitHub Pages migration.**
> The page is no longer served by Apps Script, so the sandbox iframe that
> caused issues 1 and 2 is gone entirely; both are **fixed**. Issue 3's two
> strongest suspects (RTL horizontal overflow from the honeypot, and the
> render-blocking third-party stylesheets) are also both **fixed** — but it
> was never reproduced on real WebKit, so it stays **open until confirmed on
> an actual iPhone**. Everything below is kept as the diagnostic record.

Live deployment under investigation:
`https://script.google.com/macros/s/AKfycbxe9SCJRyQAxbJV2bPN6ZiVwykl8xB1AYtgsv78jobOwj3y8mCedUaV8bvtFIvNwAaCfQ/exec`
(deployment `@4 - ci 2a147ca`, i.e. current source).

## Background: how Apps Script actually serves this page

Everything below follows from one fact, confirmed by fetching the live URL:

Apps Script does **not** serve `Index.html` as the page. It serves a small
wrapper page on `script.google.com` whose `<body>` is a single iframe:

```
el.src = 'https://n-sc6goqrhzimqhtzvayiiu65e4lhgc6xwybx6pza-0lu-script.googleusercontent.com/userCodeAppPanel';
```

Our entire `Index.html` is embedded in the wrapper as an escaped JS string
(`userHtml` inside the `goog.script.init(...)` call) and pushed into that
iframe **cross-origin, via postMessage, once, at load time**.

So there are two documents with two different origins:

| | outer wrapper | our page |
|---|---|---|
| origin | `script.google.com` | `*.googleusercontent.com` |
| supplies | `<title>`, favicon, viewport | all our markup/CSS/JS |
| controlled by | `doGet()` in `Code.gs` | `Index.html` |

Issues 1 and 2 are both direct consequences of that split.

---

## Issue 1 — Browser tab shows the wrong icon (not our logo)

**Status:** confirmed, root cause known.

**Symptom:** the Chrome tab shows Google's generic Apps Script / Drive icon
instead of the MyTheMatix logo.

**Root cause:** `Index.html:7` sets the favicon:

```html
<link rel="icon" type="image/png" href="data:image/png;base64,iVBORw0…">
```

That tag is inside `userHtml`, so it only ever lands **inside the iframe**.
The browser tab is owned by the outer wrapper document, and that document's
`<head>` contains no favicon at all — verified against the live response:

```
$ curl -sL <exec URL> | grep -c 'rel="icon"'
0
```

The outer `<head>` is exactly: `chromevox` meta, `<title>`, viewport,
Material Icons CSS, `mae_html_css_rtl.css`, warden JS. Nothing else. With no
icon declared, Chrome falls back to the site default for `script.google.com`.

Note the `<title>` *is* correct, because `doGet()` sets it explicitly via
`.setTitle('MyTheMatix — הרשמה')` — the same mechanism the favicon needs.

**Fix direction:** `HtmlService` exposes `.setFaviconUrl(url)`, which injects
the `<link rel="icon">` into the *outer* document. Constraint: it takes a
URL, not a data URI, so the logo has to be reachable at a public HTTPS URL
(the 62 KB base64 blob currently inlined in `Index.html:7` can't be used
as-is). Needs a hosting decision — see notes when we get to it.

---

## Issue 2 — "למעבר להרשמה" button leads to a blank page

**Status: FIXED** (not yet deployed).

**Symptom:** clicking the hero CTA navigates away to a blank page.

**Root cause:** `Index.html:651`

```html
<a href="#registration-section" class="btn btn-primary">
```

The anchor target does exist (`Index.html:773`, `<section id="registration-section">`),
so this is not a broken/missing ID — in a normal page it would scroll fine.

The problem is the iframe. Our document's real URL is
`https://n-sc6…-script.googleusercontent.com/userCodeAppPanel`. Clicking the
link makes the browser navigate the iframe to:

```
https://n-sc6…-script.googleusercontent.com/userCodeAppPanel#registration-section
```

That is a genuine navigation, not an in-page scroll, because the document was
never loaded from a URL that carries our content — the content arrived by
postMessage from the parent during `goog.script.init`. Reloading
`/userCodeAppPanel` fetches the bare sandbox shell, the init handshake does
not re-run, and nothing is ever injected. Result: **blank page**, exactly as
reported.

Any `href="#…"` link in this app has the same problem. Currently there is
only this one (`grep -n 'href="#' Index.html` → single hit at line 651).

**Fix applied:** a delegated handler in the client IIFE intercepts every
`a[href^="#"]`, calls `preventDefault()`, and scrolls with
`scrollIntoView({ behavior: 'smooth', block: 'start' })`. The `href` stays in
the markup for accessibility and right-click/"open in new tab". Written
generically so any hash link added later is covered automatically.

Fixing this cleanly required fixing two underlying layout bugs first — the
scroll landed in the wrong place until they were dealt with. See "Bugs found
while fixing issue 2" below; both are also the leading candidates for issue 3.

**Verified** with Playwright at iPhone 13 and Desktop Chrome viewports:

```
iPhone 13       y:0->3942  hash=''  targetTop=0  errors=none  => PASS
Desktop Chrome  y:0->3174  hash=''  targetTop=0  errors=none  => PASS
```

i.e. the page scrolls, the target lands exactly at the top of the viewport,
`location.hash` never changes (so no navigation, so no blank page), and no JS
errors are thrown.

---

## Bugs found while fixing issue 2

Both were found by instrumenting the page rather than reading it, and both are
plausible causes of issue 3. Neither is cosmetic.

### 2a. `left: -9999px` honeypot created ~10,000px of horizontal overflow

`.visually-hidden` (the honeypot wrapper) hid itself by pushing off-screen with
`left: -9999px`. The page is `dir="rtl"`. In an RTL document the inline start
edge is on the *right*, so an element pushed to negative `left` overflows the
**scrollable** end of the box rather than being harmlessly clipped. Measured at
every viewport width tested:

```
w= 320  hScroll=YES  scrollW=10319/320
w= 390  hScroll=YES  scrollW=10389/390
w=1280  hScroll=YES  scrollW=11279/1280
```

The document was ~10,300px wide at all times. This also corrupted layout
metrics: `scrollHeight` reported 6663 while the real maximum scroll offset was
4007 — a phantom 1992px, which is exactly the amount by which `scrollIntoView`
was missing its target.

Fixed by clipping in place (`clip` + `clip-path: inset(50%)`, 1×1px, negative
margin) instead of offsetting. Honeypot behaviour is unchanged and verified:
still in the DOM, still `name="honeypot"`, still `tabindex="-1"`,
`aria-hidden="true"`, renders zero visible pixels, and is still settable by a
bot — so `saveRegistration`'s silent-success path is unaffected.

### 2b. `overflow-x: hidden` on `html, body` made `<body>` a scroll container

This was on `html, body` to paper over 2a. Per CSS spec, once one axis is not
`visible`, the other computes from `visible` to `auto` — so this silently gave
**both** `html` and `body` `overflow-y: auto`:

```
html: { overflowX: "hidden", overflowY: "auto",  clientH: 664,  scrollH: 6663 }
body: { overflowX: "hidden", overflowY: "auto",  clientH: 6663, scrollH: 6663 }
```

A nested scroll container on `<body>` broke `scrollIntoView`, and a scrollable
`<body>` inside the Apps Script sandbox iframe is a configuration WebKit is
known to handle badly. Removed, with a comment in the CSS explaining why it
must not be reintroduced. With 2a fixed there is no horizontal overflow left to
hide — confirmed no horizontal scrollbar at 320/360/390/414/640/768/1024/1280px.

---

## Issue 3 — Page does not load at all on mobile

**Status:** under investigation — server ruled out, exact client symptom
still needed.

**What has been ruled out:**

- *Not a server/delivery failure.* Fetching the live URL with an iPhone
  user-agent returns `200` and 194,727 bytes — versus 194,696 bytes for
  desktop. Diffing the two responses shows the only differences are per-request
  CSP `nonce` values. Google serves mobile and desktop **byte-for-byte the
  same page**; nothing is being blocked or redirected at the HTTP layer.
- *Not a missing viewport.* `doGet()` (`Code.gs:68`) already calls
  `.addMetaTag('viewport', 'width=device-width, initial-scale=1')`, and the
  tag is present in the live outer `<head>`. This is the usual Apps Script
  mobile trap and it is already handled correctly.
- *Not a JS crash blanking the content.* All form markup is static HTML, not
  JS-generated, so even a thrown exception would leave the page visible. The
  client script is plain ES5 (no optional chaining, no modern syntax), and the
  one modern API used is already feature-detected:
  `(window.crypto && crypto.randomUUID) ? … : String(Date.now())`
  (`Index.html:1196`).
- *Not the responsive CSS.* The two breakpoints (`Index.html:623` and `:628`)
  only change grid columns, padding and button width. Nothing hides content.
  `#registration-section.hidden` (`Index.html:612`) is dead CSS — no code ever
  adds that class.

**Reported symptom (confirmed with the site owner):** a blank page, on
**iPhone**, in **Safari, Chrome iOS, and the WhatsApp in-app browser alike**.

That combination is itself diagnostic: on iOS every browser is required to use
WebKit, so all three are the *same engine*. This is one WebKit failure, not
three separate browser bugs — and it is not specific to in-app webviews, since
real Safari fails too.

**Renders correctly under Chromium at iPhone viewport.** Driving the live URL
with Playwright (iPhone 13 emulation — 390×844, DPR 3, iOS user-agent):

```
frames=3
  [outer]  script.google.com …            bodyLen=193157  (warning bar only)
  [shell]  …googleusercontent.com/userCod bodyLen=398     (empty sandbox shell)
  [ours]   …googleusercontent.com/userCod bodyLen=86414   scrollHeight=6663
           text: "שנת הלימודים תשפ״ז · 26–27 תוכנית מתמטיקה אישית…"
console: no errors, no pageerror, no failed requests for our assets
```

The cross-origin handshake completes, our markup lands in the iframe, and
6663px of content lays out. So the bug is **not** in our HTML/CSS/JS as such —
it is engine-specific, and Chromium cannot reproduce it.

Attempting the same run under Playwright's real WebKit build failed: the
browser binary downloads, but launching it needs ~196 system packages
(`npx playwright install-deps webkit`) which require root on this machine.
Getting WebKit running locally is the fastest route to a reproduction.

**NEW leading hypothesis (found while fixing issue 2): the RTL honeypot
overflow.** See "Bugs found while fixing issue 2" above. The document was
~10,300px wide at every viewport size, because `left: -9999px` in an RTL
document produces scrollable overflow. Why this is a strong fit for a blank
iPhone page specifically:

- Our content sits in an iframe that iOS Safari expands to *content* size
  rather than scrolling internally. A ~10,300px-wide document would blow the
  iframe out to ~10,300px wide inside a table cell laid out for ~390px.
- The real content would then occupy roughly 4% of the visible width, with the
  remaining ~96% being empty background — which reads as **a blank page**.
- `overflow-x: hidden` was supposed to prevent this, but it was set on
  `html, body`, and WebKit has long-standing bugs where root-element
  `overflow-x: hidden` fails to clip — particularly inside iframes and in RTL.
  Chromium clips it correctly, which is exactly why Chromium could not
  reproduce the bug while the iPhone could.
- It explains why *all three* iOS browsers fail identically (one engine) while
  desktop is fine (clipping works there).

Both underlying bugs are now fixed at the source rather than masked. **This may
well have fixed issue 3 as a side effect — but that is unverified.** It has not
been tested on a real iPhone or in real WebKit, and it remains a hypothesis,
not a confirmed diagnosis. Do not close issue 3 on the strength of it; confirm
on the device.

**Older hypotheses, still open if the above does not resolve it:**

1. **iOS iframe height collapse.** Google's wrapper is a `<table class="full_size">`
   whose second row is `<td style="height: 100%">` containing the iframe. iOS
   Safari famously refuses to scroll inside an iframe and instead expands it to
   content height. Our content is 6663px tall inside a cell asked to be `100%`
   of a full-height table. If that collapses, the visible result is the warning
   bar plus empty space — i.e. a blank page — with a healthy 200 response.
   Fits every observation, including failure in real Safari.
2. **Third-party storage blocked.** iOS *Prevent Cross-Site Tracking* is on by
   default, and iCloud Private Relay is common; either can interfere with the
   `script.google.com` → `googleusercontent.com` injection. Weaker than (1),
   because it would break essentially every Apps Script web app on iPhone, not
   just this one.
3. **External stylesheet blocked on that device/network** — see below.

**Note — `CLAUDE.md` is wrong about external dependencies.** It states the
client has "No external JS/CSS dependencies." In fact `Index.html:9-12` pulls
**four** external resources, two of them render-blocking stylesheets:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Heebo:…" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/lucide-static@1.28.0/font/lucide.css">
```

Both stylesheets currently return 200 from a desktop connection (Heebo 1,060 B;
lucide 97,681 B), so they are not broken *per se*. But a render-blocking
stylesheet that hangs shows a blank page until the request times out, and these
are the only parts of the app that can fail for reasons entirely outside our
control — a carrier-level block, a DNS content-filter, or a Safari content
blocker on that one phone would hit all three iOS browsers identically, which
matches the report. Worth removing regardless of whether it is the root cause:
the 17 lucide icons used (`grep -o 'icon-[a-z-]*'`) can be inlined as SVG, and
Heebo can fall back to the system Hebrew stack.

**Status: paused, by decision (2026-08-08).** Getting a real WebKit
reproduction was deferred, and no staging deployment or throwaway Apps Script
project is to be created. Investigation stops here for now; the analysis above
is the handoff.

**To resume, pick one:**

- *Local WebKit (no Google-account footprint).* Playwright's WebKit binary is
  already downloaded to `~/.cache/ms-playwright/webkit-2336`; only the system
  libraries are missing. One command unblocks it:
  ```
  sudo npx --yes playwright install-deps webkit
  ```
  Then re-run the iPhone probe against real WebKit and compare with the
  Chromium result recorded above.
- *Staging deployment.* `clasp deploy` **without** `--deploymentId` mints a new
  version on a new URL; production stays pinned at `@4`. Test that URL on the
  iPhone, then promote with `clasp deploy --deploymentId <prod-id>` once fixed.
  Reversible via `clasp undeploy`.

**Cheap thing to try first when resuming:** hypotheses 1 and 3 have a shared,
zero-risk probe — strip `Index.html` down to a bare "hello" page (no external
stylesheets, little content) and load it on the iPhone. If that is *also*
blank, the cause is the Apps Script sandbox on iOS (hypothesis 1/2) and no
amount of editing our CSS will help. If it renders, bisect back toward the full
page. This distinguishes "our page is at fault" from "the platform is at
fault", which is the single most valuable unknown remaining.

---

## Fix order

1. **Issue 3 (mobile)** — highest impact; if parents on phones can't open the
   form, the app is effectively down for its main audience.
2. **Issue 2 (CTA)** — small, well-understood, self-contained.
3. **Issue 1 (favicon)** — cosmetic; needs a hosting decision first.

Reminder from `CLAUDE.md`: a push to `main` touching `Code.gs`,
`Index.html`, or `appsscript.json` deploys straight to production with no
review gate. Every fix here is a release.
