const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function fixture(fetch){
 const nodes={};let submit,timeout,cleared=false,reset=0,removed=0;
 for(const id of ['lead-form','submit','message','school_name','school_other','school-other-field'])nodes[id]={value:'school',hidden:false,addEventListener(type,cb){if(type==='submit')submit=cb},setCustomValidity(){},reportValidity(){return true}};
 const context={document:{getElementById:id=>nodes[id]},sessionStorage:{getItem:()=> '11111111-1111-4111-8111-111111111111',setItem(){},removeItem(){removed++}},crypto:{randomUUID:()=>{throw Error('must reuse ID')}},URL,AbortController,FormData:class { *[Symbol.iterator](){yield ['parent_name','test'];yield ['school_name','school']}},setTimeout:cb=>{timeout=cb;return 1},clearTimeout:()=>{cleared=true},fetch,window:{MYTHEMATIX_CONFIG:{turnstileSiteKey:'test',apiEndpoint:'https://test.test/api/register'},turnstile:{render:(id,options)=>{options.callback('challenge');return 0},reset:()=>reset++}}};
 vm.createContext(context);vm.runInContext(fs.readFileSync('public/inquiry/lead.js','utf8'),context);context.window.leadTurnstileReady();
 return {nodes,send:()=>submit({preventDefault(){}}),expire:()=>timeout(),state:()=>({cleared,reset,removed})};
}
test('never-ending fetch releases submit, retains form and submission identity',async()=>{
 let signal,body;const f=fixture((_,opts)=>{signal=opts.signal;body=JSON.parse(opts.body);return new Promise(()=>{})});
 const pending=f.send();assert.match(f.nodes.message.textContent,/שומרים/);f.expire();await pending;
 assert.equal(signal.aborted,true);assert.equal(f.nodes['lead-form'].hidden,false);assert.match(f.nodes.message.textContent,/11111111/);assert.equal(f.state().removed,0);assert.equal(f.state().reset,1);assert.equal(body.client_submission_id,'11111111-1111-4111-8111-111111111111');
});
test('stalled JSON body also times out; late server success does not show false success',async()=>{
 let resolveBody;const f=fixture(async()=>({ok:true,json:()=>new Promise(r=>resolveBody=r)}));const pending=f.send();await Promise.resolve();f.expire();await pending;resolveBody({ok:true});await Promise.resolve();assert.equal(f.nodes['lead-form'].hidden,false);assert.equal(f.state().removed,0);
});
test('confirmed success closes the form and clears the saved request ID',async()=>{
 const f=fixture(async()=>({ok:true,json:async()=>({ok:true})}));await f.send();assert.equal(f.nodes['lead-form'].hidden,true);assert.equal(f.state().removed,1);assert.equal(f.state().cleared,true);
});
test('server rejection keeps the form without claiming success',async()=>{
 const f=fixture(async()=>({ok:false,json:async()=>({ok:false})}));await f.send();assert.equal(f.nodes['lead-form'].hidden,false);assert.equal(f.state().removed,0);
});
