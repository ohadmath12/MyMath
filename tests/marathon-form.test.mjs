import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../public/marathons/marathons.js',import.meta.url),'utf8');
const flush=async()=>{for(let i=0;i<40;i++)await Promise.resolve();};
function setup(fetchImpl){
 const elements={},timers=new Map(),calls=[];let challenge,uuid=0,id=0;
 function element(){return{value:'',hidden:false,disabled:false,textContent:'',listeners:{},addEventListener(t,f){this.listeners[t]=f;},focus(){},reportValidity(){return true;},reset(){}};}
 const document={getElementById(id){return elements[id]??=element();}};
 document.getElementById('success-card').hidden=true;
 const fields={student_first_name:'בדיקת',student_last_name:'מערכת',parent_phone:'050-0000000',student_phone:'',parent_name:'הורה',school_name:'קציר, קריית אונו',class_name:'י״א',units:'5 יח״ל',exam_date:'2099-02-20'};
 const window={MYTHEMATIX_CONFIG:{apiEndpoint:'https://gateway.test/api/register',turnstileSiteKey:'public'},turnstile:{render(_s,opts){challenge=opts.callback;return 1;},reset(){}}};
 vm.runInNewContext(source,{document,window,location:{href:'https://form.test/marathons/?event=old-link'},URL,Promise,AbortController,crypto:{randomUUID:()=>`uuid-${++uuid}`},FormData:class{forEach(fn){Object.entries(fields).forEach(([k,v])=>fn(v,k));}},fetch:(url,options)=>{calls.push({url,options});return fetchImpl(calls.length,options);},setTimeout(fn){timers.set(++id,fn);return id;},clearTimeout:i=>timers.delete(i)});window.marathonTurnstileReady();
 return{elements,calls,fields,token:()=>challenge('token'),send:()=>elements['marathon-form'].listeners.submit({preventDefault(){}}),async timeout(){for(const fn of [...timers.values()])fn();await flush();}};
}
test('no catalog or price; one general request reaches the existing protected endpoint',async()=>{
 const t=setup(()=>Promise.resolve({ok:true,json:async()=>({ok:true})}));assert.equal(t.calls.length,0);t.token();assert.equal(t.elements['submit-btn'].disabled,false);t.send();await flush();assert.equal(t.calls.length,1);const p=JSON.parse(t.calls[0].options.body);assert.equal(t.calls[0].url,'https://gateway.test/api/marathon');assert.equal(p.request_kind,'interest');assert.equal(p.event_id,undefined);assert.equal(p.quoted_price,undefined);assert.equal(p.exam_date,'2099-02-20');assert.equal(p.parent_phone,'0500000000');assert.equal(t.elements['success-card'].hidden,false);
});
test('ambiguous timeout retains details and receipt ID; late completion cannot change the retried form',async()=>{
 let late;const t=setup(n=>n===1?new Promise(r=>late=r):Promise.resolve({ok:true,json:async()=>({ok:true})}));t.token();t.send();await t.timeout();assert.match(t.elements['form-error'].textContent,/מתעכבת/);t.token();t.send();await flush();assert.equal(JSON.parse(t.calls[0].options.body).client_submission_id,JSON.parse(t.calls[1].options.body).client_submission_id);late({ok:false,json:async()=>({ok:false})});await flush();assert.equal(t.elements['success-card'].hidden,false);
});
test('edited details get a fresh receipt, failed requests preserve typed fields',async()=>{
 const t=setup(()=>Promise.reject(Error('offline')));t.token();t.send();await flush();assert.equal(t.elements['success-card'].hidden,true);t.fields.units='4 יח״ל';t.token();t.send();await flush();assert.notEqual(JSON.parse(t.calls[0].options.body).client_submission_id,JSON.parse(t.calls[1].options.body).client_submission_id);
});
test('invalid mobile and missing challenge do not submit; other-school city is required only when relevant',()=>{
 const t=setup(()=>{throw Error('must not fetch');});t.send();assert.equal(t.calls.length,0);t.token();t.fields.parent_phone='123';t.send();assert.equal(t.calls.length,0);assert.match(t.elements['form-error'].textContent,/נייד ישראלי/);t.elements.school_name.value='אחר';t.elements.school_name.listeners.change();assert.equal(t.elements.school_city.required,true);t.elements.school_name.value='קציר, קריית אונו';t.elements.school_name.listeners.change();assert.equal(t.elements.school_city.disabled,true);
});
