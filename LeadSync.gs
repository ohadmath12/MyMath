/** CRM-only sync. The original tab (1800000002) is a frozen archive. */
var LEAD_WORKBOOK_ID_ = '15kR_-Sr6K5NRQM4zoD4-kU9Xq8qV1_5PWJIv5bLyOo4';
var LEAD_ARCHIVE_SHEET_ID_ = 1800000002;
var LEAD_SHEET_NAME_ = 'לידים CRM';
var LEAD_HEADERS_ = ['מזהה ליד','תאריך כניסה','שם תלמיד/ה','שם הורה','טלפון','עיר','בית ספר','כיתה','רמה','מקור ליד','סטטוס','עדיפות','אחראי','מסלול / קבוצה מתאימה','תוצאה / סיבת סגירה','תאריך הצטרפות','תאריך מעקב','צורך מרכזי','זמינות','דוא״ל הורה','מזהה תלמיד CRM','גרסת CRM','עדכון מהמערכת'];

/** Idempotent setup of a NEW tab. Never changes historical leads or marathons. */
function prepareLeadSheetForSync() {
  var props=PropertiesService.getScriptProperties();
  if(props.getProperty('LEAD_SETUP_ENABLED')!=='true')throw new Error('Lead setup not enabled');
  var lock=LockService.getScriptLock();lock.waitLock(30000);
  try {
    var book=SpreadsheetApp.openById(LEAD_WORKBOOK_ID_);
    var sheet=book.getSheetByName(LEAD_SHEET_NAME_);
    if(sheet&&sheet.getSheetId()===LEAD_ARCHIVE_SHEET_ID_)throw new Error('Cannot target historical archive');
    var configured=props.getProperty('LEAD_CRM_SHEET_ID');
    if(configured&&(!sheet||String(sheet.getSheetId())!==configured))throw new Error('CRM sheet identity changed');
    if(!sheet)sheet=book.insertSheet(LEAD_SHEET_NAME_);
    if(sheet.getMaxColumns()<23)sheet.insertColumnsAfter(sheet.getMaxColumns(),23-sheet.getMaxColumns());
    var existing=sheet.getRange(4,1,1,23).getDisplayValues()[0];
    if(existing.some(function(v,i){return v&&v!==LEAD_HEADERS_[i];})||(!existing[0]&&sheet.getLastRow()>0))throw new Error('CRM tab already contains unrelated data');
    sheet.getRange(4,1,1,23).setValues([LEAD_HEADERS_]).setFontWeight('bold').setBackground('#153e5c').setFontColor('#ffffff').setWrap(true);
    sheet.getRange('A1').setValue('לידים חדשים — MyTheMatix CRM');
    sheet.getRange('A2').setValue('עדכון פרטים וסטטוסים ב־CRM בלבד. הלשונית לידים היא ארכיון היסטורי ואינה מיובאת למערכת.');
    sheet.setRightToLeft(true);sheet.setFrozenRows(4);sheet.setColumnWidths(1,23,150);
    sheet.getRange(5,5,sheet.getMaxRows()-4,1).setNumberFormat('@');
    [2,16,17].forEach(function(col){sheet.getRange(5,col,sheet.getMaxRows()-4,1).setNumberFormat('dd/MM/yyyy');});
    props.setProperty('LEAD_CRM_SHEET_ID',String(sheet.getSheetId()));
  } finally {lock.releaseLock();}
}

function leadSheet_() {
  var id=PropertiesService.getScriptProperties().getProperty('LEAD_CRM_SHEET_ID');
  if(!id||Number(id)===LEAD_ARCHIVE_SHEET_ID_)throw new Error('CRM sheet is not configured; archive is forbidden');
  var sheet=SpreadsheetApp.openById(LEAD_WORKBOOK_ID_).getSheets().filter(function(s){return String(s.getSheetId())===id;})[0];
  if(!sheet||sheet.getName()!==LEAD_SHEET_NAME_)throw new Error('CRM sheet changed');
  if(JSON.stringify(sheet.getRange(4,1,1,23).getDisplayValues()[0])!==JSON.stringify(LEAD_HEADERS_))throw new Error('Lead headers changed');
  return sheet;
}

/** Kept as a fail-closed guard for any old manual runbook or saved trigger. */
function importExistingLeadsToCrm() {throw new Error('Historical archive import is disabled');}

function syncLeadsToExistingSheet() {
  if(PropertiesService.getScriptProperties().getProperty('LEAD_SYNC_ENABLED')!=='true')return;
  var lock=LockService.getScriptLock();if(!lock.tryLock(1000))return;
  try {
    var sheet=leadSheet_();
    var data=forwardLeadRequest_({operation:'lead_sheet_export'});
    if(!Array.isArray(data.leads))throw new Error('Invalid lead export');
    var count=Math.max(sheet.getLastRow()-4,1), ids=sheet.getRange(5,1,count,1).getDisplayValues(), rowById={};
    ids.forEach(function(r,i){if(!r[0])return;if(rowById[r[0]])throw new Error('Duplicate sheet ID');rowById[r[0]]=i+5;});
    // A new CRM-only tab must never contain historical or manually added IDs.
    if(!Array.isArray(data.known_ids)||Object.keys(rowById).some(function(id){return data.known_ids.indexOf(id)<0;}))throw new Error('Unknown sheet leads');
    data.leads.forEach(function(item){
      if(!Array.isArray(item.values)||item.values.length!==23||typeof item.lead_id!=='string'||item.values[0]!==item.lead_id)throw new Error('Invalid row contract');
      var row=rowById[item.lead_id]||Math.max(5,sheet.getLastRow()+1);
      if(row>1000)throw new Error('Marathon import range capacity reached');
      if(sheet.getMaxColumns()<23)sheet.insertColumnsAfter(sheet.getMaxColumns(),23-sheet.getMaxColumns());
      // Force text for phone and untrusted input; apostrophe prevents formula injection.
      var values=item.values.map(function(v){if(v===null||v===undefined)return '';if(typeof v==='string'&&/^[=+@\-]/.test(v))return "'"+v;return v;});
      sheet.getRange(row,1,1,23).setNumberFormat('@');
      sheet.getRange(row,22).setNumberFormat('0');
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
