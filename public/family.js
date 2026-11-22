(function(){
 'use strict';
 var token=new URLSearchParams(location.hash.slice(1)).get('family'),current=-1,data=null,drafts=[false,false],saved=[false,false],frames=[],checkoutReceipts=[null,null],confirmation=null,finishing=false;
 var status=document.getElementById('family-status'),initialFrame=document.getElementById('child-form'),next=document.getElementById('family-next'),complete=document.getElementById('family-complete'),payment=document.getElementById('family-payment'),childStep=document.getElementById('child-step');
 function text(parent,tag,value){var n=document.createElement(tag);n.textContent=value;parent.appendChild(n);return n;}
 function showChild(i){if(!frames[0])initialFrame.hidden=true;current=i;payment.hidden=true;childStep.hidden=false;next.hidden=true;frames.forEach(function(f,j){if(f)f.hidden=j!==i;});document.getElementById('child-title').textContent='שלב '+(i+1)+' מתוך 3 — '+data.children[i].name;if(!frames[i]){var f=i===0?initialFrame:initialFrame.cloneNode(false);f.id='child-form-'+i;f.title='פרטי '+data.children[i].name+' וחתימת ההורה';f.hidden=false;f.src='./index.html?family_embed=1&family_token='+encodeURIComponent(token)+'&release=20261120-unified#lead='+encodeURIComponent(data.children[i].token);if(i!==0)initialFrame.parentNode.insertBefore(f,next);frames[i]=f;}}
 function show(){var i=drafts.indexOf(false);if(i<0){current=2;frames.forEach(function(f){if(f)f.hidden=true;});childStep.hidden=true;payment.hidden=false;complete.disabled=checkoutReceipts.some(function(v,i){return !v&&!saved[i];});return;}showChild(i);}
 function finalizeNext(){var i=saved.indexOf(false);if(i<0){finishing=false;payment.hidden=true;childStep.hidden=true;status.textContent='ההרשמה המשפחתית הושלמה. התשלום אושר ב־Grow; המרכז ישלים את הבדיקה והשיוך במערכת.';status.focus();return;}showChild(i);status.textContent='משלימים את הרשמת '+data.children[i].name+'…';frames[i].contentWindow.postMessage({type:'mythematix-family-finalize',token:data.children[i].token},location.origin);}
 next.addEventListener('click',show);
 window.addEventListener('message',function(event){
  if(event.origin!==location.origin||!event.data||!data)return;var i=frames.findIndex(function(f){return f&&event.source===f.contentWindow;});if(i<0)return;
  if(event.data.type==='mythematix-family-height'&&Number.isFinite(event.data.height)){frames[i].style.height=Math.max(600,Math.min(12000,event.data.height))+'px';return;}
  if(event.data.token!==data.children[i].token)return;
  if(event.data.type==='mythematix-family-child-draft'&&!finishing&&/^[a-f0-9]{64}$/.test(event.data.checkout_token||'')){checkoutReceipts[i]=event.data.checkout_token;drafts[i]=true;next.hidden=false;next.textContent=i===0?'להמשך פרטי '+data.children[1].name:'לתשלום והשלמת ההרשמה';next.focus();}
  if(event.data.type==='mythematix-family-child-saved'){saved[i]=true;drafts[i]=true;if(finishing)finalizeNext();else show();}
  if(event.data.type==='mythematix-family-child-error'){finishing=false;status.textContent='ההרשמה טרם הושלמה. הפרטים נשארו בטופס — נסו שוב. אין לשלם שוב.';showChild(i);}
 });
 if(!token||! /^[a-f0-9]{64}$/.test(token)){status.textContent='הקישור אינו תקין. בקשו מהמרכז קישור משפחתי אישי.';return;}
 complete.disabled=true;
 complete.addEventListener('click',async function(){if(finishing||checkoutReceipts.some(function(v,i){return !v&&!saved[i];}))return;finishing=true;complete.disabled=true;var payWindow=window.open('about:blank','mythematix-payment');if(payWindow)payWindow.opener=null;try{var r=await window.CheckoutFlow.api('family-checkout',{family_token:token,checkout_tokens:checkoutReceipts.filter(Boolean)});window.CheckoutFlow.start(checkoutReceipts.filter(Boolean),r.payment_url);if(payWindow&&r.payment_url)payWindow.location.href=r.payment_url;else if(payWindow)payWindow.close();}catch(e){if(payWindow)payWindow.close();finishing=false;complete.disabled=false;status.textContent='לא הצלחנו להכין את המעבר לתשלום. הפרטים שמורים; נסו שוב.';}});

 var config=window.ENROLLMENT_PAYMENT_CONFIG;
 fetch(config.url+'/rest/v1/rpc/family_registration_public',{method:'POST',headers:{'Content-Type':'application/json',apikey:config.key},body:JSON.stringify({token:token})}).then(function(r){if(!r.ok)throw Error();return r.json();}).then(async function(r){
  if(!r.ok||!Array.isArray(r.children)||r.children.length!==2||r.monthly_agorot!==120000||!Number.isInteger(r.initial_agorot)||r.initial_agorot<=0||!/^https:\/\/pay\.grow\.link\/[A-Za-z0-9_~%./?=&+-]+$/.test(r.payment_url)||!/^\d{4}-\d{2}-10$/.test(r.recurring_starts_on)||r.children.some(function(c){return typeof c.name!=='string'||! /^[a-f0-9]{64}$/.test(c.token)||!Number.isInteger(c.lessons)||c.lessons<1;})||r.children.reduce(function(n,c){return n+c.lessons*15000},0)!==r.initial_agorot)throw Error();
  data=r;saved=r.children.map(function(c){return c.completed===true;});drafts=saved.slice();
  var box=document.getElementById('family-terms');text(box,'h3','יתרת חודש — '+(r.initial_agorot/100).toLocaleString('he-IL')+' ₪');text(box,'p','מהחודש הבא — '+(r.monthly_agorot/100).toLocaleString('he-IL')+' ₪ בחודש לשני הילדים בהוראת קבע, החל מ־'+r.recurring_starts_on.split('-').reverse().join('/')+'.');box.hidden=false;status.textContent='';
  var pay=document.getElementById('family-pay'),check=document.getElementById('family-check-payment'),paymentStatus=document.getElementById('family-payment-status');pay.href=r.payment_url;
  var resume=await window.CheckoutFlow.api('checkout-resume',{kind:'family',token:token});
  resume.checkouts.forEach(function(c){var i=data.children.findIndex(function(ch){return ch.token===c.child_token;});if(i>=0){checkoutReceipts[i]=c.checkout_token;drafts[i]=true;}});
  if(saved.every(Boolean)&&resume.checkouts.length===0){
   childStep.hidden=true;payment.hidden=false;complete.hidden=true;pay.hidden=false;check.hidden=true;
   confirmation=window.GrowConfirmation.create('family',token,function(state,label){paymentStatus.textContent=label;pay.hidden=state.paid;if(state.paid){payment.hidden=true;status.textContent='התשלום התקבל וההרשמה המשפחתית הושלמה. תודה!';}});pay.textContent='לתשלום ולהשלמת ההרשמה';confirmation.watchReturn();return;
  }
  if(resume.checkouts.length&&resume.checkouts.every(function(c){return c.armed;})&&data.children.every(function(c,i){return saved[i]||!!checkoutReceipts[i];})){window.CheckoutFlow.start(resume.checkouts,resume.checkouts[0].payment_url);return;}
  if(resume.complete_set&&resume.checkouts.every(function(c){return c.armed;})){window.CheckoutFlow.start(resume.checkouts,resume.checkouts[0].payment_url);return;}
  show();
 }).catch(function(){status.textContent='לא ניתן לטעון את ההרשמה המשפחתית. הקישור עשוי לפוג או להשתנות; פנו למרכז לפני מילוי או תשלום.';});
})();
