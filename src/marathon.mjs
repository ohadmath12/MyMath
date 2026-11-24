import {ParentNameContract} from '../name-contract.mjs';
const FIELDS=['returning_version','expected_revision','expected_agorot','registration_event_id','invitation_token','form_version','request_kind','school_city','exam_date','client_submission_id','event_id','quoted_price','student_first_name','student_last_name','school_name','school_other','class_name','units','parent_name','parent_first_name','parent_last_name','parent_name_version','parent_phone','student_phone','parent_email','notes'];
function safePayment(value){
 if(!value||typeof value.amount!=='number'||!Number.isFinite(value.amount)||value.amount<=0||value.amount>10000||typeof value.url!=='string'||value.url.length>2048)throw Error('invalid_payment');
 const url=new URL(value.url);
 if(url.protocol!=='https:'||url.username||url.password||url.port||!['grow.link','meshulam.co.il','grow.business'].some(host=>url.hostname===host||url.hostname.endsWith('.'+host)))throw Error('invalid_payment');
 return{amount:value.amount,url:value.url};
}
export async function marathonRequest(request,env,fetchImpl,{json,validateTurnstile,publicError}){
 const url=new URL(request.url),catalog=url.pathname==='/api/marathons';
 const origin=request.headers.get('Origin');
 if(origin&&origin!=='https://ohadmath12.github.io'&&origin!==url.origin)return json({ok:false,error:publicError},403,request);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':origin||'https://ohadmath12.github.io','Access-Control-Allow-Methods':catalog?'GET, OPTIONS':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Vary':'Origin'}});
 if(request.method!==(catalog?'GET':'POST'))return json({ok:false,error:publicError},405,request);
 if(!env.MARATHON_SCRIPT_URL||!env.MARATHON_GATEWAY_SECRET)return json({ok:false,error:publicError},503,request);
 const rate=await env.REGISTRATION_RATE_LIMITER.limit({key:'marathon:'+request.headers.get('CF-Connecting-IP')});if(!rate.success)return json({ok:false,error:publicError},429,request);
 let payload={operation:'marathon_catalog'};
 if(!catalog){
  const type=request.headers.get('Content-Type')||'';
  if(!type.startsWith('text/plain')&&!type.startsWith('application/json'))return json({ok:false,error:publicError},415,request);
  if(Number(request.headers.get('Content-Length'))>8192)return json({ok:false,error:publicError},413,request);
  const raw=await request.text();if(raw.length>8192)return json({ok:false,error:publicError},413,request);
  let input;try{input=JSON.parse(raw);}catch{return json({ok:false,error:publicError},400,request);}
  if(!input||typeof input!=='object'||Array.isArray(input))return json({ok:false,error:publicError},400,request);
  if(['marathon_returning_context','marathon_returning_resume'].includes(input.operation)){
   if(typeof input.invitation_token!=='string'||! /^[a-f0-9]{64}$/.test(input.invitation_token))return json({ok:false,error:publicError},400,request);
   payload={operation:input.operation,invitation_token:input.invitation_token};
  }else{
  const token=input.turnstile_token;if(typeof token!=='string'||!token||token.length>2048)return json({ok:false,error:publicError},400,request);
  try{if(!await validateTurnstile(token,input.client_submission_id,request,env,fetchImpl,'marathon'))return json({ok:false,error:publicError},403,request);}catch{return json({ok:false,error:publicError},502,request);}
  if(input.honeypot)return json({ok:true},200,request);
  try{if(input.parent_first_name!==undefined||input.parent_last_name!==undefined||input.parent_name_version!==undefined)input.parent_name=ParentNameContract.normalize(input);}catch{return json({ok:false,error:'יש למלא שם פרטי ושם משפחה של ההורה.'},400,request);}
  payload={...Object.fromEntries(FIELDS.map(k=>[k,input[k]])),operation:'marathon_intake'};
  }
 }
 try{
  const response=await fetchImpl(env.MARATHON_SCRIPT_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({gateway_secret:env.MARATHON_GATEWAY_SECRET,payload}),redirect:'follow'});
  const result=await response.json();
  if(!response.ok||!result.ok)return json({ok:false,error:publicError,...(['event_changed','study_mismatch','invalid_invitation','invitation_identity'].includes(result.code)?{code:result.code}:{})},['event_changed','study_mismatch','invalid_invitation','invitation_identity'].includes(result.code)?409:502,request);
  if(payload.operation==='marathon_returning_context')return json({ok:true,context:publicReturningContext(result.context)},200,request);
  if(!catalog){
   if(payload.form_version!==2&&payload.operation!=='marathon_returning_resume')return json({ok:true},200,request);
   const paymentStatus=['ready','recorded','pending','review','cash'].includes(result.paymentStatus)?result.paymentStatus:'pending';
   return json({ok:true,paymentStatus,...(typeof result.eventTitle==='string'&&result.eventTitle.length<=160?{eventTitle:result.eventTitle}:{}),...(paymentStatus==='cash'&&Number.isFinite(result.amount)&&result.amount>0?{amount:result.amount}:{}),...(paymentStatus==='ready'?{payment:safePayment(result.payment)}:{})},200,request);
  }
  if(!Array.isArray(result.events))throw Error();
  const events=result.events.map(e=>{if(typeof e.id!=='string'||typeof e.name!=='string'||typeof e.price!=='number'||!Number.isFinite(e.price)||e.price<0)throw Error();return{id:e.id,name:e.name,price:e.price};});
  return json({ok:true,events},200,request);
 }catch{return json({ok:false,error:publicError},502,request);}
}

function publicReturningContext(c){
 if(c&&c.legacy===true)return{legacy:true};
 const e=c&&c.event,s=c&&c.student;
 if(!e||!s||typeof e.id!=='string'||typeof e.title!=='string'||e.title.length>160||!Number.isInteger(e.quoted_agorot)||e.quoted_agorot<=0||e.quoted_agorot>1000000||!['unregistered','pending','recorded','review','closed'].includes(c.payment_status))throw Error('invalid_context');
 for(const k of ['first','last','parent_name','parent_phone','school_name'])if(typeof s[k]!=='string'||s[k].length>160)throw Error('invalid_context');
 for(const k of ['grade','study_level','starts_at','ends_at','timezone'])if(typeof e[k]!=='string'||e[k].length>100)throw Error('invalid_context');
 if(!Number.isInteger(c.received_agorot)||!Number.isInteger(c.remaining_agorot)||c.received_agorot<0||c.remaining_agorot<0)throw Error('invalid_context');
 return {event:{id:e.id,title:e.title,grade:e.grade,study_level:e.study_level,starts_at:e.starts_at,ends_at:e.ends_at,timezone:e.timezone,quoted_agorot:e.quoted_agorot,revision:e.revision},student:{first:s.first,last:s.last,parent_name:s.parent_name,parent_phone:s.parent_phone,school_name:s.school_name},payment_status:c.payment_status,received_agorot:c.received_agorot,remaining_agorot:c.remaining_agorot,can_submit:c.can_submit===true&&c.payment_status==='unregistered',can_resume:c.can_resume===true&&c.payment_status==='pending',expires_at:c.expires_at};
}
