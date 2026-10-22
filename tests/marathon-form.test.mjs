import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../public/marathons/marathons.js',import.meta.url),'utf8');
const event={id:'test-event',name:'מרתון י 5 יח״ל',price:100};
const response=(events=[event])=>({ok:true,json:async()=>({ok:true,events})});
const flush=async()=>{for(let i=0;i<35;i++)await Promise.resolve();};
function setup(fetchImpl,config={apiEndpoint:'https://gateway.test/api/register',turnstileSiteKey:'public'},supportsAbort=true){
 const elements={},timers=new Map(),calls=[],windowListeners={};let nextTimer=0,time=0,challenge;
 function element(){return{value:'',hidden:false,disabled:false,textContent:'',children:[],listeners:{},addEventListener(type,fn){this.listeners[type]=fn;},dispatchEvent(e){this.listeners[e.type]?.call(this,e);},replaceChildren(...items){this.children=items;this.value=items[0]?.value||'';},append(...items){this.children.push(...items);},add(item){this.children.push(item);},focus(){},reportValidity(){return true;}};}
 const document={getElementById(id){return elements[id]??=element();},createElement:element};
 document.getElementById('success-card').hidden=true;
 document.getElementById('student_first_name').value='פרטים שכבר מולאו';
 const window={MYTHEMATIX_CONFIG:config,addEventListener:(type,fn)=>windowListeners[type]=fn,turnstile:{render(_selector,options){challenge=options.callback;return 1;}}};
 const ctx={document,window,location:{href:'https://form.test/marathons/',search:'?event=test-event'},URL,URLSearchParams,Promise,AbortController:supportsAbort?AbortController:undefined,Event,crypto:{},Option:function(text,value){this.textContent=text;this.value=value;},fetch:(url,options)=>{calls.push({url,options});return fetchImpl(calls.length,options);},setTimeout(fn,delay){const id=++nextTimer;timers.set(id,{at:time+delay,fn});return id;},clearTimeout:id=>timers.delete(id)};
 vm.runInNewContext(source,ctx);window.marathonTurnstileReady();
 return{elements,calls,windowListeners,token:()=>challenge('valid-token'),async advance(ms){const end=time+ms;await flush();while(true){const next=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;time=next[1].at;timers.delete(next[0]);next[1].fn();await flush();}time=end;await flush();}};
}
test('transient network failure retries, preserves fields and deep link, never displays price',async()=>{
 const t=setup(n=>n===1?Promise.reject(Error('network')):Promise.resolve(response()));await t.advance(1000);t.token();
 assert.equal(t.calls.length,2);assert.equal(t.elements.event_id.value,event.id);assert.equal(t.elements.event_id.disabled,false);assert.equal(t.elements['submit-btn'].disabled,false);assert.equal(t.elements.student_first_name.value,'פרטים שכבר מולאו');
 assert.equal(t.elements.event_id.children[1].textContent,event.name);assert.equal(t.elements['event-summary'].children.length,1);
});
test('hung network expires, exposes retry, ignores late response and blocks submission during reload',async()=>{
 let resolveOld;const t=setup(n=>n===1?new Promise(r=>resolveOld=r):n===2?new Promise(()=>{}):Promise.resolve(response()));
 await t.advance(25000);t.token();assert.equal(t.calls.length,2);assert.equal(t.elements['reload-catalog'].hidden,false);assert.equal(t.elements['submit-btn'].disabled,true);assert.equal(t.elements.event_id.disabled,true);
 const retry=t.elements['reload-catalog'].listeners.click();t.token();assert.equal(t.elements['submit-btn'].disabled,true);await retry;assert.equal(t.elements['submit-btn'].disabled,false);
 resolveOld(response([{id:'stale',name:'closed marathon',price:80}]));await flush();assert.equal(t.elements.event_id.value,event.id);
});
test('hung JSON parsing also times out and recovers without AbortController',async()=>{
 const t=setup(n=>n===1?Promise.resolve({ok:true,json:()=>new Promise(()=>{})}):Promise.resolve(response()),undefined,false);await t.advance(13000);assert.equal(t.calls.length,2);assert.equal(t.elements.event_id.disabled,false);
});
test('rate limit gives a one-minute instruction without immediate automatic retries',async()=>{
 const t=setup(()=>Promise.resolve({ok:false,status:429}));await t.advance(30000);assert.equal(t.calls.length,1);assert.match(t.elements['catalog-status'].textContent,/המתינו דקה/);assert.equal(t.elements['reload-catalog'].hidden,false);
});
test('manual refresh drops stale selected events and handles genuinely empty catalog',async()=>{
 const t=setup(n=>Promise.resolve(response(n===1?[event]:[])));await flush();t.token();const retry=t.elements['reload-catalog'].listeners.click();t.token();assert.equal(t.elements['submit-btn'].disabled,true);await retry;assert.equal(t.elements['submit-btn'].disabled,true);assert.equal(t.elements.event_id.value,'');assert.match(t.elements['catalog-status'].textContent,/אין מרתונים פתוחים/);
});
test('restored network triggers recovery while preserving typed fields',async()=>{
 const t=setup(n=>n<=2?Promise.reject(Error('offline')):Promise.resolve(response()));await t.advance(1000);t.windowListeners.online();await flush();assert.equal(t.calls.length,3);assert.equal(t.elements.event_id.disabled,false);assert.equal(t.elements.student_first_name.value,'פרטים שכבר מולאו');
});
