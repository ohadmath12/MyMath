(function(){
'use strict';
var form=document.getElementById('marathon-form'),button=document.getElementById('submit-btn'),error=document.getElementById('form-error'),eventSelect=document.getElementById('event_id'),summary=document.getElementById('event-summary'),status=document.getElementById('catalog-status'),reload=document.getElementById('reload-catalog'),success=document.getElementById('success-card');
var challenge='',widget,pending=false,events=[],submissionId='',submittedPayload='',catalogLoading=false;
function uuid(){return typeof crypto.randomUUID==='function'?crypto.randomUUID():('10000000-1000-4000-8000-100000000000').replace(/[018]/g,function(c){return(c^crypto.getRandomValues(new Uint8Array(1))[0]&15>>c/4).toString(16);});}
function endpoint(path){var u=new URL(window.MYTHEMATIX_CONFIG.apiEndpoint,location.href);u.pathname='/api/'+path;return u.href;}
function showError(text){error.textContent=text;error.hidden=!text;}
function selected(){return events.filter(function(e){return e.id===eventSelect.value;})[0];}
function updateButton(){button.disabled=pending||catalogLoading||!challenge||!selected();}
// Bound the entire request, including JSON parsing, so a stalled mobile connection can recover.
function requestCatalog(){
 return new Promise(function(resolve,reject){
  var controller=typeof AbortController==='function'?new AbortController():null,finished=false;
  function finish(err,data){if(finished)return;finished=true;clearTimeout(timer);if(err)reject(err);else resolve(data);}
  var timer=setTimeout(function(){finish(Error('catalog_timeout'));if(controller)controller.abort();},12000);
  Promise.resolve().then(function(){return fetch(endpoint('marathons'),{cache:'no-store',signal:controller?controller.signal:undefined});}).then(function(r){
   if(!r.ok){var err=Error('catalog_http');err.status=r.status;throw err;}return r.json();
  }).then(function(data){
   if(!data.ok||!Array.isArray(data.events)||!data.events.every(function(e){return e&&typeof e.id==='string'&&typeof e.name==='string'&&typeof e.price==='number'&&isFinite(e.price)&&e.price>=0;}))throw Error('catalog_invalid');
   finish(null,data);
  }).catch(function(err){finish(err);});
 });
}
function loadCatalog(){
 if(catalogLoading||pending)return;
 var wanted=eventSelect.value||new URLSearchParams(location.search).get('event');
 catalogLoading=true;events=[];reload.hidden=true;eventSelect.disabled=true;summary.hidden=true;summary.replaceChildren();eventSelect.replaceChildren(new Option('טוענים מרתונים…',''));updateButton();status.textContent='טוענים את המרתונים הפתוחים…';
 function attempt(number){
  return requestCatalog().catch(function(err){
   if(number<2&&(!err.status||err.status>=500)){
    status.textContent='הטעינה מתעכבת, מנסים שוב… אפשר להמשיך למלא את הפרטים.';
    return new Promise(function(resolve){setTimeout(resolve,1000);}).then(function(){return attempt(number+1);});
   }
   throw err;
  });
 }
 return attempt(1).then(function(data){
  events=data.events;eventSelect.replaceChildren(new Option(events.length?'בחירת מרתון':'אין כרגע מרתונים פתוחים',''));
  events.forEach(function(e){eventSelect.add(new Option(e.name,e.id));});
  eventSelect.disabled=!events.length;status.textContent=events.length?'בחרו את המרתון לפי המבחן, הכיתה ובית הספר. השיבוץ לקבוצה ייעשה בהמשך.':'כרגע אין מרתונים פתוחים להרשמה. כאן יופיעו המרתונים החדשים כשייפתחו.';
  if(wanted&&events.some(function(e){return e.id===wanted;}))eventSelect.value=wanted;
  eventSelect.dispatchEvent(new Event('change'));
 }).catch(function(err){
  eventSelect.replaceChildren(new Option('הרשימה לא נטענה — נסו שוב',''));
  status.textContent=err.status===429?'בוצעו כמה ניסיונות טעינה ברצף. המתינו דקה ולחצו על ״ניסיון נוסף״.':'לא הצלחנו לטעון את המרתונים. הפרטים שמילאתם נשארו בטופס. לחצו על ״ניסיון נוסף״; אם התקלה נמשכת, פתחו את הקישור ב־Chrome או ב־Safari.';
  reload.hidden=false;
 }).then(function(){catalogLoading=false;updateButton();});
}
window.addEventListener('online',function(){if(success.hidden&&!events.length)loadCatalog();});
window.marathonTurnstileReady=function(){
 var config=window.MYTHEMATIX_CONFIG;if(!config||!config.turnstileSiteKey){showError('הטופס אינו זמין כרגע. נסו שוב מאוחר יותר.');return;}
 widget=window.turnstile.render('#turnstile',{sitekey:config.turnstileSiteKey,action:'marathon',callback:function(t){challenge=t;updateButton();},'expired-callback':function(){challenge='';updateButton();},'error-callback':function(){challenge='';updateButton();showError('אימות הטופס נכשל. נסו לרענן את הדף.');}});
};
eventSelect.addEventListener('change',function(){var e=selected();summary.hidden=!e;summary.replaceChildren();if(e){var title=document.createElement('strong');title.textContent=e.name;summary.append(title);}updateButton();});
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
 fetch(endpoint('marathon'),{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(data)}).then(function(r){return r.json().then(function(body){if(!r.ok||!body.ok)throw Error(body.code==='study_mismatch'?'הכיתה או בית הספר אינם תואמים למרתון שבחרתם. בדקו את הבחירה והפרטים.':body.code==='event_changed'?'פרטי המרתון השתנו. רעננו את רשימת המרתונים ובחרו שוב.':'לא הצלחנו לאשר את הקליטה. נסו שוב עם אותם פרטים.');return body;});}).then(function(){form.hidden=true;success.hidden=false;success.focus();submissionId='';submittedPayload='';}).catch(function(e){showError(e.message||'לא הצלחנו לשמור כרגע. נסו שוב.');reload.hidden=false;}).finally(function(){pending=false;challenge='';button.textContent='שליחת הרשמה למרתון';if(window.turnstile&&widget!==undefined)window.turnstile.reset(widget);updateButton();});
});
document.getElementById('another').addEventListener('click',function(){form.reset();document.getElementById('school-other-field').hidden=true;document.getElementById('school_other').disabled=true;document.getElementById('school_other').required=false;success.hidden=true;form.hidden=false;showError('');loadCatalog();eventSelect.focus();});reload.addEventListener('click',loadCatalog);loadCatalog();
})();
