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
// Bound both the request and response body: a stalled connection must not lock
// the form forever. A timeout is NOT evidence that the server did not save.
async function saveInquiry(endpoint, payload) {
 const controller=new AbortController();
 let timer;
 try {
  return await Promise.race([
   (async()=>{
    const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload),signal:controller.signal});
    const result=await response.json();
    if(!response.ok||!result.ok)throw new Error('not_saved');
    return result;
   })(),
   new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('save_timeout'));},30000);})
  ]);
 } finally {clearTimeout(timer);}
}

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
  await saveInquiry(endpoint,payload);
  form.hidden=true;message.textContent='תודה, הפרטים נשמרו. נמשיך את התיאום איתכם באופן אישי.';
  sessionStorage.removeItem(key);
 }catch{
  message.textContent='לא התקבל אישור שמירה בזמן. הפרטים שהזנתם נשארו בטופס. לאחר אימות האבטחה אפשר ללחוץ שוב על שמירת הפרטים. אם התקלה חוזרת, פנו לאוהד וציינו את קוד הבדיקה: '+submission.slice(0,8);
  // Reuse the submission ID when the outcome is uncertain; never create a
  // second identity merely because the response was lost.
  challenge='';
  if(window.turnstile&&widget!==undefined)window.turnstile.reset(widget);
 }
 finally{pending=false;button.disabled=!challenge;}
});
