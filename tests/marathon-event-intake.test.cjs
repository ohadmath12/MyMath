const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const event=uuid(1),other=uuid(2),grant=uuid(3),revision=uuid(4);
const settings={amount:100,url:'https://pay.grow.link/synthetic',revision};
const props={MW_CRM_ENABLED:'true',MW_CRM_PUBLIC_KEY:'test',MARATHON_GATEWAY_SECRET:'test',['MW_CHECKOUT_'+revision]:JSON.stringify(settings)};
const ctx={console,PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]})},SpreadsheetApp:{flush(){}},Number,Date};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('marathon-script/Intake.gs','utf8')+'\n'+fs.readFileSync('marathon-script/Admin.gs','utf8'),ctx);
const rows=[],log={getLastRow:()=>rows.length+1,getMaxRows:()=>100,getRange:(r,c,n,w)=>({getValues:()=>rows.slice(r-2,r-2+n).map(x=>x.slice(c-1,c-1+w)),setValues:values=>values.forEach((value,i)=>{rows[r-2+i]??=Array(19).fill('');value.forEach((v,j)=>rows[r-2+i][c-1+j]=v);})})};
ctx.mwEnsureLog_=()=>log;
let imports=0,lookup=true,partPaid=false,paid=false,blocked=false,failImport=false;
const records=new Map(),identities=new Map();
ctx.mwEventRpc_=(name,args)=>{
 if(name==='marathon_registration_event'){
  if(!lookup||args.grant_id!==grant)throw Error('event_unavailable');
  return{event:{id:args.event_id,title:'Synthetic event',grade:'י',study_level:'4 יח״ל',quoted_agorot:10000,checkout_code:revision}};
 }
 if(name==='import_marathon_registration'){
  imports++;if(failImport)throw Error('network');const p=args.p;
  assert.equal(p.received_agorot,0);assert.equal(p.registration_event_grant_id,grant);
  const identity=[p.registration_event_id,p.parent_phone,p.student_first_name,p.student_last_name].join('|');
  const existing=identities.get(identity),result=existing||{id:uuid(20+identities.size),registration_event_id:p.registration_event_id,quoted_agorot:10000};
  identities.set(identity,result);records.set(p.source_key,result);return{...result,duplicate:!!existing};
 }
 if(name==='marathon_checkout_state')return{known:true,...records.get(args.source),paid,blocked,remaining_agorot:partPaid?5000:10000,checkout_code:revision};
 throw Error(name);
};
const p={id:uuid(10),first:'Test',last:'Pupil',parent:'Parent',phone:'0500000000',school:'',grade:'י',level:'4 יח״ל',studentPhone:'',email:'',notes:'',event:'',kind:'interest',version:2,registrationEventId:event,registrationEventGrantId:grant};
let result=ctx.mwEventIntake_({},p);assert.equal(result.paymentStatus,'ready');assert.equal(rows.length,1);assert.equal(identities.size,1);
ctx.mwEventIntake_({},p);assert.equal(imports,1);assert.equal(rows.length,1);
ctx.mwEventIntake_({},{...p,id:uuid(11)});assert.equal(rows.length,2);assert.equal(identities.size,1);
ctx.mwEventIntake_({},{...p,id:uuid(12),registrationEventId:other});assert.equal(identities.size,2);
assert.throws(()=>ctx.mwEventIntake_({},{...p,registrationEventId:other}),/receipt_mismatch/);
partPaid=true;assert.equal(ctx.mwEventIntake_({},p).paymentStatus,'review');partPaid=false;
blocked=true;assert.equal(ctx.mwEventIntake_({},p).paymentStatus,'review');blocked=false;
lookup=false;assert.equal(ctx.mwEventIntake_({},p).paymentStatus,'pending');
paid=true;assert.equal(ctx.mwEventIntake_({},p).paymentStatus,'recorded');paid=false;lookup=true;
failImport=true;assert.throws(()=>ctx.mwEventIntake_({},{...p,id:uuid(13)}),/network/);assert.equal(rows[3][13],'ממתין');
failImport=false;ctx.mwProcess_({},log,5,JSON.parse(rows[3][18]));assert.equal(rows[3][13],'נקלט');
ctx.mwInvitation_=()=>({id:uuid(30),first:p.first,last:p.last,phone:p.phone,registrationEventId:event,registrationEventGrantId:grant});
const bound=ctx.mwBindInvitation_({...p,registrationEventGrantId:undefined},'synthetic');assert.equal(bound.registrationEventGrantId,grant);
assert.throws(()=>ctx.mwBindInvitation_({...p,registrationEventId:other},'synthetic'),/invitation_identity/);
assert.throws(()=>ctx.mwBindInvitation_({...p,phone:'0500000001'},'synthetic'),/invitation_identity/);
props['MW_CHECKOUT_'+revision]=JSON.stringify({...settings,amount:150});
assert.throws(()=>ctx.mwEventCheckoutTerms_({checkout_code:revision,quoted_agorot:10000}),/event_unavailable/);
console.log('PASS: event isolation, immutable receipts, SQL alias use, durable retry, private identity binding, partial-payment protection and checkout config validation');
