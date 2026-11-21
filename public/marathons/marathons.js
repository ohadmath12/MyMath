(function(){
'use strict';
var form=document.getElementById('marathon-form'),button=document.getElementById('submit-btn'),error=document.getElementById('form-error'),success=document.getElementById('success-card');
var invitationToken=new URLSearchParams(location.hash.slice(1)).get('invite')||'';
var registrationEventId=new URLSearchParams(location.hash.slice(1)).get('event')||'';
var challenge='',widget,pending=false,submissionId='',submittedPayload='';
if(window.FormPaymentStep)window.FormPaymentStep.configure(true);
function uuid(){return typeof crypto.randomUUID==='function'?crypto.randomUUID():('10000000-1000-4000-8000-100000000000').replace(/[018]/g,function(c){return(c^crypto.getRandomValues(new Uint8Array(1))[0]&15>>c/4).toString(16);});}
function endpoint(){var u=new URL(window.MYTHEMATIX_CONFIG.apiEndpoint,location.href);u.pathname='/api/marathon';return u.href;}
function showError(text){error.textContent=text;error.hidden=!text;}
function updateButton(){button.disabled=pending||!challenge;}
window.marathonTurnstileReady=function(){
 var config=window.MYTHEMATIX_CONFIG;if(!config||!config.turnstileSiteKey){showError('הטופס אינו זמין כרגע. נסו שוב מאוחר יותר.');return;}
 widget=window.turnstile.render('#turnstile',{sitekey:config.turnstileSiteKey,action:'marathon',callback:function(t){challenge=t;updateButton();},'expired-callback':function(){challenge='';updateButton();},'error-callback':function(){challenge='';updateButton();showError('אימות הטופס נכשל. נסו לרענן את הדף.');}});
};
function schoolChanged(){var other=document.getElementById('school_name').value==='אחר';document.getElementById('school-other-field').hidden=!other;var input=document.getElementById('school_other');input.disabled=!other;input.required=other;}
document.getElementById('school_name').addEventListener('change',schoolChanged);
function showPayment(body){
 // Reuse the same checkout panel safely when registering another child.
 var panelRoot=document.getElementById('marathon-payment');
 if(panelRoot.querySelectorAll)panelRoot.querySelectorAll('.form-progress, h2, .payment-step-saved').forEach(function(node){node.remove();});
 if(success.children)Array.from(success.children).forEach(function(child){child.hidden=false;});
 var panel=document.getElementById('marathon-payment'),link=document.getElementById('payment-link'),heading=document.getElementById('payment-heading'),message=document.getElementById('payment-message');
 panel.hidden=false;link.hidden=true;link.removeAttribute('href');heading.textContent=body.eventTitle||'המשך ההרשמה';
 message.textContent=body.paymentStatus==='cash'?'סוכם תשלום במזומן בסך '+body.amount+' ₪. ניצור קשר לתיאום. התשלום טרם סומן כתקבול.':body.paymentStatus==='recorded'?'כבר תועד תשלום עבור הרשמה זו. לבירור יתרה או שיבוץ פנו אלינו; אין לשלם שוב.':body.paymentStatus==='review'?'הבקשה נשמרה לבדיקה, וייתכן שקיימת הרשמה קודמת. נחזור אליכם להמשך; אין צורך לשלוח שוב או לשלם שוב.':'הפרטים נשמרו. נחזור אליכם עם פרטי התשלום והתיאום; אין צורך למלא שוב את הטופס.';
 var p=body.payment;if(body.paymentStatus!=='ready'||!p||typeof p.amount!=='number'||!Number.isFinite(p.amount)||p.amount<=0||p.amount>10000)return;
 try{var u=new URL(p.url);if(u.protocol!=='https:'||u.username||u.password||u.port||!['grow.link','meshulam.co.il','grow.business'].some(function(h){return u.hostname===h||u.hostname.endsWith('.'+h);}))return;}catch(e){return;}
 heading.textContent=(body.eventTitle?body.eventTitle+' — ':'')+'תשלום חד־פעמי: '+p.amount.toLocaleString('he-IL')+' ₪';message.textContent='ב־Grow מלאו את אותו טלפון הורה ואת שם התלמיד/ה, כדי שנוכל להתאים את התשלום להרשמה.';link.href=u.href;link.hidden=false;
}
function phone(value,optional){var p=String(value||'').replace(/[\s().-]/g,'').replace(/^(?:\+972|00972)/,'0');return optional&&!p?'':/^05\d{8}$/.test(p)?p:null;}
// A timeout releases the form, while an unchanged retry retains its receipt ID.
function submit(data){return new Promise(function(resolve,reject){
 var controller=typeof AbortController==='function'?new AbortController():null,finished=false;
 function finish(err,body){if(finished)return;finished=true;clearTimeout(timer);if(err)reject(err);else resolve(body);}
 var timer=setTimeout(function(){finish(Error('הקליטה מתעכבת. הפרטים נשמרו בטופס; נסו לשלוח שוב עם אותם פרטים.'));if(controller)controller.abort();},35000);
 fetch(endpoint(),{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(data),signal:controller?controller.signal:undefined}).then(function(r){return r.json().then(function(body){if(!r.ok||!body.ok)throw Error(body.code==='invalid_invitation'?'הקישור האישי אינו תקף או בוטל. פנו אלינו לקבלת קישור חדש.':body.code==='invitation_identity'?'יש למלא את שם התלמיד וטלפון ההורה שעבורם נוצר הקישור.':r.status===429?'בוצעו כמה ניסיונות ברצף. המתינו דקה ונסו שוב.':'לא הצלחנו לאשר את הקליטה. נסו שוב עם אותם פרטים.');return body;});}).then(function(body){finish(null,body);}).catch(function(e){finish(e);});
});}
form.addEventListener('submit',function(e){
 e.preventDefault();if(pending||!challenge||!form.reportValidity())return;showError('');
 var data={};new FormData(form).forEach(function(v,k){data[k]=v;});delete data['cf-turnstile-response'];data.request_kind='interest';data.form_version=2;if(invitationToken)data.invitation_token=invitationToken;if(registrationEventId)data.registration_event_id=registrationEventId;data.parent_phone=phone(data.parent_phone,false);
 if(data.parent_phone===null||data.student_phone===null){showError('יש להזין מספר נייד ישראלי תקין, כולל קידומת.');return;}
 var canonical=JSON.stringify(data);if(canonical!==submittedPayload){submissionId=uuid();submittedPayload=canonical;}data.client_submission_id=submissionId;data.turnstile_token=challenge;
 pending=true;updateButton();button.textContent='שומרים את הבקשה…';
 submit(data).then(function(body){showPayment(body);form.hidden=true;success.hidden=false;success.focus();if(window.FormPaymentStep){window.FormPaymentStep.configure(!document.getElementById('payment-link').hidden);window.FormPaymentStep.show(document.getElementById('marathon-payment'));var another=document.getElementById('another');another.hidden=!!invitationToken;var notice=document.getElementById('payment-disclaimer');if(notice)notice.hidden=false;}submissionId='';submittedPayload='';}).catch(function(e){showError(e.message||'לא הצלחנו לשמור כרגע. נסו שוב.');}).finally(function(){pending=false;challenge='';button.textContent='שמירת פרטים והמשך לתשלום';if(window.turnstile&&widget!==undefined)window.turnstile.reset(widget);updateButton();});
});
if(invitationToken)document.getElementById('another').hidden=true;
document.getElementById('another').addEventListener('click',function(){form.reset();schoolChanged();success.hidden=true;form.hidden=false;showError('');document.getElementById('parent_name').focus();});
})();
