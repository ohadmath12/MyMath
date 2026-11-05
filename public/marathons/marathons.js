(function(){
'use strict';
var form=document.getElementById('marathon-form'),button=document.getElementById('submit-btn'),error=document.getElementById('form-error'),success=document.getElementById('success-card');
var challenge='',widget,pending=false,submissionId='',submittedPayload='';
function uuid(){return typeof crypto.randomUUID==='function'?crypto.randomUUID():('10000000-1000-4000-8000-100000000000').replace(/[018]/g,function(c){return(c^crypto.getRandomValues(new Uint8Array(1))[0]&15>>c/4).toString(16);});}
function endpoint(){var u=new URL(window.MYTHEMATIX_CONFIG.apiEndpoint,location.href);u.pathname='/api/marathon';return u.href;}
function showError(text){error.textContent=text;error.hidden=!text;}
function updateButton(){button.disabled=pending||!challenge;}
window.marathonTurnstileReady=function(){
 var config=window.MYTHEMATIX_CONFIG;if(!config||!config.turnstileSiteKey){showError('הטופס אינו זמין כרגע. נסו שוב מאוחר יותר.');return;}
 widget=window.turnstile.render('#turnstile',{sitekey:config.turnstileSiteKey,action:'marathon',callback:function(t){challenge=t;updateButton();},'expired-callback':function(){challenge='';updateButton();},'error-callback':function(){challenge='';updateButton();showError('אימות הטופס נכשל. נסו לרענן את הדף.');}});
};
function schoolChanged(){var other=document.getElementById('school_name').value==='אחר';document.getElementById('school-other-field').hidden=!other;['school_other','school_city'].forEach(function(id){var input=document.getElementById(id);input.disabled=!other;input.required=other;});}
document.getElementById('school_name').addEventListener('change',schoolChanged);
function phone(value,optional){var p=String(value||'').replace(/[\s().-]/g,'').replace(/^(?:\+972|00972)/,'0');return optional&&!p?'':/^05\d{8}$/.test(p)?p:null;}
// A timeout releases the form, while an unchanged retry retains its receipt ID.
function submit(data){return new Promise(function(resolve,reject){
 var controller=typeof AbortController==='function'?new AbortController():null,finished=false;
 function finish(err,body){if(finished)return;finished=true;clearTimeout(timer);if(err)reject(err);else resolve(body);}
 var timer=setTimeout(function(){finish(Error('הקליטה מתעכבת. הפרטים נשמרו בטופס; נסו לשלוח שוב עם אותם פרטים.'));if(controller)controller.abort();},35000);
 fetch(endpoint(),{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(data),signal:controller?controller.signal:undefined}).then(function(r){return r.json().then(function(body){if(!r.ok||!body.ok)throw Error(r.status===429?'בוצעו כמה ניסיונות ברצף. המתינו דקה ונסו שוב.':'לא הצלחנו לאשר את הקליטה. נסו שוב עם אותם פרטים.');return body;});}).then(function(body){finish(null,body);}).catch(function(e){finish(e);});
});}
form.addEventListener('submit',function(e){
 e.preventDefault();if(pending||!challenge||!form.reportValidity())return;showError('');
 var data={};new FormData(form).forEach(function(v,k){data[k]=v;});delete data['cf-turnstile-response'];data.request_kind='interest';data.parent_phone=phone(data.parent_phone,false);data.student_phone=phone(data.student_phone,true);
 if(data.parent_phone===null||data.student_phone===null){showError('יש להזין מספר נייד ישראלי תקין, כולל קידומת.');return;}
 var canonical=JSON.stringify(data);if(canonical!==submittedPayload){submissionId=uuid();submittedPayload=canonical;}data.client_submission_id=submissionId;data.turnstile_token=challenge;
 pending=true;updateButton();button.textContent='שומרים את הבקשה…';
 submit(data).then(function(){form.hidden=true;success.hidden=false;success.focus();submissionId='';submittedPayload='';}).catch(function(e){showError(e.message||'לא הצלחנו לשמור כרגע. נסו שוב.');}).finally(function(){pending=false;challenge='';button.textContent='שליחת בקשת השתתפות';if(window.turnstile&&widget!==undefined)window.turnstile.reset(widget);updateButton();});
});
document.getElementById('another').addEventListener('click',function(){form.reset();schoolChanged();success.hidden=true;form.hidden=false;showError('');document.getElementById('student_first_name').focus();});
})();
