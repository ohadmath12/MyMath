const FIELDS=['client_submission_id','event_id','quoted_price','student_first_name','student_last_name','school_name','school_other','class_name','units','parent_name','parent_phone','student_phone','parent_email','notes'];
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
  const token=input.turnstile_token;if(typeof token!=='string'||!token||token.length>2048)return json({ok:false,error:publicError},400,request);
  try{if(!await validateTurnstile(token,input.client_submission_id,request,env,fetchImpl,'marathon'))return json({ok:false,error:publicError},403,request);}catch{return json({ok:false,error:publicError},502,request);}
  if(input.honeypot)return json({ok:true},200,request);
  payload={...Object.fromEntries(FIELDS.map(k=>[k,input[k]])),operation:'marathon_intake'};
 }
 try{
  const response=await fetchImpl(env.MARATHON_SCRIPT_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({gateway_secret:env.MARATHON_GATEWAY_SECRET,payload}),redirect:'follow'});
  const result=await response.json();
  if(!response.ok||!result.ok)return json({ok:false,error:publicError,...(['event_changed','study_mismatch'].includes(result.code)?{code:result.code}:{})},['event_changed','study_mismatch'].includes(result.code)?409:502,request);
  if(!catalog)return json({ok:true},200,request);
  if(!Array.isArray(result.events))throw Error();
  const events=result.events.map(e=>{if(typeof e.id!=='string'||typeof e.name!=='string'||typeof e.price!=='number'||!Number.isFinite(e.price)||e.price<0)throw Error();return{id:e.id,name:e.name,price:e.price};});
  return json({ok:true,events},200,request);
 }catch{return json({ok:false,error:publicError},502,request);}
}
