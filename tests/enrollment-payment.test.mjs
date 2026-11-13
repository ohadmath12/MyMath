import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../public/enrollment-payment.js',import.meta.url),'utf8');
class Element{constructor(tag){this.tag=tag;this.children=[];this.hidden=false;}set textContent(v){this.text=v;this.children=[]}get textContent(){return this.text}appendChild(v){this.children.push(v)}setAttribute(){}addEventListener(k,fn){this.listener=fn}}
async function scenario(result,reject=false){const form=new Element('form'),parent=new Element('parent'),success=new Element('success');parent.insertBefore=(el)=>parent.appendChild(el);form.parentNode=parent;const fields=Object.fromEntries(['parent_name','parent_phone','student_first_name','student_last_name','class_name','school_name'].map(id=>[id,{value:'',tagName:'INPUT'}]));fields.parent_name.value='User typed';const price=new Element('div');const document={createElement:t=>new Element(t),querySelector:s=>s==='.payment-price'?price:form,getElementById:id=>id==='success-card'?success:fields[id]};const window={ENROLLMENT_PAYMENT_CONFIG:{url:'https://example.invalid',key:'anon'}};const calls=[];vm.runInNewContext(source,{window,document,URL,Number,fetch:async(url,options)=>{calls.push({url,options});if(reject)throw Error('network');return {ok:true,json:async()=>result}}});window.EnrollmentPayment.init('trial','a'.repeat(64));await new Promise(r=>setTimeout(r,0));return {window,form,parent,success,calls,fields,price}}
const terms={initial_agorot:32500,service_month:'2026-11-01',payment_url:'https://pay.grow.link/fixture',monthly_method:'recurring'};
let a=await scenario({ok:true,terms});assert.equal(a.parent.children[0].children.some(x=>x.tag==='a'),false);a.window.EnrollmentPayment.completed();assert.equal(a.success.children[0].children.filter(x=>x.tag==='a').length,1);a.window.EnrollmentPayment.completed();assert.equal(a.success.children.length,1);assert.equal(a.calls.length,1);assert.ok(!a.calls.some(x=>/save|paid|charge/.test(x.url)));
a=await scenario({ok:true,terms:{...terms,monthly_method:'cash',payment_url:null}});a.window.EnrollmentPayment.completed();assert.equal(a.success.children[0].children.filter(x=>x.tag==='a').length,0);
for(const result of [{ok:false},{ok:true,terms:{...terms,payment_url:'https://grow.link.evil.invalid/x'}}]){a=await scenario(result);let stopped=false;a.form.listener({preventDefault(){stopped=true},stopImmediatePropagation(){}});assert.ok(stopped);a.window.EnrollmentPayment.completed();assert.equal(a.success.children.length,0)}
a=await scenario({ok:true,terms:null});a.window.EnrollmentPayment.completed();assert.equal(a.success.children.length,0);assert.equal(a.parent.children[0].hidden,true);
a=await scenario(null,true);let stopped=false;a.form.listener({preventDefault(){stopped=true},stopImmediatePropagation(){}});assert.ok(stopped);
a=await scenario({ok:true,terms:{...terms,monthly_agorot:60000,recurring_starts_on:'2026-12-10',sibling_discount:true},prefill:{parent_name:'Original',student_first_name:'Child'}});
assert.equal(a.fields.student_first_name.value,'Child');assert.equal(a.fields.parent_name.value,'User typed');assert.match(a.price.textContent,/600/);assert.ok(a.parent.children[0].children.some(x=>(x.textContent||'').includes('10/12/2026')));
a=await scenario({ok:true,terms:{...terms,initial_agorot:42000,initial_lesson_agorot:14000,initial_lesson_count:3,monthly_agorot:65000}});
assert.ok(a.parent.children[0].children.some(x=>(x.textContent||'').includes('3 שיעורים × 140')));
assert.ok(a.parent.children[0].children.some(x=>(x.textContent||'').includes('החל מהחודש הבא')));
a=await scenario({ok:true,terms:{...terms,initial_lesson_agorot:14000,initial_lesson_count:3}});stopped=false;a.form.listener({preventDefault(){stopped=true},stopImmediatePropagation(){}});assert.ok(stopped);
console.log('PASS: payment only after saved registration, single render, cash has no checkout, no charge calls, invalid/missing terms guarded, old personal links without plan supported');

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
