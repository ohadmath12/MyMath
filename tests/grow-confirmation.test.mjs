import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../public/grow-confirmation.js',import.meta.url),'utf8');
async function fixture(responses){let calls=[],states=[],window={ENROLLMENT_PAYMENT_CONFIG:{url:'https://fixture.invalid',key:'anon'}};vm.runInNewContext(source,{window,setTimeout:f=>f(),fetch:async(url,o)=>{calls.push(JSON.parse(o.body));const d=responses.shift();if(d instanceof Error)throw d;return {ok:true,json:async()=>d}}});const instance=window.GrowConfirmation.create('lead','opaque-token',(s)=>states.push(s));return {instance,calls,states};}
let a=await fixture([{ok:true,state:'checking',paid:false,can_complete:false},{ok:true,state:'paid',paid:true,can_complete:true}]);let p=a.instance.check(true),p2=a.instance.check(true);assert.equal(p,p2);assert.equal((await p).paid,true);assert.deepEqual(a.calls.map(x=>x.refresh),[true,false]);
a=await fixture([{ok:true,state:'pending',paid:false,can_complete:false}]);assert.equal((await a.instance.check(false)).can_complete,false);
a=await fixture([new Error('network')]);assert.equal((await a.instance.check(true)).can_complete,false);assert.equal(a.instance.getState().state,'unavailable');
a=await fixture([{ok:false,paid:true,can_complete:true}]);assert.equal((await a.instance.check(true)).can_complete,false);
console.log('PASS provider confirmation UI: only backend result unlocks, no parallel duplicate queries, polls do not trigger provider requests, failed/invalid responses fail closed');
