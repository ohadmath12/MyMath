'use strict';

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync(require('path').join(__dirname, '..', 'Code.gs'), 'utf8');
const htmlSource = fs.readFileSync(require('path').join(__dirname, '..', 'public', 'index.html'), 'utf8');
const appSource = fs.readFileSync(require('path').join(__dirname, '..', 'public', 'app.js'), 'utf8');
const context = vm.createContext({ console });
vm.runInContext(source, context, { filename: 'Code.gs' });

assert.strictEqual(context.normalizeIsraeliId_('123456782'), '123456782');
assert.strictEqual(context.normalizeIsraeliId_(' 123-456-782 '), '123456782');
assert.throws(() => context.normalizeIsraeliId_('123456789'));
assert.throws(() => context.normalizeIsraeliId_('abc123456782'));

assert.strictEqual(context.isValidEmail_('parent@example.com'), true);
assert.strictEqual(context.isValidEmail_('not-an-email'), false);

assert.strictEqual(context.ALLOWED_SCHOOLS_.includes('חטיבת שז"ר, קריית אונו'), true);
assert.strictEqual(context.ALLOWED_SCHOOLS_.includes('בית ספר יסודי יובלים'), true);
assert.strictEqual(context.ALLOWED_SCHOOLS_.includes('חטיבת בראשית, גני תקווה'), true);
assert.strictEqual(context.ALLOWED_CLASSES_.slice(0, 3).join(','), 'ד,ה,ו');
assert.strictEqual(context.ALLOWED_UNITS_.includes('לא רלוונטי'), true);
assert.strictEqual(context.ALLOWED_UNITS_.includes('הקבצה א׳ חדשה'), true);
assert.match(htmlSource, /value="חטיבת בראשית, גני תקווה"/);
assert.match(htmlSource, /value="בית ספר יסודי יובלים"/);
assert.match(htmlSource, /value="ד"/);
assert.match(htmlSource, /value="ה"/);
assert.match(htmlSource, /value="ו"/);
assert.match(htmlSource, /value="לא רלוונטי"/);
assert.match(htmlSource, /value="הקבצה א׳ חדשה"/);
assert.strictEqual(context.SHEET_HEADERS_.slice(19, 23).join(','),
  'crm_sync_status,crm_synced_at,crm_student_id,crm_sync_error');
assert.strictEqual(context.SHEET_HEADERS_[23], 'client_submission_id');
assert.strictEqual(context.SHEET_HEADERS_[24], 'parent_phone');
assert.strictEqual(context.REQUIRED_FIELDS_.includes('parent_phone'), true);
assert.match(htmlSource, /id="parent_phone"[^>]*required/);
assert.match(appSource, /parent_phone: normalizeIsraeliMobilePhone/);

assert.strictEqual(context.readPngUint32_([0, 0, 2, 0], 0), 512);

const strictProperties = {
  getProperty(name) {
    return name === 'API_GATEWAY_SECRET' ? 'test-secret' : 'false';
  }
};
const gatewayPayload = { student_first_name: 'בדיקה' };
assert.strictEqual(
  context.extractRegistrationPayload_({ gateway_secret: 'test-secret', payload: gatewayPayload }, strictProperties),
  gatewayPayload
);
assert.throws(() => context.extractRegistrationPayload_({ student_first_name: 'בדיקה' }, strictProperties));

const transitionProperties = { getProperty() { return null; } };
const legacyPayload = { student_first_name: 'בדיקה ישנה' };
assert.strictEqual(context.extractRegistrationPayload_(legacyPayload, transitionProperties), legacyPayload);

console.log('Security validation tests passed.');

const calls=[];
context.PropertiesService={getScriptProperties:()=>({getProperty:key=>({CRM_INTAKE_URL:'https://example.invalid/intake',CRM_INTAKE_SECRET:'test-only'}[key])})};
const receipt='30000000-0000-4000-8000-000000000001';
context.UrlFetchApp={fetch:(url,options)=>{calls.push({url,options});return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({ok:true,receipt})}}};
const normalized={client_submission_id:'10000000-0000-4000-8000-000000000001',student_first_name:'Test',student_last_name:'Student',parent_phone:'0500000000'};
assert.equal(context.reserveTrialConversion_({trial_token:'a'.repeat(64)},normalized),receipt);
assert.equal(JSON.parse(calls[0].options.payload).operation,'reserve_trial_conversion');
assert.equal(context.SHEET_HEADERS_[25],'trial_conversion_receipt');
let sync;
context.updateCrmSyncCells_=(...args)=>{sync=args};
context.UrlFetchApp.fetch=(url,options)=>{calls.push({url,options});return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({ok:true,registration_id:'reg',student_id:'student'})}};
context.syncRegistrationToCrm_({...normalized,registration_id:'reg',trial_conversion_receipt:receipt},2);
const sent=JSON.parse(calls[1].options.payload);
assert.equal(sent.trial_conversion_receipt,receipt);assert.equal(sent.client_submission_id,normalized.client_submission_id);assert.equal(sent.trial_token,undefined);assert.equal(sync[1],'synced');
console.log('Conversion receipt exchange and retry payload tests passed; no token persisted to Sheets.');

assert.equal(context.SHEET_HEADERS_[26],'lead_conversion_receipt');
context.UrlFetchApp.fetch=(url,options)=>{calls.push({url,options});return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({ok:true,receipt})}};
assert.equal(context.reserveLeadRegistration_({lead_token:'b'.repeat(64)},normalized),receipt);
assert.equal(JSON.parse(calls.at(-1).options.payload).operation,'reserve_lead_registration');
context.UrlFetchApp.fetch=(url,options)=>{calls.push({url,options});return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({ok:true,registration_id:'reg',student_id:'student'})}};
context.syncRegistrationToCrm_({...normalized,registration_id:'reg',lead_conversion_receipt:receipt},2);
const leadPayload=JSON.parse(calls.at(-1).options.payload);
assert.equal(leadPayload.lead_conversion_receipt,receipt);assert.equal(leadPayload.lead_token,undefined);
console.log('Lead receipt round-trip preserves the existing registration control columns.');
