/**
 * MyTheMatix — Registration Web App
 * Server-side logic (Google Apps Script).
 */

var SHEET_HEADERS_ = [
  'registration_id',
  'submitted_at',
  'schema_version',
  'status',
  'student_first_name',
  'student_last_name',
  'student_id',
  'student_phone',
  'student_email',
  'school_name',
  'class_name',
  'is_science',
  'units',
  'parent_role',
  'parent_name',
  'parent_email',
  'signature_file_id',
  'signature_file_name',
  'source'
];

var REQUIRED_FIELDS_ = [
  'student_first_name',
  'student_last_name',
  'student_id',
  'student_phone',
  'school_name',
  'class_name',
  'is_science',
  'units',
  'parent_role',
  'parent_name',
  'parent_email',
  'signature_data_url'
];

var FIELD_MAX_LENGTHS_ = {
  student_first_name: 60,
  student_last_name: 60,
  student_id: 20,
  student_phone: 20,
  student_email: 120,
  school_name: 80,
  class_name: 10,
  is_science: 10,
  units: 30,
  parent_role: 10,
  parent_name: 80,
  parent_email: 120,
  honeypot: 200
};

var SCHEMA_VERSION_ = 1;
var MAX_SIGNATURE_DATA_URL_LENGTH_ = 2000000; // ~2MB base64 safety cap

// Where the page actually lives now. Hard-coded rather than a Script Property
// on purpose: an unset property would leave the old link dead, and this mirrors
// ENDPOINT in public/app.js, which hard-codes the URL in the other direction.
var SITE_URL_ = 'https://ohadmath12.github.io/MyMath/';

/**
 * Bounces the old /exec URL to the GitHub Pages site.
 *
 * This endpoint no longer serves the form — Index.html is gone from the repo
 * and from .claspignore, so there is nothing here to render. It stays only
 * because the /exec link was handed out (WhatsApp, etc.) and must not dead-end.
 *
 * The redirect is top-level (window.top), not a meta refresh: Apps Script runs
 * this inside a cross-origin iframe on script.google.com, and a meta refresh
 * would load the real site *inside that iframe* — which is precisely the broken
 * state this migration removed (see ISSUES.md). Better no redirect than that
 * one, so if the script is blocked the user gets a plain Hebrew link with
 * target="_top" instead.
 *
 * @return {GoogleAppsScript.HTML.HtmlOutput}
 */
function doGet() {
  var html =
    '<!DOCTYPE html>' +
    '<meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<style>' +
    'body{margin:0;padding:2rem 1.25rem;font-family:system-ui,Arial,sans-serif;' +
    'text-align:center;color:#1f2937;line-height:1.7}' +
    'a{color:#2563eb}' +
    '</style>' +
    '<div dir="rtl">' +
    '<p>דף ההרשמה עבר לכתובת חדשה.</p>' +
    '<p><a href="' + SITE_URL_ + '" target="_top">מעבר לדף ההרשמה</a></p>' +
    '</div>' +
    '<script>window.top.location.href = ' + JSON.stringify(SITE_URL_) + ';<\/script>';

  return HtmlService.createHtmlOutput(html)
    .setTitle('MyTheMatix — הרשמה');
}

/**
 * HTTP entry point for the static site (GitHub Pages), which posts the
 * registration as a JSON body. This is a thin transport wrapper only — all
 * validation and persistence stays in saveRegistration.
 *
 * The client must send Content-Type: text/plain so the browser treats the
 * request as CORS-simple. Apps Script has no doOptions, so an actual preflight
 * would be answered with 405 and the submission would never arrive.
 *
 * @param {GoogleAppsScript.Events.DoPost} e
 * @return {GoogleAppsScript.Content.TextOutput}
 */
function doPost(e) {
  var result;

  try {
    result = saveRegistration(JSON.parse(e.postData.contents));
  } catch (err) {
    // saveRegistration only ever throws the generic, user-facing Hebrew
    // strings defined in this file, so echoing the message leaks nothing.
    result = { ok: false, error: err.message };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Validates, normalizes, and persists a new registration.
 * @param {Object} payload
 * @return {{ok: boolean, registrationId: string}}
 */
function saveRegistration(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('בקשה לא תקינה.');
  }

  // Honeypot: silently pretend success without persisting anything.
  if (payload.honeypot) {
    return buildSuccessResponse_(Utilities.getUuid());
  }

  validateRequiredFields_(payload);

  var normalized = normalizePayload_(payload);
  var registrationId = Utilities.getUuid();
  var signatureBlob = decodeSignature_(normalized.signature_data_url);

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  var signatureFile = null;
  try {
    signatureFile = saveSignature_(registrationId, signatureBlob);

    var record = {
      registration_id: registrationId,
      submitted_at: new Date(),
      schema_version: SCHEMA_VERSION_,
      status: 'new',
      student_first_name: normalized.student_first_name,
      student_last_name: normalized.student_last_name,
      student_id: normalized.student_id,
      student_phone: normalized.student_phone,
      student_email: normalized.student_email,
      school_name: normalized.school_name,
      class_name: normalized.class_name,
      is_science: normalized.is_science,
      units: normalized.units,
      parent_role: normalized.parent_role,
      parent_name: normalized.parent_name,
      parent_email: normalized.parent_email,
      signature_file_id: signatureFile.getId(),
      signature_file_name: signatureFile.getName(),
      source: 'google_apps_script_webapp'
    };

    appendRegistration_(record);
  } catch (err) {
    if (signatureFile) {
      try {
        signatureFile.setTrashed(true);
      } catch (cleanupErr) {
        // Best-effort cleanup only; the primary error is what matters.
      }
    }
    throw new Error('לא הצלחנו לשמור את ההרשמה. נסו שוב בעוד מספר רגעים.');
  } finally {
    lock.releaseLock();
  }

  return buildSuccessResponse_(registrationId);
}

/**
 * Confirms all required fields are present and non-empty.
 * @param {Object} payload
 */
function validateRequiredFields_(payload) {
  for (var i = 0; i < REQUIRED_FIELDS_.length; i++) {
    var key = REQUIRED_FIELDS_[i];
    var value = payload[key];
    if (value === undefined || value === null || String(value).trim() === '') {
      throw new Error('חסרים פרטים בטופס.');
    }
  }

  if (['yes', 'no'].indexOf(String(payload.is_science)) === -1) {
    throw new Error('ערך לא תקין עבור כיתה מדעית.');
  }

  if (['father', 'mother'].indexOf(String(payload.parent_role)) === -1) {
    throw new Error('ערך לא תקין עבור מבצע ההרשמה.');
  }
}

/**
 * Trims, length-limits, and sanitizes all incoming string fields.
 * @param {Object} payload
 * @return {Object}
 */
function normalizePayload_(payload) {
  var normalized = {};

  Object.keys(FIELD_MAX_LENGTHS_).forEach(function (key) {
    if (key === 'honeypot') return;
    normalized[key] = sanitizeText_(payload[key], FIELD_MAX_LENGTHS_[key]);
  });

  normalized.signature_data_url = String(payload.signature_data_url || '');

  return normalized;
}

/**
 * Strips control characters, trims, caps length, and neutralizes leading
 * formula-trigger characters so sheet values are never interpreted as formulas.
 * @param {*} value
 * @param {number} maxLength
 * @return {string}
 */
function sanitizeText_(value, maxLength) {
  var text = String(value === undefined || value === null ? '' : value);
  text = text.replace(/[\x00-\x1F\x7F]/g, '').trim();

  if (maxLength && text.length > maxLength) {
    text = text.substring(0, maxLength);
  }

  if (/^[=+\-@]/.test(text)) {
    text = "'" + text;
  }

  return text;
}

/**
 * Decodes a data URL into a PNG Blob after validating its header and size.
 * @param {string} dataUrl
 * @return {GoogleAppsScript.Base.Blob}
 */
function decodeSignature_(dataUrl) {
  var prefix = 'data:image/png;base64,';

  if (!dataUrl || typeof dataUrl !== 'string' || dataUrl.indexOf(prefix) !== 0) {
    throw new Error('פורמט החתימה אינו תקין.');
  }

  if (dataUrl.length > MAX_SIGNATURE_DATA_URL_LENGTH_) {
    throw new Error('קובץ החתימה גדול מדי.');
  }

  var base64 = dataUrl.substring(prefix.length);

  if (!base64) {
    throw new Error('החתימה ריקה.');
  }

  var bytes = Utilities.base64Decode(base64);
  return Utilities.newBlob(bytes, 'image/png', 'signature.png');
}

/**
 * Saves the signature blob into the private signatures folder.
 * @param {string} registrationId
 * @param {GoogleAppsScript.Base.Blob} blob
 * @return {GoogleAppsScript.Drive.File}
 */
function saveSignature_(registrationId, blob) {
  var folderId = PropertiesService.getScriptProperties().getProperty('SIGNATURE_FOLDER_ID');
  if (!folderId) {
    throw new Error('תיקיית החתימות אינה מוגדרת.');
  }

  var folder = DriveApp.getFolderById(folderId);
  blob.setName(registrationId + '.png');
  return folder.createFile(blob);
}

/**
 * Appends one registration row to the Registrations sheet.
 * @param {Object} record
 */
function appendRegistration_(record) {
  var props = PropertiesService.getScriptProperties();
  var spreadsheetId = props.getProperty('SPREADSHEET_ID');
  var sheetName = props.getProperty('SHEET_NAME') || 'Registrations';

  if (!spreadsheetId) {
    throw new Error('הגיליון אינו מוגדר.');
  }

  var spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  var sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error('לשונית הגיליון לא נמצאה.');
  }

  var row = SHEET_HEADERS_.map(function (key) {
    return record[key];
  });

  sheet.appendRow(row);
}

/**
 * Builds the response returned to the client. Contains no personal data.
 * @param {string} registrationId
 * @return {{ok: boolean, registrationId: string}}
 */
function buildSuccessResponse_(registrationId) {
  return {
    ok: true,
    registrationId: registrationId
  };
}
