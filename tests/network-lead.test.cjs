const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('NetworkLead.gs','utf8');
const payload={client_submission_id:'11111111-1111-4111-8111-111111111111',branch:'פתח תקווה — בן יחזקאל',parent_name:'בדיקה',parent_phone:'0500000000',student_first_name:'תלמיד',student_last_name:'בדיקה',class_name:'ז',school_name:'בדיקה',parent_email:''};
function fixture(){
 const rows=[],calls=[];
 const sheet={getSheetId:()=>1800000004,getLastRow:()=>4+rows.length,getMaxRows:()=>1000,getRange:(r,c,h,w)=>({getDisplayValues:()=>r===4?[Array.from(ctx.NETWORK_LEAD_HEADERS_)]:rows.slice(r-5,r-5+h).map(a=>a.slice(c-1,c-1+w)),setNumberFormat(){return this},setValues(v){rows[r-5]=v[0].map(s=>s.startsWith("'")?s.slice(1):s);return this}})};
 const ctx={Date,SpreadsheetApp:{openById:()=>({getSheets:()=>[sheet]}),flush(){}},Utilities:{formatDate:()=> '04/10/2026 12:00'},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},forwardLeadRequest_:p=>{calls.push(p);return {ok:true}}};
 vm.createContext(ctx);vm.runInContext(source,ctx);return {ctx,rows,calls};
}
test('PT saved once, source fixed, CRM untouched; retry keeps manual status',()=>{const {ctx,rows,calls}=fixture();ctx.networkLeadIntake_(payload);rows[0][11]='בטיפול';ctx.networkLeadIntake_(payload);assert.equal(rows.length,1);assert.equal(rows[0][9],'דף הנחיתה');assert.equal(rows[0][11],'בטיפול');assert.equal(calls.length,0)});
test('GT uses existing protected intake only with server-owned source',()=>{const {ctx,rows,calls}=fixture();ctx.networkLeadIntake_({...payload,branch:'גני תקווה',operation:'forged',intake_channel:'forged'});assert.equal(rows.length,0);assert.equal(calls[0].operation,'public_lead_intake');assert.equal(calls[0].intake_channel,'network_landing');assert.equal(calls[0].branch,undefined)});
test('validation rejects unknown branch, invalid phone and changed retry',()=>{const {ctx}=fixture();for(const change of [{branch:'other'},{parent_phone:'123'},{class_name:'א'},{parent_email:'invalid'},{client_submission_id:'invalid'}])assert.throws(()=>ctx.networkLeadIntake_({...payload,...change}));ctx.networkLeadIntake_(payload);assert.throws(()=>ctx.networkLeadIntake_({...payload,parent_name:'אחר'}))});
test('formula input saved as text',()=>{const {ctx,rows}=fixture();ctx.networkLeadIntake_({...payload,parent_name:'=SUM(1,2)'});assert.equal(rows[0][2],'=SUM(1,2)')});
