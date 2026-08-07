# Automating Deployment — Options & Recommendation

Right now, publishing an update means manually copy-pasting `Code.gs`,
`Index.html`, and `appsscript.json` into the Apps Script web editor and
clicking through **Deploy → Manage deployments → New version** (see
"Updating the app later" in `DEPLOYMENT_GUIDE.md`). This doc lays out how
to remove that manual step.

There are two levels of automation, and you can adopt just the first
without the second.

---

## Level 1 — `clasp` (Google's official CLI for Apps Script)

`clasp` (**C**ommand **L**ine **A**pps **S**cript **P**rojects) lets you
push local files to your Apps Script project and cut a new deployment
from the terminal, instead of the copy-paste dance.

### One-time setup

1. Install it (needs Node.js, which is already on this machine):
   ```
   npm install -g @google/clasp
   ```
2. Enable the Apps Script API for your Google account (one click):
   `script.google.com/home/usersettings` → toggle it on.
3. Log in (opens a browser OAuth consent screen, same as any Google
   sign-in):
   ```
   clasp login
   ```
4. Link this local folder to the *existing* Apps Script project (the one
   already created per Part 3 of `DEPLOYMENT_GUIDE.md`) instead of
   creating a new one:
   ```
   clasp clone <SCRIPT_ID>
   ```
   The Script ID is in the Apps Script editor under
   **Project Settings → IDs → Script ID**. This generates a
   `.clasp.json` file in this folder (records the script ID — safe to
   commit, contains no secrets).
5. Add a `.claspignore` so only the 3 real source files get pushed
   (skip `לוגו.png`, the `.md` guides, `.git`, etc.):
   ```
   **/**
   !Code.gs
   !Index.html
   !appsscript.json
   ```
   (`clasp` bundles the logo differently — it's referenced as a Drive
   file / base64 in the HTML, not pushed as a binary, so this is safe.)

### Day-to-day usage

```
clasp push                          # uploads Code.gs / Index.html / appsscript.json
clasp deploy --deploymentId <ID>    # publishes that code to the live URL
```

The `--deploymentId` is the ID of your existing "Web app" deployment
(find it via `clasp deployments`) — reusing it keeps the same public
`.../exec` URL instead of minting a new one.

This can be wrapped in a single `npm run deploy` script or a shell
alias so it's one command instead of two.

**Effort:** ~15 min one-time setup. **Removes:** all manual copy-paste
and clicking through the Deploy dialog. **Still manual:** you type the
command yourself when you want to publish.

---

## Level 2 — CI/CD (auto-deploy on `git push`)

**Implemented.** `.github/workflows/deploy.yml` runs on every push to
`main` that touches `Code.gs`, `Index.html`, or `appsscript.json`: it
installs `clasp`, restores your login from the `CLASP_CREDENTIALS`
repo secret, then runs `clasp push --force` followed by
`clasp deploy --deploymentId <the live web app's ID>` — so "push to
main" *is* "deploy." The deployment ID is hardcoded in the workflow
(it's an identifier, not a credential) and reuses the existing live
`/exec` URL rather than minting a new deployment.

It can also be triggered by hand from the repo's **Actions** tab
(`workflow_dispatch`) — useful for re-publishing without inventing a
commit.

Notable details, in case you're editing it later:

- **`concurrency: apps-script-deploy`** with `cancel-in-progress: false`.
  Push-then-deploy is two non-atomic steps, so overlapping runs could
  publish a half-updated mix — and cancelling a run *between* the two
  would leave the project pushed but unpublished.
- **clasp is pinned** (`CLASP_VERSION`) so a breaking release can't
  silently change how the live site gets published.
- **`environment: production`** exists so you can attach a required
  reviewer under repo **Settings → Environments** — that's the only
  available review gate between a push to `main` and the live site.
- The secret is passed via `env:` rather than interpolated straight
  into the shell (`${{ }}` inside `run:` is a
  [documented injection footgun](https://securitylab.github.com/resources/github-actions-untrusted-input/)),
  and written with `printf '%s'` because `echo` mangles backslash
  escapes in JSON.
- Each deploy is tagged with its short commit SHA, so the version list
  in the Apps Script editor traces back to git.

### One-time setup this still needs from you

Add your `clasp login` credentials as a GitHub Actions secret named
`CLASP_CREDENTIALS`, since the workflow runs on GitHub's servers, not
this machine:

1. On GitHub: repo → **Settings → Secrets and variables → Actions →
   New repository secret**.
2. Name: `CLASP_CREDENTIALS`.
3. Value: the full contents of `~/.clasprc.json` on this machine
   (your local `clasp login` session).

### Trade-off worth remembering

`~/.clasprc.json` contains an OAuth refresh token scoped to your Google
account with access to Apps Script (and whatever else that token can
reach). Storing it as a repo secret is standard practice (GitHub
encrypts secrets at rest and never exposes them in logs), but it's a
credential with real reach — rotate it (re-run `clasp login`, update
the secret) if it's ever suspected to have leaked, and remember that
from now on, **every push to `main` that touches the 3 source files
auto-publishes to the live site with no review step in between**
unless you add a required reviewer to the `production` environment.

The common CI failure here — a refresh token dying after 7 days —
comes from custom OAuth clients left in *Testing* publishing status.
This project uses clasp's own built-in (published) OAuth client, so
that clock doesn't apply. The token can still be invalidated the
normal ways: revoking clasp's access in your Google account, a
security event, or ~6 months of total disuse. The symptom would be a
red workflow run with `invalid_grant`; the fix is re-running
`clasp login` locally and updating the secret.

Service accounts would sidestep the user-token problem entirely, but
clasp v3 still lists that path as **experimental / not working**, and
service accounts can't own Apps Script projects — so a user refresh
token is currently the only workable option.

**Adds:** a credential to manage, and a failure mode (bad push) that
publishes automatically unless you also add a review step (e.g. a
required PR review before merging to `main`).

---

## Status

Both levels are implemented: `clasp` is set up locally (Level 1), and
`.github/workflows/deploy.yml` auto-deploys on push to `main` (Level 2).
The only remaining setup is adding the `CLASP_CREDENTIALS` repo secret
described above — until that's added, the workflow will run and fail
at the "Restore clasp credentials" / push step.
