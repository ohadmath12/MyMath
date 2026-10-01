'use strict';
const incoming=new URLSearchParams(location.hash.slice(1)).get('token');
if(incoming&&/^[a-f0-9]{64}$/.test(incoming))sessionStorage.setItem('lead-details-token',incoming);
const token=sessionStorage.getItem('lead-details-token');
history.replaceState(null,'',location.pathname+location.search);
const form=document.getElementById('lead-form'),button=document.getElementById('submit'),message=document.getElementById('message');
const key='lead-details-submission:'+token;
const submission=sessionStorage.getItem(key)||crypto.randomUUID();sessionStorage.setItem(key,submission);
let challenge='',widget,pending=false;
if(!token||!/^[a-f0-9]{64}$/.test(token)){form.hidden=true;message.textContent='כדי להשלים פרטים, פתחו את הקישור האישי שקיבלתם מאיתנו.';}
window.leadTurnstileReady=function(){
 if(form.hidden)return;
 if(!window.MYTHEMATIX_CONFIG?.turnstileSiteKey){message.textContent='הטופס אינו זמין כרגע. אנא פנו אלינו.';return;}
 widget=window.turnstile.render('#turnstile',{sitekey:window.MYTHEMATIX_CONFIG.turnstileSiteKey,action:'lead',callback:v=>{challenge=v;button.disabled=pending},'expired-callback':()=>{challenge='';button.disabled=true},'error-callback':()=>{challenge='';button.disabled=true;message.textContent='אימות הטופס נכשל. נסו לרענן.'}});
};
form.addEventListener('submit',async e=>{
 e.preventDefault();if(pending||!challenge||!form.reportValidity())return;
 const payload={...Object.fromEntries(new FormData(form)),lead_token:token,client_submission_id:submission,turnstile_token:challenge};
 pending=true;button.disabled=true;message.textContent='שומרים את הפרטים…';
 try{
  const endpoint=new URL(window.MYTHEMATIX_CONFIG.apiEndpoint);endpoint.pathname=endpoint.pathname.replace(/\/register$/,'/lead');
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)});
  const result=await response.json();if(!response.ok||!result.ok)throw new Error('not_saved');
  form.hidden=true;message.textContent='תודה, הפרטים נשמרו. נמשיך את התיאום איתכם באופן אישי.';
  sessionStorage.removeItem(key);sessionStorage.removeItem('lead-details-token');
 }catch{message.textContent='לא התקבל אישור שמירה. נסו שוב עם אותם פרטים. אם הקישור פג תוקף או כבר שימש למילוי, פנו אלינו לקבלת קישור חדש.';challenge='';window.turnstile.reset(widget);}
 finally{pending=false;button.disabled=!challenge;}
});
