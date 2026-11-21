import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';import {createHash,randomUUID} from 'node:crypto';
const source=await readFile(new URL('../Checkout.gs',import.meta.url),'utf8');let rows=[],files=new Map(),enabled='true',saves=0,paid=false,terms={initial_agorot:48000,monthly_agorot:65000,service_month:'2026-11-01',monthly_method:'recurring',payment_url:'https://pay.grow.link/fixture',recurring_starts_on:'2026-12-10'},family=false;
const sheet={getLastRow:()=>rows.length,appendRow:r=>rows.push(r),setFrozenRows(){},getRange(r,c,n=1,m=1){return {getValues:()=>rows.slice(r-1,r-1+n).map(v=>v.slice(c-1,c-1+m)),setValue(v){rows[r-1][c-1]=v;},setValues(values){values.forEach((v,i)=>v.forEach((x,j)=>rows[r-1+i][c-1+j]=x));}}}};
const ctx={console,Date,JSON,Object,Error,Number,String,Array,Utilities:{getUuid:randomUUID,DigestAlgorithm:{SHA_256:1},computeDigest:(_,s)=>[...createHash('sha256').update(s).digest()],newBlob:(s)=>s,sleep(){}},PropertiesService:{getScriptProperties:()=>({getProperty:k=>k==='UNIFIED_CHECKOUT_ENABLED'?enabled:'fixture'})},SpreadsheetApp:{openById:()=>({getSheetByName:()=>rows.length?sheet:null,insertSheet:()=>sheet})},DriveApp:{getFolderById:()=>({createFile(s){let id=randomUUID();files.set(id,s);return {getId:()=>id};}}),getFileById:id=>({getBlob:()=>({getDataAsString:()=>files.get(id)})})},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},validateRequiredFields_(){},normalizePayload_:p=>({client_submission_id:p.client_submission_id,signature_data_url:p.signature_data_url}),validateNormalizedPayload_(){},decodeSignature_(){},saveRegistration(p){saves++;return {ok:true,registrationId:p.client_submission_id};}};
vm.createContext(ctx);vm.runInContext(source,ctx);ctx.checkoutRpc_=(name,body)=>name==='family_registration_public'?{ok:true,children:[{token:'a'.repeat(64)},{token:'b'.repeat(64)}],payment_url:terms.payment_url}:name==='registration_payment_terms'?{ok:true,terms:{...terms,new_siblings:family}}:{ok:true,can_complete:paid||terms.monthly_method==='cash',paid,state:paid?'paid':terms.monthly_method==='cash'?'cash':'pending'};
let input={lead_token:'a'.repeat(64),client_submission_id:randomUUID(),signature_data_url:'signed-fixture'};enabled='false';assert.throws(()=>ctx.stageCheckout_(input),/not_enabled/);enabled='true';
assert.throws(()=>ctx.stageCheckout_({...input,honeypot:'bot'}),/invalid_checkout/);let d=ctx.stageCheckout_(input);assert.equal(rows.length,2);assert.equal(ctx.stageCheckout_(input).checkout_token,d.checkout_token);assert.equal(files.size,1);assert.throws(()=>ctx.stageCheckout_({...input,signature_data_url:'changed'}),/draft_changed/);
assert.equal(ctx.checkoutResume_({kind:'lead',token:input.lead_token}).complete_set,true);ctx.checkoutProcessRow_(2);assert.equal(saves,0);assert.equal(ctx.checkoutStatus_({checkout_token:d.checkout_token}).state,'pending');
paid=true;ctx.checkoutProcessRow_(2);assert.equal(saves,1);assert.equal(ctx.checkoutStatus_({checkout_token:d.checkout_token}).state,'completed');ctx.checkoutProcessRow_(2);assert.equal(saves,1);assert.throws(()=>ctx.checkoutStatus_({checkout_token:'f'.repeat(64)}),/invalid_checkout/);
family=true;let a=ctx.stageCheckout_({...input,client_submission_id:randomUUID(),family_token:'c'.repeat(64)}),b=ctx.stageCheckout_({...input,lead_token:'b'.repeat(64),client_submission_id:randomUUID(),family_token:'c'.repeat(64)});ctx.checkoutProcessRow_(3);assert.equal(saves,1);assert.throws(()=>ctx.armFamilyCheckout_({family_token:'c'.repeat(64),checkout_tokens:[a.checkout_token,a.checkout_token]}),/invalid_family/);ctx.armFamilyCheckout_({family_token:'c'.repeat(64),checkout_tokens:[a.checkout_token,b.checkout_token]});ctx.checkoutProcessRow_(3);ctx.checkoutProcessRow_(4);assert.equal(saves,3);
family=false;paid=false;let stale=ctx.stageCheckout_({...input,client_submission_id:randomUUID()});terms.initial_agorot=65000;ctx.checkoutProcessRow_(5);assert.equal(ctx.checkoutStatus_({checkout_token:stale.checkout_token}).state,'terms_changed');assert.equal(saves,3);
console.log('PASS durable checkout: disabled fail closed, immutable retry, unknown capability denied, unpaid held, provider-only finalization, dedupe, family armed only together, stale terms held');

terms.initial_agorot=48000;paid=true;let prepaid=ctx.stageCheckout_({...input,client_submission_id:randomUUID()});assert.equal(prepaid.payment_url,'');assert.equal(prepaid.state,'completed');console.log('PASS already-paid registration never returns another checkout link');

assert.equal(ctx.checkoutStatus_({checkout_token:prepaid.checkout_token}).payment_confirmed,true);terms.monthly_method='cash';paid=false;let cash=ctx.stageCheckout_({...input,lead_token:'e'.repeat(64),client_submission_id:randomUUID()});assert.equal(cash.state,'completed');assert.equal(ctx.checkoutStatus_({checkout_token:cash.checkout_token}).payment_confirmed,false);console.log('PASS cash completion remains distinct from provider-confirmed payment');
// Cash form persisted before a transient registration-save failure.
terms.monthly_method='cash';terms.unpaid_trial_agorot=0;paid=false;
const originalSave=ctx.saveRegistration;ctx.saveRegistration=()=>({ok:false});
const pendingCashInput={...input,lead_token:'d'.repeat(64),client_submission_id:randomUUID()};
assert.throws(()=>ctx.stageCheckout_(pendingCashInput),/save_failed/);
ctx.saveRegistration=originalSave;
const trialChanged=ctx.checkoutResume_({kind:'lead',token:pendingCashInput.lead_token}).checkouts[0];
const trialRow=rows.length;const savesBeforeTrialChange=saves;
terms.unpaid_trial_agorot=16000;
ctx.checkoutProcessRow_(trialRow);
assert.equal(ctx.checkoutStatus_({checkout_token:trialChanged.checkout_token}).state,'terms_changed');
assert.equal(saves,savesBeforeTrialChange);
console.log('PASS cash draft after transient failure invalidates unpaid-trial changes before saveRegistration');

// An old snapshot missing the trial amount is ambiguous even when today's amount is zero.
terms.unpaid_trial_agorot=0;ctx.saveRegistration=()=>({ok:false});
const legacyInput={...input,lead_token:'c'.repeat(64),client_submission_id:randomUUID()};
assert.throws(()=>ctx.stageCheckout_(legacyInput),/save_failed/);ctx.saveRegistration=originalSave;
const legacyRow=rows.length,legacyFile=rows[legacyRow-1][3];
const legacyDraft=JSON.parse(files.get(legacyFile));const historicalTerms=JSON.parse(legacyDraft.terms);delete historicalTerms.unpaid_trial_agorot;legacyDraft.terms=JSON.stringify(historicalTerms);files.set(legacyFile,JSON.stringify(legacyDraft));
const beforeLegacy=saves;ctx.checkoutProcessRow_(legacyRow);
assert.equal(rows[legacyRow-1][4],'terms_changed');assert.equal(saves,beforeLegacy);
console.log('PASS legacy missing trial snapshot held even at current zero; no silent assumption about signed amount');
