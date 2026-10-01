// Pure planner: consumes fresh native Sheets CellData; performs no network writes.
// Apply requests in ONE native Sheets batchUpdate after reviewing the snapshot.
const SOURCE_ID='15kR_-Sr6K5NRQM4zoD4-kU9Xq8qV1_5PWJIv5bLyOo4';
const ARCHIVE_NAME='ארכיון לידים 01.10.2026';
const ARCHIVE_ID=1600000003;
const SYNC_ID=1600000002;
const PARTICIPANTS_ID=1436915665;
const OLD_IMPORT=`=IMPORTRANGE("${SOURCE_ID}","לידים!A4:T1000")`;
const NEW_IMPORT=`=IMPORTRANGE("${SOURCE_ID}","'לידים CRM'!A4:P1000")`;
function cellValue(c){const v=c?.effectiveValue??c?.userEnteredValue??{};if(v.errorValue)throw Error('Source contains a calculation error');return v.stringValue??v.numberValue??v.boolValue??'';}
function literal(v){return {userEnteredValue:typeof v==='number'?{numberValue:v}:typeof v==='boolean'?{boolValue:v}:{stringValue:String(v)}};}
function formula(r,c){const key=`T${r}`,base="'סנכרון לידים'!",lookup=letter=>`XLOOKUP(${key},${base}B$5:B$1000,${base}${letter}$5:${letter}$1000)`;
 const letters={3:'C',4:'D',5:'E',22:'H'};
 const inner=c===6?`${lookup('F')}&IF(${lookup('G')}<>""," / "&${lookup('G')},"")`:lookup(letters[c]);
 return `=IF(${key}="","",IFERROR(${inner},"${c===22?'ליד לא נמצא':''}"))`;
}
function plan({sheets,importFormula,lookupRows,participantRows,sourceReady}){
 if(!sourceReady)throw Error('New CRM source headers must be verified first');
 if(importFormula!==OLD_IMPORT)throw Error(importFormula===NEW_IMPORT?'Cutover already applied; verify instead of replaying':'Unexpected import formula');
 if(sheets.some(s=>s.sheetId===ARCHIVE_ID||s.title===ARCHIVE_NAME))throw Error('Archive already exists; inspect before continuing');
 if(!sheets.some(s=>s.sheetId===SYNC_ID&&s.title==='סנכרון לידים')||!sheets.some(s=>s.sheetId===PARTICIPANTS_ID&&s.title==='משתתפי מרתונים'))throw Error('Marathon sheets changed');
 const archive=lookupRows.map(row=>Array.from({length:8},(_,i)=>cellValue(row[i])));
 const ids=new Set();for(const row of archive){if(!row[1])continue;if(ids.has(row[1]))throw Error('Duplicate archive lead ID');ids.add(row[1]);}
 if(!ids.size)throw Error('No archive leads read');
 const requests=[{addSheet:{properties:{sheetId:ARCHIVE_ID,title:ARCHIVE_NAME,rightToLeft:true,gridProperties:{rowCount:1000,columnCount:8,frozenRowCount:4,hideGridlines:true}}}},
  {updateCells:{start:{sheetId:ARCHIVE_ID,rowIndex:0,columnIndex:0},rows:[{values:[literal('ארכיון לידים — מקור לפרטי הרשמות היסטוריות בלבד')]},{values:[literal('צילום מצב לפני מעבר לפניות חדשות מה־CRM. אין להשתמש לבחירת תלמיד בהרשמה חדשה.')]}],fields:'userEnteredValue'}},
  {updateCells:{start:{sheetId:ARCHIVE_ID,rowIndex:3,columnIndex:0},rows:[{values:['בחירת תלמיד','מזהה ליד','שם תלמיד/ה','טלפון','בית ספר','כיתה','רמה','סטטוס'].map(literal)},...archive.map(row=>({values:row.map(literal)}))],fields:'userEnteredValue'}},
  {repeatCell:{range:{sheetId:ARCHIVE_ID,startRowIndex:3,endRowIndex:4,startColumnIndex:0,endColumnIndex:8},cell:{userEnteredFormat:{backgroundColor:{red:0.08,green:0.24,blue:0.36},textFormat:{bold:true,foregroundColor:{red:1,green:1,blue:1}}}},fields:'userEnteredFormat'}},
  {updateDimensionProperties:{range:{sheetId:ARCHIVE_ID,dimension:'COLUMNS',startIndex:0,endIndex:8},properties:{pixelSize:165},fields:'pixelSize'}}];
 let historical=0;
 participantRows.forEach((row,i)=>{
  const id=cellValue(row[19]);if(!id)return;
  if(!ids.has(id))throw Error('Historical participant missing from archive');
  const rowNumber=i+5;
  for(const c of [3,4,5,6,22]){
   const before=row[c]?.userEnteredValue?.formulaValue;
   if(before!==formula(rowNumber,c))throw Error(`Unexpected participant formula at row ${rowNumber}, column ${c+1}`);
   requests.push({updateCells:{start:{sheetId:PARTICIPANTS_ID,rowIndex:rowNumber-1,columnIndex:c},rows:[{values:[{userEnteredValue:{formulaValue:before.replaceAll("'סנכרון לידים'!",`'${ARCHIVE_NAME}'!`)}}]}],fields:'userEnteredValue'}});
  }
  requests.push({setDataValidation:{range:{sheetId:PARTICIPANTS_ID,startRowIndex:rowNumber-1,endRowIndex:rowNumber,startColumnIndex:2,endColumnIndex:3},rule:{condition:{type:'ONE_OF_RANGE',values:[{userEnteredValue:`='${ARCHIVE_NAME}'!$A$5:$A$1000`}]},strict:true,showCustomUi:true,inputMessage:'הרשמה היסטורית; אין להחליף את שיוך התלמיד'}}});
  historical++;
 });
 if(!historical)throw Error('No historical registrations read');
 requests.push({updateCells:{start:{sheetId:SYNC_ID,rowIndex:3,columnIndex:9},rows:[{values:[{userEnteredValue:{formulaValue:NEW_IMPORT}}]}],fields:'userEnteredValue'}});
 return {requests,summary:{historicalRegistrations:historical,archiveLeads:ids.size,sourceTab:'לידים CRM',archiveTab:ARCHIVE_NAME},preserved:'No writes to source archive, participant IDs, payment cells, attendance or event data'};
}
module.exports={plan,formula,OLD_IMPORT,NEW_IMPORT,ARCHIVE_NAME};
