# MyTheMatix — Deployment Guide (Step-by-Step, No Tech Background Needed)

> **Partly outdated.** Written when Apps Script also *served* the page.
> The site now lives on GitHub Pages and Apps Script only saves data —
> see `CLAUDE.md` for the current architecture and both pipelines. The
> Apps Script / clasp material below is still accurate.

This guide walks you through turning the 3 code files in this folder
(`Code.gs`, `Index.html`, `appsscript.json`) into a real, working website
that saves registrations to Google Sheets and Google Drive.

You'll do everything in your web browser, using your Google account.
Nothing here requires installing software or using the command line.

**Total time:** about 15–20 minutes.

There are 5 parts:
1. Create the Google Sheet (where registrations get saved)
2. Create the Google Drive folder (where signatures get saved)
3. Create the Apps Script project (the actual "app")
4. Connect the pieces together
5. Publish the app and test it

---

## Part 1 — Create the Google Sheet

This is the spreadsheet that will collect every registration as a new row.

1. Open a new tab and go to **sheets.google.com**.
2. Click the big **"+" (Blank)** button to create a new spreadsheet.
3. At the top-left, click on **"Untitled spreadsheet"** and rename it to:
   ```
   MyTheMatix Registrations
   ```
4. At the bottom, you'll see a tab called **"Sheet1"**. Double-click on it
   and rename it to exactly:
   ```
   Registrations
   ```
   (Capital "R", exactly like that — the app looks for this exact name.)

5. Click on cell **A1** (top-left cell) and paste in this entire header row.
   The easiest way: copy the line below, click cell A1, then paste — Google
   Sheets will automatically spread it across the row for you.

   ```
   registration_id	submitted_at	schema_version	status	student_first_name	student_last_name	student_id	student_phone	student_email	school_name	class_name	is_science	units	parent_role	parent_name	parent_email	signature_file_id	signature_file_name	source
   ```

   After pasting, row 1 should have 19 column headers, from `registration_id`
   in column A to `source` in column S.

6. Now we need to tell Sheets to treat ID numbers and phone numbers as plain
   text (so leading zeros aren't stripped, and long ID numbers don't get
   rounded). Do this:
   - Click on column header **G** (student_id), hold `Shift`, and click on
     column header **H** (student_phone) — this selects both columns.
   - In the top menu, click **Format → Number → Plain text**.

7. **Copy the Spreadsheet ID.** Look at the address bar in your browser. The
   URL looks like this:
   ```
   https://docs.google.com/spreadsheets/d/SOME_LONG_ID_HERE/edit
   ```
   Copy the long string of letters/numbers between `/d/` and `/edit`.
   Save it somewhere temporary (a Notes app, a text file) — you'll need it
   in Part 4. Label it **"Spreadsheet ID"**.

✅ Part 1 done. Leave this tab open, you don't need to touch it again for now.

---

## Part 2 — Create the Google Drive folder

This is the private folder where every parent signature (as a PNG image)
will be saved. It stays private — nobody can browse into it from a link.

1. Open a new tab and go to **drive.google.com**.
2. Click **"+ New" → "New folder"**.
3. Name the folder exactly:
   ```
   MyTheMatix Signatures
   ```
4. Click **Create**.
5. Double-click the new folder to open it.
6. **Copy the Folder ID.** Again, look at the browser's address bar:
   ```
   https://drive.google.com/drive/folders/SOME_LONG_ID_HERE
   ```
   Copy the long string after `/folders/`. Save it next to the Spreadsheet
   ID from Part 1, labeled **"Folder ID"**.

✅ Part 2 done. This folder does not need to be shared with anyone — leave
it private (that's the default, so no action needed there).

---

## Part 3 — Create the Apps Script project

This is where the actual app "lives" — the code that runs the website.

1. Open a new tab and go to **script.new**
   (this is a shortcut that opens a blank Apps Script project directly).
   If it asks you to choose a Google account, pick the same account you
   used in Parts 1 and 2.
2. At the top-left, click on **"Untitled project"** and rename it to:
   ```
   MyTheMatix Registration
   ```

### 3a. Replace the default code file

3. You'll see a file called **Code.gs** already open, with some placeholder
   code (`function myFunction() {...}`). Select **all** of that placeholder
   code and delete it.
4. Open the `Code.gs` file from this project folder on your computer in any
   text editor (or ask me to show it to you), copy its **entire contents**,
   and paste it into the empty `Code.gs` file in the Apps Script editor.
5. Press `Ctrl+S` (Windows) or `Cmd+S` (Mac) to save.

### 3b. Add the Index.html file

6. On the left sidebar, next to "Files", click the **"+"** button, then
   choose **HTML**.
7. It will ask you to name the file. Type exactly:
   ```
   Index
   ```
   (No `.html` at the end — Apps Script adds that automatically.)
   Press Enter.
8. A new file `Index.html` opens with some placeholder HTML. Select **all**
   of it and delete it.
9. Open the `Index.html` file from this project folder on your computer,
   copy its **entire contents**, and paste it into the empty file in the
   Apps Script editor.
10. Save again (`Ctrl+S` / `Cmd+S`).

### 3c. Set up the manifest file (appsscript.json)

11. On the left sidebar, click the **gear icon ⚙️ ("Project Settings")**.
12. Scroll down and check the box that says
    **"Show 'appsscript.json' manifest file in editor"**.
13. Go back to the **editor icon `<>`** on the left sidebar (top icon). You
    should now see a new file called `appsscript.json` in the file list.
14. Click on it, select all its placeholder content, and delete it.
15. Open the `appsscript.json` file from this project folder on your
    computer, copy its **entire contents**, and paste it in.
16. Save (`Ctrl+S` / `Cmd+S`).

✅ Part 3 done. You should now see 3 files in the left sidebar:
`Code.gs`, `Index.html`, `appsscript.json`.

---

## Part 4 — Connect the pieces together

Now we tell the Apps Script project the ID of the Sheet and the Drive
folder you created in Parts 1 and 2.

1. Still inside the Apps Script editor, click the **gear icon ⚙️
   ("Project Settings")** on the left sidebar.
2. Scroll down to the section called **"Script Properties"**.
3. Click **"Add script property"** and add these three, one at a time:

   | Property (left box) | Value (right box) |
   |---|---|
   | `SPREADSHEET_ID` | *paste the Spreadsheet ID you saved in Part 1* |
   | `SHEET_NAME` | `Registrations` |
   | `SIGNATURE_FOLDER_ID` | *paste the Folder ID you saved in Part 2* |

4. Click **"Save script properties"** at the bottom of that section.

✅ Part 4 done.

---

## Part 5 — Publish the app and test it

1. Back in the Apps Script editor, click the blue **"Deploy"** button
   (top-right), then choose **"New deployment"**.
2. Next to "Select type", click the **gear icon ⚙️** and choose
   **"Web app"**.
3. Fill in the form that appears:
   - **Description:** `MyTheMatix MVP` (or anything you like)
   - **Execute as:** `Me (your email address)`
   - **Who has access:** `Anyone`
     (This is intentional and expected — it lets parents open the
     registration page without needing to log into Google themselves.
     It does **not** make your Sheet or Drive folder public — those stay
     private to you.)
4. Click **"Deploy"**.
5. Google will now ask you to **authorize** the app (since it's new and
   only you have used it, Google shows a warning screen — this is normal
   for personal projects):
   - Click **"Authorize access"**.
   - Choose your Google account.
   - You'll see a screen saying **"Google hasn't verified this app"**.
     Click **"Advanced"** (small link near the bottom-left), then click
     **"Go to MyTheMatix Registration (unsafe)"**.
     *(This warning appears because you're the developer testing your own
     app, not because anything is actually unsafe — it just hasn't gone
     through Google's public app-review process, which isn't needed since
     only you and your registrants will use it.)*
   - Click **"Allow"** on the final permissions screen.
6. You'll now see a box with a **"Web app URL"** — it looks like:
   ```
   https://script.google.com/macros/s/AKfycb.../exec
   ```
   **Copy this URL.** This is the real, live link to your registration
   page. Save it somewhere — this is what you'll eventually share with
   parents.
7. Click **"Done"**.

### Now test it for real

8. Open the Web app URL you just copied in a **new incognito/private
   browser window** (this makes sure you're testing it the same way a
   parent with no Google login would see it).
9. Fill out the form completely, draw a signature, and click
   **"שליחת הרשמה"** (Submit registration).
10. You should see the loading state briefly, then a green
    **"תודה, ההרשמה התקבלה בהצלחה"** thank-you message.
11. Go back to your Google Sheet tab (Part 1) and refresh it — you should
    see a new row with all the details you entered.
12. Go back to your Google Drive folder tab (Part 2) and refresh it — you
    should see a new PNG file with the signature.

If all three of those worked (thank-you message, new Sheet row, new PNG
file), the app is fully working. 🎉

---

## Updating the app later

If you (or I, with your help) change any of the code files in the future,
those changes **won't** automatically show up on your live Web app URL.
To push an update to the same URL:

1. In the Apps Script editor, paste in the updated code and save.
2. Click **Deploy → Manage deployments**.
3. Click the **pencil (edit) icon** next to your existing deployment.
4. Next to "Version", choose **"New version"**.
5. Click **Deploy**.

Your existing Web app URL will now serve the updated code — you don't need
to create a new deployment or get a new link each time.

---

## Troubleshooting

- **The page loads forever after clicking submit** — you're probably
  opening the local `Index.html` file directly instead of the deployed
  Web app URL from Part 5, step 6. Only the real `.../exec` URL works.
- **"לשונית הגיליון לא נמצאה" / sheet tab not found error** — double-check
  the Sheet tab is named exactly `Registrations` (Part 1, step 4) and that
  `SHEET_NAME` in Script Properties matches exactly (Part 4).
- **"הגיליון אינו מוגדר" / spreadsheet not configured error** — the
  `SPREADSHEET_ID` script property is missing or has a typo. Recheck Part 4.
- **No file appears in the Drive folder** — recheck `SIGNATURE_FOLDER_ID`
  in Part 4 matches the folder ID from Part 2.
