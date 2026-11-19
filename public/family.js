(function(){
 'use strict';
 var token=new URLSearchParams(location.hash.slice(1)).get('family'),current=-1,data=null,drafts=[false,false],saved=[false,false],frames=[],confirmation=null,finishing=false;
 var status=document.getElementById('family-status'),initialFrame=document.getElementById('child-form'),next=document.getElementById('family-next'),complete=document.getElementById('family-complete'),payment=document.getElementById('family-payment'),childStep=document.getElementById('child-step');
 function text(parent,tag,value){var n=document.createElement(tag);n.textContent=value;parent.appendChild(n);return n;}
 function showChild(i){if(!frames[0])initialFrame.hidden=true;current=i;payment.hidden=true;childStep.hidden=false;next.hidden=true;frames.forEach(function(f,j){if(f)f.hidden=j!==i;});document.getElementById('child-title').textContent='שלב '+(i+1)+' מתוך 3 — '+data.children[i].name;if(!frames[i]){var f=i===0?initialFrame:initialFrame.cloneNode(false);f.id='child-form-'+i;f.title='פרטי '+data.children[i].name+' וחתימת ההורה';f.hidden=false;f.src='./index.html?family_embed=1&release=20261119-grow-confirmation#lead='+encodeURIComponent(data.children[i].token);if(i!==0)initialFrame.parentNode.insertBefore(f,next);frames[i]=f;}}
 function show(){var i=drafts.indexOf(false);if(i<0){current=2;frames.forEach(function(f){if(f)f.hidden=true;});childStep.hidden=true;payment.hidden=false;confirmation.check(false);return;}showChild(i);}
 function finalizeNext(){var i=saved.indexOf(false);if(i<0){finishing=false;payment.hidden=true;childStep.hidden=true;status.textContent='ההרשמה המשפחתית הושלמה. התשלום אושר ב־Grow; המרכז ישלים את הבדיקה והשיוך במערכת.';status.focus();return;}showChild(i);status.textContent='משלימים את הרשמת '+data.children[i].name+'…';frames[i].contentWindow.postMessage({type:'mythematix-family-finalize',token:data.children[i].token},location.origin);}
 next.addEventListener('click',show);
 window.addEventListener('message',function(event){
  if(event.origin!==location.origin||!event.data||!data)return;var i=frames.findIndex(function(f){return f&&event.source===f.contentWindow;});if(i<0)return;
  if(event.data.type==='mythematix-family-height'&&Number.isFinite(event.data.height)){frames[i].style.height=Math.max(600,Math.min(12000,event.data.height))+'px';return;}
  if(event.data.token!==data.children[i].token)return;
  if(event.data.type==='mythematix-family-child-draft'&&!finishing){drafts[i]=true;next.hidden=false;next.textContent=i===0?'להמשך פרטי '+data.children[1].name:'לתשלום והשלמת ההרשמה';next.focus();}
  if(event.data.type==='mythematix-family-child-saved'){saved[i]=true;drafts[i]=true;if(finishing)finalizeNext();else show();}
  if(event.data.type==='mythematix-family-child-error'){finishing=false;status.textContent='ההרשמה טרם הושלמה. הפרטים נשארו בטופס — נסו שוב. אין לשלם שוב.';showChild(i);}
 });
 if(!token||! /^[a-f0-9]{64}$/.test(token)){status.textContent='הקישור אינו תקין. בקשו מהמרכז קישור משפחתי אישי.';return;}
 complete.disabled=true;
 complete.addEventListener('click',async function(){if(finishing||drafts.some(function(v){return !v;}))return;var state=await confirmation.check(false);if(!state.paid)return;finishing=true;complete.disabled=true;finalizeNext();});
 var config=window.ENROLLMENT_PAYMENT_CONFIG;
 fetch(config.url+'/rest/v1/rpc/family_registration_public',{method:'POST',headers:{'Content-Type':'application/json',apikey:config.key},body:JSON.stringify({token:token})}).then(function(r){if(!r.ok)throw Error();return r.json();}).then(function(r){
  if(!r.ok||!Array.isArray(r.children)||r.children.length!==2||r.monthly_agorot!==120000||!Number.isInteger(r.initial_agorot)||r.initial_agorot<=0||!/^https:\/\/pay\.grow\.link\/[A-Za-z0-9_~%./?=&+-]+$/.test(r.payment_url)||!/^\d{4}-\d{2}-10$/.test(r.recurring_starts_on)||r.children.some(function(c){return typeof c.name!=='string'||! /^[a-f0-9]{64}$/.test(c.token)||!Number.isInteger(c.lessons)||c.lessons<1;})||r.children.reduce(function(n,c){return n+c.lessons*15000},0)!==r.initial_agorot)throw Error();
  data=r;saved=r.children.map(function(c){return c.completed===true;});drafts=saved.slice();
  var box=document.getElementById('family-terms');text(box,'h2',r.children.map(function(c){return c.name;}).join(' + '));r.children.forEach(function(c){text(box,'p',c.name+': '+c.lessons+' שיעורים × 150 ₪ = '+(c.lessons*150)+' ₪');});text(box,'p','החיוב הראשון לשניהם: '+r.initial_agorot/100+' ₪. שיעורי הניסיון נפרדים.');text(box,'p','החל מ־'+r.recurring_starts_on.split('-').reverse().join('/')+': 600 ₪ לכל ילד — 1,200 ₪ לחודש לשניהם.');box.hidden=false;status.textContent='';
  var pay=document.getElementById('family-pay'),check=document.getElementById('family-check-payment'),paymentStatus=document.getElementById('family-payment-status');pay.href=r.payment_url;
  confirmation=window.GrowConfirmation.create('family',token,function(state,label){paymentStatus.textContent=label;check.disabled=state.state==='checking';check.hidden=state.paid;pay.hidden=state.paid;complete.disabled=!state.paid||finishing;});
  check.addEventListener('click',function(){confirmation.check(true);});var opened=false;pay.addEventListener('click',function(){opened=true;});window.addEventListener('focus',function(){if(opened){opened=false;confirmation.check(true);}});
  show();
 }).catch(function(){status.textContent='לא ניתן לטעון את ההרשמה המשפחתית. הקישור עשוי לפוג או להשתנות; פנו למרכז לפני מילוי או תשלום.';});
})();
