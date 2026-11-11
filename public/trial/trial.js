'use strict';
let challenge='', widget, pending=false;
let submissionId=sessionStorage.getItem('mythematix-trial-submission') || crypto.randomUUID();
sessionStorage.setItem('mythematix-trial-submission',submissionId);
const form=document.getElementById('trial-form'), button=document.getElementById('submit'), message=document.getElementById('message');
window.trialTurnstileReady=function(){
 const config=window.MYTHEMATIX_CONFIG;
 if(!config?.turnstileSiteKey){message.textContent='הטופס אינו זמין כרגע. אנא פנו אלינו לתיאום.';return}
 widget=window.turnstile.render('#turnstile',{sitekey:config.turnstileSiteKey,action:'trial',callback:token=>{challenge=token;button.disabled=pending},'expired-callback':()=>{challenge='';button.disabled=true},'error-callback':()=>{challenge='';button.disabled=true;message.textContent='אימות הטופס נכשל. נסו לרענן את הדף.'}});
};
form.addEventListener('submit',async event=>{
 event.preventDefault();if(pending||!challenge||!form.reportValidity())return;
 const payload=Object.fromEntries(new FormData(form));
 let phone=payload.parent_phone.replace(/[\s()+-]/g,'');if(phone.startsWith('972'))phone='0'+phone.slice(3);
 if(!/^05\d{8}$/.test(phone)){message.textContent='יש להזין מספר נייד ישראלי תקין של ההורה.';return}
 payload.parent_phone=phone;payload.client_submission_id=submissionId;payload.turnstile_token=challenge;
 pending=true;button.disabled=true;message.textContent='שומרים את הפרטים…';
 try{
  const endpoint=new URL(window.MYTHEMATIX_CONFIG?.apiEndpoint||'../api/register',location.href);endpoint.pathname=endpoint.pathname.replace(/\/register$/,'/trial');
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)});
  const result=await response.json();if(!response.ok||!result.ok)throw new Error('failed');
  form.hidden=true;showTrialPayment();sessionStorage.removeItem('mythematix-trial-submission');message.textContent='הפרטים נקלטו. ניצור איתכם קשר לתיאום שיעור הניסיון.\nהשיבוץ יושלם לאחר אישור המועד.';
 }catch{message.textContent='לא הצלחנו לאשר את הקליטה. נסו שוב עם אותם פרטים או פנו אלינו. אין צורך למלא בקשה חדשה.';challenge='';window.turnstile.reset(widget)}finally{pending=false;button.disabled=!challenge}
});

// Only a configured, provider-hosted checkout is shown after successful intake.
// Opening checkout never marks a trial as paid.
function showTrialPayment() {
 const configured = window.MYTHEMATIX_CONFIG?.trialPaymentUrl;
 if (!configured) return;
 let url; try { url = new URL(configured); } catch { return; }
 if (url.protocol !== 'https:' || !['grow.link','meshulam.co.il','grow.business'].some(host => url.hostname === host || url.hostname.endsWith('.'+host))) return;
 const container=document.getElementById('trial-payment');
 const note=document.createElement('p');note.textContent='עלות שיעור הניסיון: 160 ₪. התשלום נפרד מההרשמה למסגרת קבועה. בעמוד התשלום הזינו את אותו טלפון הורה ואת שם התלמיד שמילאתם כאן. אם כבר שילמתם, אין לשלם שוב.';
 const link=document.createElement('a');link.href=url.href;link.textContent='לתשלום מאובטח ב־Grow · 160 ₪';link.target='_blank';link.rel='noopener noreferrer';
 container.replaceChildren(note,link);container.hidden=false;
}
