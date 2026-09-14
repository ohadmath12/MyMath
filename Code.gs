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
  'source',
  'crm_sync_status',
  'crm_synced_at',
  'crm_student_id',
  'crm_sync_error',
  'client_submission_id',
  'parent_phone'
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
  'parent_phone',
  'parent_email',
  'signature_data_url',
  'client_submission_id'
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
  parent_phone: 20,
  parent_email: 120,
  client_submission_id: 64,
  honeypot: 200
};

var SCHEMA_VERSION_ = 4;
var MAX_SIGNATURE_DATA_URL_LENGTH_ = 2000000; // ~2MB base64 safety cap
var MAX_SIGNATURE_WIDTH_ = 4096;
var MAX_SIGNATURE_HEIGHT_ = 4096;
var MAX_SIGNATURE_PIXELS_ = 8000000;
var PUBLIC_ERROR_MESSAGE_ = 'לא הצלחנו לשמור את ההרשמה. נסו שוב בעוד מספר רגעים.';
var ALLOWED_SCHOOLS_ = [
  'חטיבת הביניים הראשונים, גני תקווה',
  'חטיבת בראשית, גני תקווה',
  'תיכון מיתר, גני תקווה',
  'חטיבת בן צבי, קריית אונו',
  'תיכון בן צבי, קריית אונו',
  'חטיבת שמעון פרס, קריית אונו',
  'חטיבת שז"ר, קריית אונו'
];
var ALLOWED_CLASSES_ = ['ז', 'ח', 'ט', 'י', 'י״א', 'י״ב'];
var ALLOWED_UNITS_ = ['לא רלוונטי', 'הקבצה א', 'הקבצה א׳ חדשה', 'הקבצה ב', '4 יח״ל', '5 יח״ל'];

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
    if (!e || !e.postData || typeof e.postData.contents !== 'string') {
      throw new Error('Missing request body');
    }
    var body = JSON.parse(e.postData.contents);
    result = saveRegistration(extractRegistrationPayload_(
      body,
      PropertiesService.getScriptProperties()
    ));
  } catch (err) {
    console.error('Registration request rejected: ' + String(err && err.message || err));
    result = { ok: false, error: PUBLIC_ERROR_MESSAGE_ };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Keeps the existing public form working during the gateway rollout. After the
 * Cloudflare route is live and verified, set ALLOW_LEGACY_DIRECT to "false".
 *
 * @param {Object} body
 * @param {GoogleAppsScript.Properties.Properties} properties
 * @return {Object}
 */
function extractRegistrationPayload_(body, properties) {
  var expectedSecret = properties.getProperty('API_GATEWAY_SECRET');
  var legacyDirectAllowed = properties.getProperty('ALLOW_LEGACY_DIRECT') !== 'false';

  if (expectedSecret && body && body.gateway_secret === expectedSecret && body.payload) {
    return body.payload;
  }
  if (legacyDirectAllowed) {
    return body;
  }
  throw new Error('Unauthorized registration gateway');
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
  validateNormalizedPayload_(normalized);
  var signatureBlob = decodeSignature_(normalized.signature_data_url);

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  var registrationId = null;
  var signatureFile = null;
  var record = null;
  var targetRow = null;
  try {
    var existingRegistrationId = findRegistrationByClientSubmissionId_(normalized.client_submission_id);
    if (existingRegistrationId) {
      return buildSuccessResponse_(existingRegistrationId);
    }

    registrationId = Utilities.getUuid();
    signatureFile = saveSignature_(registrationId, signatureBlob);

    record = {
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
      source: 'google_apps_script_webapp',
      crm_sync_status: 'pending',
      crm_synced_at: '',
      crm_student_id: '',
      crm_sync_error: '',
      client_submission_id: normalized.client_submission_id,
      parent_phone: normalized.parent_phone
    };

    targetRow = appendRegistration_(record);
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

  // The registration is already safely stored at this point. A temporary CRM
  // outage must never make a parent submit the form again and create a duplicate.
  try {
    syncRegistrationToCrm_(record, targetRow);
  } catch (syncErr) {
    markCrmSyncError_(targetRow, syncErr);
    console.error('CRM sync failed for registration ' + registrationId + ': ' + syncErr.message);
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

  normalized.student_phone = normalizeIsraeliMobilePhone_(normalized.student_phone);
  normalized.parent_phone = normalized.parent_phone
    ? normalizeIsraeliMobilePhone_(normalized.parent_phone)
    : '';
  normalized.student_id = normalizeIsraeliId_(normalized.student_id);
  normalized.signature_data_url = String(payload.signature_data_url || '');

  return normalized;
}

/**
 * Validates normalized fields that must never rely on browser controls alone.
 * @param {Object} normalized
 */
function validateNormalizedPayload_(normalized) {
  if (!isValidEmail_(normalized.parent_email)) {
    throw new Error('Invalid parent email');
  }

  if (normalized.student_email && !isValidEmail_(normalized.student_email)) {
    throw new Error('Invalid student email');
  }

  if (ALLOWED_SCHOOLS_.indexOf(normalized.school_name) === -1 ||
      ALLOWED_CLASSES_.indexOf(normalized.class_name) === -1 ||
      ALLOWED_UNITS_.indexOf(normalized.units) === -1) {
    throw new Error('Invalid study details');
  }

  if (!/^[A-Za-z0-9-]{16,64}$/.test(normalized.client_submission_id)) {
    throw new Error('Invalid submission identifier');
  }
}

function isValidEmail_(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ''));
}

/**
 * Normalizes and validates an Israeli identity number, including checksum.
 * @param {*} value
 * @return {string}
 */
function normalizeIsraeliId_(value) {
  var text = String(value || '').trim();
  if (/[^\d\s-]/.test(text)) {
    throw new Error('Invalid identity number');
  }

  var digits = text.replace(/\D/g, '');
  if (digits.length < 5 || digits.length > 9) {
    throw new Error('Invalid identity number');
  }

  digits = ('000000000' + digits).slice(-9);
  var sum = 0;
  for (var i = 0; i < digits.length; i++) {
    var product = Number(digits.charAt(i)) * (i % 2 === 0 ? 1 : 2);
    sum += product > 9 ? product - 9 : product;
  }

  if (sum % 10 !== 0) {
    throw new Error('Invalid identity number');
  }

  return digits;
}

/**
 * Normalizes an Israeli mobile number to 05XXXXXXXX while preserving it as text.
 * Accepts local numbers with separators and +972 international notation.
 * @param {*} value
 * @return {string}
 */
function normalizeIsraeliMobilePhone_(value) {
  var digits = String(value || '').replace(/\D/g, '');

  if (/^9725\d{8}$/.test(digits)) {
    digits = '0' + digits.substring(3);
  } else if (/^5\d{8}$/.test(digits)) {
    digits = '0' + digits;
  }

  if (!/^05\d{8}$/.test(digits)) {
    throw new Error('מספר הטלפון הנייד אינו תקין.');
  }

  return digits;
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

  var pngMagic = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 24) {
    throw new Error('Invalid PNG');
  }
  for (var i = 0; i < pngMagic.length; i++) {
    if ((bytes[i] & 255) !== pngMagic[i]) {
      throw new Error('Invalid PNG');
    }
  }

  var width = readPngUint32_(bytes, 16);
  var height = readPngUint32_(bytes, 20);
  if (!width || !height || width > MAX_SIGNATURE_WIDTH_ || height > MAX_SIGNATURE_HEIGHT_ ||
      width * height > MAX_SIGNATURE_PIXELS_) {
    throw new Error('Invalid PNG dimensions');
  }

  return Utilities.newBlob(bytes, 'image/png', 'signature.png');
}

function readPngUint32_(bytes, offset) {
  return ((bytes[offset] & 255) * 16777216) +
    ((bytes[offset + 1] & 255) * 65536) +
    ((bytes[offset + 2] & 255) * 256) +
    (bytes[offset + 3] & 255);
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
 * @return {number} Added row number.
 */
function appendRegistration_(record) {
  var sheet = getRegistrationSheet_();
  ensureRegistrationHeaders_(sheet);

  var row = SHEET_HEADERS_.map(function (key) {
    return record[key];
  });

  var targetRow = sheet.getLastRow() + 1;
  var studentPhoneColumn = SHEET_HEADERS_.indexOf('student_phone') + 1;
  var parentPhoneColumn = SHEET_HEADERS_.indexOf('parent_phone') + 1;

  sheet.getRange(targetRow, studentPhoneColumn).setNumberFormat('@');
  sheet.getRange(targetRow, parentPhoneColumn).setNumberFormat('@');
  sheet.getRange(targetRow, 1, 1, row.length).setValues([row]);
  return targetRow;
}

function getRegistrationSheet_() {
  var props = PropertiesService.getScriptProperties();
  var spreadsheetId = props.getProperty('SPREADSHEET_ID');
  var sheetName = props.getProperty('SHEET_NAME') || 'Registrations';

  if (!spreadsheetId) {
    throw new Error('Registration sheet is not configured');
  }

  var sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('Registration sheet is unavailable');
  }
  return sheet;
}

/** Adds only missing trailing headers; it never shifts or overwrites existing columns. */
function ensureRegistrationHeaders_(sheet) {
  var currentHeaders = sheet.getRange(1, 1, 1, SHEET_HEADERS_.length).getDisplayValues()[0];
  for (var i = 0; i < SHEET_HEADERS_.length; i++) {
    if (!currentHeaders[i]) {
      sheet.getRange(1, i + 1).setValue(SHEET_HEADERS_[i]);
    } else if (currentHeaders[i] !== SHEET_HEADERS_[i]) {
      throw new Error('Registration sheet schema mismatch at column ' + (i + 1));
    }
  }
}

/**
 * Returns the existing registration for a retried browser submission.
 * @param {string} clientSubmissionId
 * @return {string|null}
 */
function findRegistrationByClientSubmissionId_(clientSubmissionId) {
  var sheet = getRegistrationSheet_();
  ensureRegistrationHeaders_(sheet);
  if (sheet.getLastRow() < 2) return null;

  var idColumn = SHEET_HEADERS_.indexOf('client_submission_id') + 1;
  var values = sheet.getRange(2, idColumn, sheet.getLastRow() - 1, 1).getDisplayValues();
  for (var i = 0; i < values.length; i++) {
    if (values[i][0] === clientSubmissionId) {
      return String(sheet.getRange(i + 2, 1).getDisplayValue() || '') || null;
    }
  }
  return null;
}

/**
 * Sends one operational registration to the CRM intake endpoint.
 * Government ID and signature metadata are intentionally excluded.
 * @param {Object} record
 * @param {number} targetRow
 */
function syncRegistrationToCrm_(record, targetRow) {
  var props = PropertiesService.getScriptProperties();
  var endpoint = props.getProperty('CRM_INTAKE_URL');
  var secret = props.getProperty('CRM_INTAKE_SECRET');

  if (!endpoint || !secret) {
    throw new Error('CRM integration is not configured');
  }

  var payload = {
    registration_id: record.registration_id,
    student_first_name: record.student_first_name,
    student_last_name: record.student_last_name,
    student_phone: record.student_phone,
    student_email: record.student_email,
    school_name: record.school_name,
    class_name: record.class_name,
    is_science: record.is_science,
    units: record.units,
    parent_role: record.parent_role,
    parent_name: record.parent_name,
    parent_phone: record.parent_phone,
    parent_email: record.parent_email
  };

  var response = UrlFetchApp.fetch(endpoint, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-mythematix-import-secret': secret },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var responseCode = response.getResponseCode();
  if (responseCode < 200 || responseCode >= 300) {
    throw new Error('CRM returned HTTP ' + responseCode);
  }

  var body;
  try {
    body = JSON.parse(response.getContentText());
  } catch (parseErr) {
    throw new Error('CRM returned an invalid response');
  }

  if (!body.ok || body.registration_id !== record.registration_id || !body.student_id) {
    throw new Error('CRM did not confirm the registration');
  }

  updateCrmSyncCells_(targetRow, 'synced', new Date(), body.student_id, '');
}

/**
 * Stores a short, non-sensitive sync error for operational review.
 * @param {number} targetRow
 * @param {Error} error
 */
function markCrmSyncError_(targetRow, error) {
  var safeMessage = /^CRM returned HTTP \d{3}$/.test(error.message)
    ? error.message
    : 'CRM sync failed';

  try {
    updateCrmSyncCells_(targetRow, 'error', '', '', safeMessage);
  } catch (sheetErr) {
    console.error('Could not update CRM sync status: ' + sheetErr.message);
  }
}

/**
 * Updates the four CRM control columns in one write.
 * @param {number} targetRow
 * @param {string} status
 * @param {Date|string} syncedAt
 * @param {string} studentId
 * @param {string} errorMessage
 */
function updateCrmSyncCells_(targetRow, status, syncedAt, studentId, errorMessage) {
  var props = PropertiesService.getScriptProperties();
  var spreadsheetId = props.getProperty('SPREADSHEET_ID');
  var sheetName = props.getProperty('SHEET_NAME') || 'Registrations';
  var sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(sheetName);
  var firstControlColumn = SHEET_HEADERS_.indexOf('crm_sync_status') + 1;

  if (!sheet || firstControlColumn < 1) {
    throw new Error('CRM control columns are unavailable');
  }

  sheet.getRange(targetRow, firstControlColumn, 1, 4)
    .setValues([[status, syncedAt, studentId, errorMessage]]);
}

/**
 * Retries registrations that are pending, failed, or predate the sync columns.
 * Safe to run repeatedly because registration_id is idempotent in the CRM.
 */
function retryPendingCrmRegistrations() {
  var props = PropertiesService.getScriptProperties();
  var spreadsheetId = props.getProperty('SPREADSHEET_ID');
  var sheetName = props.getProperty('SHEET_NAME') || 'Registrations';
  var sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(sheetName);

  if (!sheet || sheet.getLastRow() < 2) return;

  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, SHEET_HEADERS_.length).getValues();
  var statusIndex = SHEET_HEADERS_.indexOf('crm_sync_status');

  values.forEach(function (row, index) {
    if (!row[0] || row[statusIndex] === 'synced') return;

    var record = {};
    SHEET_HEADERS_.forEach(function (header, columnIndex) {
      record[header] = row[columnIndex];
    });

    try {
      syncRegistrationToCrm_(record, index + 2);
    } catch (err) {
      markCrmSyncError_(index + 2, err);
    }
  });
}

/**
 * Installs one five-minute retry trigger. Run manually once after deployment.
 */
function setupCrmRetryTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'retryPendingCrmRegistrations') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('retryPendingCrmRegistrations')
    .timeBased()
    .everyMinutes(5)
    .create();
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
