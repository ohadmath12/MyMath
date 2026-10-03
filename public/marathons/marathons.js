(function(){
'use strict';
var form=document.getElementById('marathon-form'),button=document.getElementById('submit-btn'),error=document.getElementById('form-error'),eventSelect=document.getElementById('event_id'),summary=document.getElementById('event-summary'),status=document.getElementById('catalog-status'),reload=document.getElementById('reload-catalog'),success=document.getElementById('success-card');
var challenge='',widget,pending=false,events=[],submissionId='',submittedPayload='';
function uuid(){return typeof crypto.randomUUID==='function'?crypto.randomUUID():('10000000-1000-4000-8000-100000000000').replace(/[018]/g,function(c){return(c^crypto.getRandomValues(new Uint8Array(1))[0]&15>>c/4).toString(16);});}
function endpoint(path){var u=new URL(window.MYTHEMATIX_CONFIG.apiEndpoint,location.href);u.pathname='/api/'+path;return u.href;}
function showError(text){error.textContent=text;error.hidden=!text;}
function selected(){return events.filter(function(e){return e.id===eventSelect.value;})[0];}
function updateButton(){button.disabled=pending||!challenge||!selected();}
function loadCatalog(){
 reload.hidden=true;eventSelect.disabled=true;button.disabled=true;status.textContent='טוענים את המרתונים הפתוחים…';
 fetch(endpoint('marathons'),{cache:'no-store'}).then(function(r){if(!r.ok)throw Error();return r.json();}).then(function(data){
  if(!data.ok||!Array.isArray(data.events))throw Error();events=data.events;eventSelect.replaceChildren(new Option('בחירת מרתון',''));
  events.forEach(function(e){eventSelect.add(new Option(e.name+' · '+e.price+' ₪',e.id));});
  eventSelect.disabled=!events.length;status.textContent=events.length?'בחרו את המרתון לפי המבחן, הכיתה ובית הספר. השיבוץ לקבוצה ייעשה בהמשך.':'כרגע אין מרתונים פתוחים להרשמה. כאן יופיעו המרתונים החדשים כשייפתחו.';
  var wanted=new URLSearchParams(location.search).get('event');if(wanted&&events.some(function(e){return e.id===wanted;}))eventSelect.value=wanted;
  eventSelect.dispatchEvent(new Event('change'));updateButton();
 }).catch(function(){status.textContent='לא הצלחנו לטעון את המרתונים כרגע.';reload.hidden=false;});
}
window.marathonTurnstileReady=function(){
 var config=window.MYTHEMATIX_CONFIG;if(!config||!config.turnstileSiteKey){showError('הטופס אינו זמין כרגע. נסו שוב מאוחר יותר.');return;}
 widget=window.turnstile.render('#turnstile',{sitekey:config.turnstileSiteKey,action:'marathon',callback:function(t){challenge=t;updateButton();},'expired-callback':function(){challenge='';updateButton();},'error-callback':function(){challenge='';updateButton();showError('אימות הטופס נכשל. נסו לרענן את הדף.');}});
};
eventSelect.addEventListener('change',function(){var e=selected();summary.hidden=!e;summary.replaceChildren();if(e){var title=document.createElement('strong');title.textContent=e.name;var detail=document.createElement('div');detail.textContent='מחיר לתלמיד/ה: '+e.price+' ₪';summary.append(title,detail);}updateButton();});
document.getElementById('school_name').addEventListener('change',function(){var other=this.value==='אחר',input=document.getElementById('school_other');document.getElementById('school-other-field').hidden=!other;input.disabled=!other;input.required=other;if(other)input.focus();});
function phone(value,optional){var p=String(value||'').replace(/[\s().-]/g,'').replace(/^(?:\+972|00972)/,'0');return optional&&!p?'':/^05\d{8}$/.test(p)?p:null;}
form.addEventListener('submit',function(e){
 e.preventDefault();if(pending||!challenge||!selected()||!form.reportValidity())return;showError('');
 var data={};new FormData(form).forEach(function(v,k){data[k]=v;});data.parent_phone=phone(data.parent_phone,false);data.student_phone=phone(data.student_phone,true);
 if(data.parent_phone===null||data.student_phone===null){showError('יש להזין מספר נייד ישראלי תקין, כולל קידומת.');return;}
 data.quoted_price=selected().price;var canonical=JSON.stringify(data);
 // A retry keeps its identifier. Editing details creates a fresh request; the server also checks student/event duplicates.
 if(canonical!==submittedPayload){submissionId=uuid();submittedPayload=canonical;}data.client_submission_id=submissionId;data.turnstile_token=challenge;
 pending=true;updateButton();button.textContent='שומרים את ההרשמה…';
 fetch(endpoint('marathon'),{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(data)}).then(function(r){return r.json().then(function(body){if(!r.ok||!body.ok)throw Error(body.code==='study_mismatch'?'הכיתה או בית הספר אינם תואמים למרתון שבחרתם. בדקו את הבחירה והפרטים.':body.code==='event_changed'?'המועד או המחיר השתנו. רעננו את רשימת המרתונים ובחרו שוב.':'לא הצלחנו לאשר את הקליטה. נסו שוב עם אותם פרטים.');return body;});}).then(function(){form.hidden=true;success.hidden=false;success.focus();submissionId='';submittedPayload='';}).catch(function(e){showError(e.message||'לא הצלחנו לשמור כרגע. נסו שוב.');reload.hidden=false;}).finally(function(){pending=false;challenge='';button.textContent='שליחת הרשמה למרתון';if(window.turnstile&&widget!==undefined)window.turnstile.reset(widget);updateButton();});
});
document.getElementById('another').addEventListener('click',function(){form.reset();document.getElementById('school-other-field').hidden=true;document.getElementById('school_other').disabled=true;document.getElementById('school_other').required=false;success.hidden=true;form.hidden=false;showError('');loadCatalog();eventSelect.focus();});reload.addEventListener('click',loadCatalog);loadCatalog();
})();
