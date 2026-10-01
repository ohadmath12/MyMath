const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
let writes=0,acks=[],failedAck=true;
const grid=Array.from({length:6},()=>Array(23).fill(''));
const ctx=vm.createContext({console,Date,PropertiesService:{getScriptProperties:()=>({getProperty:k=>k==='LEAD_CRM_SHEET_ID'?'1800000004':'true'})},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},Utilities:{formatDate:d=>d.toISOString().slice(0,10)}});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../LeadSync.gs'),'utf8'),ctx);
grid[3]=Array.from(ctx.LEAD_HEADERS_);grid[5][0]='L-existing';
const existing=['L-existing',46267,'תלמיד בדיקה','הורה בדיקה','0500000000','','','','','','מעקב עתידי','','','','','',46297,'=IMPORTDATA("https://example.invalid")','','','','1','01/10/2026 17:00'];
const fresh=[...existing];fresh[0]='L-new';
const sheet={getSheetId:()=>1800000004,getName:()=> 'לידים CRM',getLastRow:()=>grid.length,getMaxColumns:()=>23,getRange(row,col,n=1,m=1){return {
 getDisplayValues:()=>Array.from({length:n},(_,i)=>Array.from({length:m},(_,j)=>String(grid[row-1+i]?.[col-1+j]??''))),
 getValues:()=>Array.from({length:n},(_,i)=>Array.from({length:m},(_,j)=>grid[row-1+i]?.[col-1+j]??'')),
 setNumberFormat(){return this},
 setValues(rows){writes++;rows.forEach((r,i)=>{grid[row-1+i]??=Array(23).fill('');r.forEach((v,j)=>{grid[row-1+i][col-1+j]=typeof v==='string'&&v.startsWith("'")?v.slice(1):v;});});return this}
}}};
ctx.SpreadsheetApp={openById:id=>{assert.equal(id,ctx.LEAD_WORKBOOK_ID_);return {getSheets:()=>[sheet]}},flush(){}};
ctx.forwardLeadRequest_=payload=>{
 if(payload.operation==='lead_sheet_export')return {known_ids:['L-existing','L-new'],leads:[{id:'old',lead_id:'L-existing',version:2,values:existing},{id:'new',lead_id:'L-new',version:1,values:fresh}]};
 if(failedAck){failedAck=false;throw new Error('network');}acks.push(payload);return {ok:true};
};
assert.throws(()=>ctx.syncLeadsToExistingSheet(),/network/);
ctx.syncLeadsToExistingSheet();ctx.syncLeadsToExistingSheet();
assert.equal(grid.length,7);assert.equal(grid[5][0],'L-existing');assert.equal(grid[6][0],'L-new');
assert.equal(grid[5][17],existing[17]);assert.equal(acks.length,4);
assert.equal(ctx.leadSheetValue_(new Date('2026-10-01T00:00:00Z')),46296);
const before=writes;grid.push(['unimported']);assert.throws(()=>ctx.syncLeadsToExistingSheet(),/Unknown/);assert.equal(writes,before);
grid.pop();grid.push(['L-existing']);assert.throws(()=>ctx.syncLeadsToExistingSheet(),/Duplicate sheet ID/);assert.equal(writes,before);
assert.throws(()=>ctx.importExistingLeadsToCrm(),/disabled/);
ctx.PropertiesService={getScriptProperties:()=>({getProperty:()=> '1800000002'})};
assert.throws(()=>ctx.leadSheet_(),/archive is forbidden/);
console.log('PASS sheet upsert, failed-ack retry, formula escaping, date serial, unknown and duplicate IDs');
