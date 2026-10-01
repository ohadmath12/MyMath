/** Preserve the existing workbook and A:P contract consumed by marathons. */
var LEAD_WORKBOOK_ID_ = '15kR_-Sr6K5NRQM4zoD4-kU9Xq8qV1_5PWJIv5bLyOo4';
var LEAD_SHEET_ID_ = 1800000002;
var LEAD_HEADERS_ = ['מזהה ליד','תאריך כניסה','שם תלמיד/ה','שם הורה','טלפון','עיר','בית ספר','כיתה','רמה','מקור ליד','סטטוס','עדיפות','אחראי','מסלול / קבוצה מתאימה','תוצאה / סיבת סגירה','תאריך הצטרפות'];

function prepareLeadSheetForSync() {
  if(PropertiesService.getScriptProperties().getProperty('LEAD_MIGRATION_ENABLED')!=='true')throw new Error('Migration not enabled');
  var sheet=leadSheet_();
  if(sheet.getMaxColumns()<23)sheet.insertColumnsAfter(sheet.getMaxColumns(),23-sheet.getMaxColumns());
  var headers=['תאריך מעקב','צורך מרכזי','זמינות','דוא״ל הורה','מזהה תלמיד CRM','גרסת CRM','עדכון מהמערכת'];
  var current=sheet.getRange(4,17,1,7).getValues()[0];
  if(current.some(function(v,i){return v&&v!==headers[i];}))throw new Error('New columns already used');
  sheet.getRange(4,16).copyTo(sheet.getRange(4,17,1,7),SpreadsheetApp.CopyPasteType.PASTE_FORMAT,false);
  sheet.getRange(4,17,1,7).setValues([headers]);sheet.setColumnWidths(17,7,160);
  sheet.getRange(5,17,1000,7).setWrap(true).setVerticalAlignment('middle');
  sheet.getRange(5,8,1000,1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['ד','ה','ו','ז','ח','ט','י','יא','יב','י״א','י״ב','אחר'],true).setAllowInvalid(false).build());
  sheet.getRange(5,11,1000,1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['חדש','ממתין למענה','שיחה נקבעה','שיעור ניסיון נקבע','מרתון הכנה למבחנים','מעקב עתידי','הצטרף','לא רלוונטי','שיעור ניסיון','מצטרף לתוכנית','בטיפוח / מעקב עתידי','לא רלוונטי / נסגר'],true).setAllowInvalid(false).build());
  // Source is free text on the short parent form; preserve suggestions, permit detail.
  var sourceValidation=sheet.getRange(6,10).getDataValidation();
  if(sourceValidation)sheet.getRange(5,10,1000,1).setDataValidation(sourceValidation.copy().setAllowInvalid(true).build());
  sheet.getRange('A2').setValue('הפרטים מתעדכנים אוטומטית מה־CRM. עדכנו פרטי ליד, סטטוס ותאריך מעקב במערכת; נתוני מרתונים ממשיכים להתנהל בקובץ המרתונים לפי מזהה ליד.');
  var marathon=SpreadsheetApp.openById('1QEgeUA2bXlBFs2sl5QoZUxgBzvRlvxcbVJb0ptGgdG4').getSheetByName('סנכרון לידים');
  var formula=marathon.getRange('J4').getFormula();
  var old='=IMPORTRANGE("'+LEAD_WORKBOOK_ID_+'","לידים!A4:T1000")';
  var target='=IMPORTRANGE("'+LEAD_WORKBOOK_ID_+'","לידים!A4:P1000")';
  if(formula!==old&&formula!==target)throw new Error('Marathon import formula changed');
  marathon.getRange('J4').setFormula(target);
}

function leadSheet_() {
  var sheet = SpreadsheetApp.openById(LEAD_WORKBOOK_ID_).getSheets().filter(function(s){return s.getSheetId()===LEAD_SHEET_ID_;})[0];
  if (!sheet || sheet.getName()!=='לידים') throw new Error('Lead sheet changed');
  var headers=sheet.getRange(4,1,1,16).getDisplayValues()[0];
  if(JSON.stringify(headers)!==JSON.stringify(LEAD_HEADERS_)) throw new Error('Lead headers changed');
  return sheet;
}

/** Run once after reviewing dry-run output; imports existing IDs without creating students. */
function importExistingLeadsToCrm() {
  if(PropertiesService.getScriptProperties().getProperty('LEAD_MIGRATION_ENABLED')!=='true') throw new Error('Migration not enabled');
  var lock=LockService.getScriptLock();lock.waitLock(30000);
  try {
    var sheet=leadSheet_();
    var rows=sheet.getRange(6,1,Math.max(1,sheet.getLastRow()-5),16).getValues().filter(function(r){return r[0];});
    var seen={};
    rows.forEach(function(row){if(seen[row[0]])throw new Error('Duplicate legacy lead ID');seen[row[0]]=true;});
    rows.forEach(function(row){forwardLeadRequest_({operation:'lead_legacy_import',lead_id:String(row[0]),row:row.map(function(v){return leadSheetValue_(v);})});});
  } finally {lock.releaseLock();}
}

function syncLeadsToExistingSheet() {
  if(PropertiesService.getScriptProperties().getProperty('LEAD_SYNC_ENABLED')!=='true')return;
  var lock=LockService.getScriptLock();if(!lock.tryLock(1000))return;
  try {
    var sheet=leadSheet_();
    var data=forwardLeadRequest_({operation:'lead_sheet_export'});
    if(!Array.isArray(data.leads))throw new Error('Invalid lead export');
    var count=Math.max(sheet.getLastRow()-4,1), ids=sheet.getRange(5,1,count,1).getDisplayValues(), rowById={};
    ids.forEach(function(r,i){if(!r[0]||r[0]==='דוגמה – אפשר למחוק')return;if(rowById[r[0]])throw new Error('Duplicate sheet ID');rowById[r[0]]=i+5;});
    // Verify all existing rows were imported before making CRM authoritative.
    if(!Array.isArray(data.known_ids)||Object.keys(rowById).some(function(id){return data.known_ids.indexOf(id)<0;}))throw new Error('Unimported sheet leads');
    data.leads.forEach(function(item){
      if(!Array.isArray(item.values)||item.values.length!==23||typeof item.lead_id!=='string'||item.values[0]!==item.lead_id)throw new Error('Invalid row contract');
      var row=rowById[item.lead_id]||Math.max(6,sheet.getLastRow()+1);
      if(row>1000)throw new Error('Marathon import range capacity reached');
      if(sheet.getMaxColumns()<23)sheet.insertColumnsAfter(sheet.getMaxColumns(),23-sheet.getMaxColumns());
      // Force text for phone and untrusted input; apostrophe prevents formula injection.
      var values=item.values.map(function(v){if(v===null||v===undefined)return '';if(typeof v==='string'&&/^[=+@\-]/.test(v))return "'"+v;return v;});
      sheet.getRange(row,5).setNumberFormat('@');
      [2,16,17].forEach(function(col){sheet.getRange(row,col).setNumberFormat('dd/MM/yyyy');});
      sheet.getRange(row,1,1,23).setValues([values]);
      SpreadsheetApp.flush();
      var actual=sheet.getRange(row,1,1,23).getValues()[0];
      if(actual.some(function(v,i){return String(leadSheetValue_(v))!==String(item.values[i]===null?'':item.values[i]);}))throw new Error('Lead readback mismatch');
      forwardLeadRequest_({operation:'lead_sheet_ack',id:item.id,version:item.version});
      rowById[item.lead_id]=row;
    });
  } finally {lock.releaseLock();}
}

function installLeadSyncTrigger() {
  if(PropertiesService.getScriptProperties().getProperty('LEAD_SYNC_ENABLED')!=='true')throw new Error('Lead sync not enabled');
  if(!ScriptApp.getProjectTriggers().some(function(t){return t.getHandlerFunction()==='syncLeadsToExistingSheet';}))ScriptApp.newTrigger('syncLeadsToExistingSheet').timeBased().everyMinutes(5).create();
}

function leadSheetValue_(v) {
 if(v instanceof Date) {
  var date=Utilities.formatDate(v,'Asia/Jerusalem','yyyy-MM-dd');
  return Math.round(Date.parse(date+'T00:00:00Z')/86400000)+25569;
 }
 return v;
}
