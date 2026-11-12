'use strict';
const form=document.getElementById('lead-form'),button=document.getElementById('submit'),message=document.getElementById('message');
const schoolSelect=document.getElementById('school_name'),schoolOther=document.getElementById('school_other'),schoolOtherField=document.getElementById('school-other-field');
function updateSchoolChoice(){const other=schoolSelect.value==='__other__';schoolOtherField.hidden=!other;schoolOther.disabled=!other;schoolOther.required=other;schoolOther.setCustomValidity('');}
schoolSelect.addEventListener('change',updateSchoolChoice);
schoolOther.addEventListener('input',()=>schoolOther.setCustomValidity(''));
updateSchoolChoice();
const key='public-lead-submission';
const submission=sessionStorage.getItem(key)||crypto.randomUUID();sessionStorage.setItem(key,submission);
let challenge='',widget,pending=false;
window.leadTurnstileReady=function(){
 if(form.hidden)return;
 if(!window.MYTHEMATIX_CONFIG?.turnstileSiteKey){message.textContent='הטופס אינו זמין כרגע. אנא פנו אלינו.';return;}
 widget=window.turnstile.render('#turnstile',{sitekey:window.MYTHEMATIX_CONFIG.turnstileSiteKey,action:'lead',callback:v=>{challenge=v;button.disabled=pending},'expired-callback':()=>{challenge='';button.disabled=true},'error-callback':()=>{challenge='';button.disabled=true;message.textContent='אימות הטופס נכשל. נסו לרענן.'}});
};
form.addEventListener('submit',async e=>{
 e.preventDefault();if(pending||!challenge||!form.reportValidity())return;
 const payload={...Object.fromEntries(new FormData(form)),client_submission_id:submission,turnstile_token:challenge};
 if(payload.school_name==='__other__'){payload.school_name=schoolOther.value.trim();if(!payload.school_name){schoolOther.setCustomValidity('יש להזין את שם בית הספר');schoolOther.reportValidity();return;}}
 pending=true;button.disabled=true;message.textContent='שומרים את הפרטים…';
 try{
  const endpoint=new URL(window.MYTHEMATIX_CONFIG.apiEndpoint);endpoint.pathname=endpoint.pathname.replace(/\/register$/,'/lead-public');
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)});
  const result=await response.json();if(!response.ok||!result.ok)throw new Error('not_saved');
  form.hidden=true;message.textContent='תודה, הפרטים נשמרו. נמשיך את התיאום איתכם באופן אישי.';
  sessionStorage.removeItem(key);
 }catch{message.textContent='לא התקבל אישור שמירה. נסו שוב עם אותם פרטים. אם התקלה נמשכת, פנו אלינו.';challenge='';window.turnstile.reset(widget);}
 finally{pending=false;button.disabled=!challenge;}
});
