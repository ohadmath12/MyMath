import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../public/enrollment-payment.js',import.meta.url),'utf8');
class Element{constructor(tag){this.tag=tag;this.children=[];this.hidden=false;}set textContent(v){this.text=v;this.children=[]}get textContent(){return this.text}appendChild(v){this.children.push(v)}querySelectorAll(selector){return this.children.filter(x=>selector==='a[target="_blank"]'&&x.tag==='a'&&x.target==='_blank')}setAttribute(){}addEventListener(k,fn){this.listener=fn}}
async function scenario(result,reject=false){if(result)result={registration_saved:true,...result};const form=new Element('form'),parent=new Element('parent'),success=new Element('success');parent.insertBefore=(el)=>parent.appendChild(el);form.parentNode=parent;const fields=Object.fromEntries(['parent_name','parent_phone','student_first_name','student_last_name','class_name','school_name'].map(id=>[id,{value:'',tagName:'INPUT'}]));fields.parent_name.value='User typed';const price=new Element('div');const events=[];const document={dispatchEvent:e=>events.push(e),createElement:t=>new Element(t),querySelector:s=>s==='.payment-price'?price:form,getElementById:id=>id==='success-card'?success:fields[id]};const window={addEventListener(){},GrowConfirmation:{create(k,t,cb){const state={state:result?.terms?.monthly_method==='cash'?'cash':'pending',can_complete:result?.terms?.monthly_method==='cash',paid:false};return {watchReturn(){cb(state,'fixture status')},check:async()=>{cb(state,'fixture status');return state},getState:()=>state}}},ENROLLMENT_PAYMENT_CONFIG:{url:'https://example.invalid',key:'anon'}};window.parent=window;const calls=[];vm.runInNewContext(source,{window,document,CustomEvent:class {constructor(type,options){this.type=type;this.detail=options.detail}},URL,URLSearchParams,location:{search:''},Number,fetch:async(url,options)=>{calls.push({url,options});if(reject)throw Error('network');return {ok:true,json:async()=>result}}});window.EnrollmentPayment.init('trial','a'.repeat(64));await new Promise(r=>setTimeout(r,0));return {window,form,parent,success,calls,fields,price,events}}
const terms={initial_agorot:32500,service_month:'2026-11-01',payment_url:'https://pay.grow.link/fixture',monthly_method:'recurring'};
let a=await scenario({ok:true,terms});assert.equal(a.parent.children[0].children.some(x=>x.tag==='a'),true);a.window.EnrollmentPayment.completed();assert.equal(a.success.children[0].children.filter(x=>x.tag==='a').length,1);a.window.EnrollmentPayment.completed();assert.equal(a.success.children.length,1);assert.equal(a.calls.length,1);assert.ok(!a.calls.some(x=>/save|paid|charge/.test(x.url)));
a=await scenario({ok:true,terms:{...terms,monthly_method:'cash',payment_url:null}});a.window.EnrollmentPayment.completed();assert.equal(a.success.children[0].children.filter(x=>x.tag==='a').length,0);
for(const result of [{ok:false},{ok:true,terms:{...terms,payment_url:'https://grow.link.evil.invalid/x'}}]){a=await scenario(result);let stopped=false;a.form.listener({preventDefault(){stopped=true},stopImmediatePropagation(){}});assert.ok(stopped);a.window.EnrollmentPayment.completed();assert.equal(a.success.children.length,0)}
a=await scenario({ok:true,terms:null});a.window.EnrollmentPayment.completed();assert.equal(a.success.children.length,0);assert.equal(a.parent.children[0].hidden,false);
a=await scenario(null,true);let stopped=false;a.form.listener({preventDefault(){stopped=true},stopImmediatePropagation(){}});assert.ok(stopped);
a=await scenario({ok:true,terms:{...terms,monthly_agorot:60000,recurring_starts_on:'2026-12-10',sibling_discount:true},prefill:{parent_name:'Original',student_first_name:'Child'}});
assert.equal(a.fields.student_first_name.value,'Child');assert.equal(a.fields.parent_name.value,'User typed');assert.match(a.price.textContent,/600/);assert.ok(a.parent.children[0].children.some(x=>(x.textContent||'').includes('10/12/2026')));
a=await scenario({ok:true,terms:{...terms,initial_agorot:42000,initial_lesson_agorot:14000,initial_lesson_count:3,monthly_agorot:65000}});
assert.ok(a.parent.children[0].children.some(x=>(x.textContent||'').includes('3 שיעורים × 140')));
assert.ok(a.parent.children[0].children.some(x=>(x.textContent||'').includes('המחיר החודשי להמשך')));
a=await scenario({ok:true,terms:{...terms,initial_lesson_agorot:14000,initial_lesson_count:3}});stopped=false;a.form.listener({preventDefault(){stopped=true},stopImmediatePropagation(){}});assert.ok(stopped);
console.log('PASS: legacy saved registration resumes checkout, single render, cash has no checkout, no charge calls, invalid/missing terms guarded, missing terms fail closed');

for (const price of [60000, 62000]) {
  a=await scenario({ok:true,terms:{...terms,monthly_agorot:price,recurring_starts_on:'2026-12-10'}});
  assert.ok(a.parent.children[0].children.some(x=>(x.textContent||'').includes(`${price/100} ש״ח ב־10 בכל חודש, החל מ־10/12/2026. הוראת הקבע תוסדר בנפרד.`)));
}
for (const extra of [{monthly_agorot:65000,recurring_starts_on:'2026-12-10'},{monthly_agorot:60000,monthly_method:'cash',recurring_starts_on:'2026-12-10'},{monthly_agorot:60000}]) {
  a=await scenario({ok:true,terms:{...terms,...extra}});
  assert.ok(!a.parent.children[0].children.some(x=>(x.textContent||'').includes('בכל חודש,')));
}
console.log('PASS: personal recurring wording uses agreed amount/date; standard price, cash and missing date unchanged');
for(const monthly of [60000,65000]){
 a=await scenario({ok:true,terms:{...terms,initial_agorot:42000,initial_lesson_agorot:14000,initial_lesson_count:3,monthly_agorot:monthly,recurring_starts_on:'2026-12-10',payment_flow:'recurring_initial'}});
 const copy=a.parent.children[0].children.map(x=>x.textContent||'').join(' ');
 assert.match(copy,/החיוב הראשון יבוצע מיד/);assert.match(copy,/10\/12\/2026/);assert.ok(!copy.includes('תוסדר בנפרד'));
 a.window.EnrollmentPayment.completed();assert.match(a.success.children[0].children.find(x=>x.tag==='a').textContent,/להקמת הוראת קבע/);assert.equal(a.calls.length,1);
}
a=await scenario({ok:true,terms:{...terms,monthly_method:'cash',monthly_agorot:60000,payment_url:'https://pay.grow.link/stale',payment_flow:'recurring_initial'}});a.window.EnrollmentPayment.completed();assert.equal(a.success.children[0].children.filter(x=>x.tag==='a').length,0);assert.ok(a.success.children[0].children.some(x=>(x.textContent||'').includes('אינה אישור קבלת תשלום')));
console.log('PASS: recurring initial charge, agreed next date and cash cannot expose stale checkout');

for (const trial of [0,12000,16000]) {
 a=await scenario({ok:true,terms:{...terms,initial_agorot:48000,monthly_method:'cash',payment_url:null,unpaid_trial_agorot:trial}});
 const content=a.parent.children[0].children;
 assert.equal(content.some(x=>(x.textContent||'').includes('ניסיון שטרם שולם')),trial>0);
 assert.ok(content.some(x=>x.children.some(c=>(c.textContent||'').includes(String(480+trial/100)))));
 a.window.EnrollmentPayment.completed();assert.equal(a.success.children[0].children.filter(x=>x.tag==='a').length,0);assert.equal(a.calls.length,1);
}
for(const extra of [{unpaid_trial_agorot:-1,monthly_method:'cash'},{unpaid_trial_agorot:1.5,monthly_method:'cash'},{unpaid_trial_agorot:16000,monthly_method:'recurring'}]){
 a=await scenario({ok:true,terms:{...terms,...extra}});let blocked=false;a.form.listener({preventDefault(){blocked=true},stopImmediatePropagation(){}});assert.ok(blocked);
}
console.log('PASS: separate unpaid trial, cash total, no checkout/payment mutation, malformed terms blocked');
const familyTerms={...terms,initial_agorot:45000,initial_lesson_agorot:15000,initial_lesson_count:3,monthly_agorot:60000,recurring_starts_on:'2026-12-10',payment_flow:'separate',family_enrollment:true,existing_sibling_name:'אח לדוגמה',family_monthly_agorot:120000};
a=await scenario({ok:true,terms:familyTerms});
let familyCopy=a.parent.children[0].children.map(x=>x.textContent||'').join(' ');
assert.match(familyCopy,/אח לדוגמה/);assert.match(familyCopy,/מחושב בהתאם למספר השיעורים שנותרו בחודש/);assert.match(familyCopy,/450/);assert.match(familyCopy,/מהחודש הבא המחיר החודשי לשני הילדים יחד יתעדכן ל־1,200 ₪/);assert.match(familyCopy,/10\/12\/2026/);assert.doesNotMatch(familyCopy,/זיכוי|הקמת הוראת קבע/);assert.match(a.price.textContent,/1,200/);
a.window.EnrollmentPayment.completed();assert.equal(a.success.children[0].children.find(x=>x.tag==='a').href,terms.payment_url);assert.doesNotMatch(a.success.children[0].children.find(x=>x.tag==='a').textContent,/להקמת הוראת קבע/);assert.equal(a.calls.length,1);
for(const change of [{family_monthly_agorot:60000},{initial_agorot:40000},{existing_sibling_name:''},{payment_flow:'recurring_initial'},{monthly_agorot:120000},{recurring_starts_on:null}]){
 a=await scenario({ok:true,terms:{...familyTerms,...change}});let blocked=false;a.form.listener({preventDefault(){blocked=true},stopImmediatePropagation(){}});assert.ok(blocked);a.window.EnrollmentPayment.completed();assert.equal(a.success.children.length,0);
}
console.log('PASS: prepared family summary, no 50 ILS credit, 450 one-off, 1200 next month, existing sibling name, malformed family terms fail closed');

const shared={...terms,initial_agorot:30000,monthly_agorot:120000,payment_flow:'recurring_initial',recurring_starts_on:'2026-12-10',new_siblings:true,family_url:'https://ohadmath12.github.io/MyMath/family.html#family='+'c'.repeat(64)};
a=await scenario({ok:true,terms:shared});a.window.EnrollmentPayment.completed();assert.equal(a.success.children[0].children.find(x=>x.tag==='a').href,shared.family_url);assert.ok(!a.success.children[0].children.some(x=>x.tag==='a'&&x.href===shared.payment_url));
a=await scenario({ok:true,terms:{...shared,family_url:'https://evil.invalid'}});let blockedShared=false;a.form.listener({preventDefault(){blockedShared=true},stopImmediatePropagation(){}});assert.ok(blockedShared);
console.log('PASS: sibling child form returns to family checkout, never a second direct payment link; invalid family destination blocked');

a=await scenario({ok:true,terms,registration_saved:true,registration_id:'saved-id',payment_verified:false});assert.equal(a.events[0].type,'registration-payment-resume');assert.equal(a.events[0].detail.registrationId,'saved-id');a.window.EnrollmentPayment.completed();assert.equal(a.success.children[0].children.filter(x=>x.tag==='a').length,1);
a=await scenario({ok:true,terms,registration_saved:true,registration_id:'saved-id',payment_verified:true});a.window.EnrollmentPayment.completed();assert.equal(a.success.children[0].children.filter(x=>x.tag==='a').length,0);assert.match(a.success.children[0].children[0].textContent,/אין צורך לשלם שוב/);
console.log('PASS: saved forms resume payment; confirmed receipt hides checkout; no submission or payment mutation');


a=await scenario({ok:true,registration_saved:false,terms,payment_verified:false});assert.equal(a.form.hidden,false);assert.equal(a.form.inert,false);assert.equal(a.parent.children[0].id,'enrollment-checkout');assert.equal(a.parent.children[0].children.filter(x=>x.tag==='a').length,0);
a.window.EnrollmentPayment.completed();assert.equal(a.success.children[0].children.filter(x=>x.tag==='a').length,0);assert.match(a.success.children[0].children[0].textContent,/ההרשמה נשלחה/);assert.equal(a.calls.length,1);
a=await scenario({ok:true,registration_saved:false,terms:{...terms,monthly_method:'cash',payment_url:null}});assert.equal(a.form.hidden,false);assert.equal(a.parent.children[0].children.filter(x=>x.tag==='a').length,0);
for(const result of [{ok:false},{ok:true,terms:null},{ok:true,terms:{...terms,payment_url:'https://evil.invalid'}}]){a=await scenario(result);assert.equal(a.form.hidden,true);}
a=await scenario({ok:true,registration_saved:false,terms,registration_saved:true,registration_id:'existing'});assert.equal(a.events[0].type,'registration-payment-resume');a.window.EnrollmentPayment.completed();assert.equal(a.success.children[0].children.filter(x=>x.tag==='a').length,1);
a=await scenario({ok:true,registration_saved:false,terms,payment_verified:true});assert.equal(a.form.hidden,false);assert.equal(a.parent.children[0].children.filter(x=>x.tag==='a').length,0);
a=await scenario({ok:true,registration_saved:false,terms:{...terms,initial_agorot:65000,service_month:'2026-12-01',monthly_agorot:65000,recurring_starts_on:'2027-01-10',payment_flow:'recurring_initial'}});const copy=a.parent.children[0].children.map(x=>x.textContent||'').join(' ');assert.match(copy,/650/);assert.match(copy,/10\/01\/2027/);
console.log('PASS final checkout: form opens without receipt approval, checkout container and Grow link, submission confirmation does not imply payment, cash, invalid terms, existing saved and verified registrations, prepaid dates');
