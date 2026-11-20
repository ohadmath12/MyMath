(function(){
 'use strict';
 var labels={pending:'עדיין לא התקבל אישור תשלום מ־Grow. אם שילמתם, לחצו על בדיקת התשלום — אין לשלם שוב.',checking:'בודקים את אישור התשלום מול Grow…',paid:'התשלום התקבל בהצלחה. נותר ללחוץ על ״השלמת הרשמה״ כדי לשלוח את הטופס. אין לשלם שוב.',cash:'מסלול מזומן כפי שסוכם עם המרכז.',unavailable:'לא ניתן לאמת כרגע את התשלום. אם שילמתם, אין לשלם שוב. נסו בדיקה נוספת או פנו למרכז.',try_later:'בוצעו מספר בדיקות. נסו שוב בהמשך או פנו למרכז; אין לשלם שוב.'};
 window.GrowConfirmation={create:function(kind,token,onChange){
  var current={state:'checking',can_complete:false,paid:false},inflight=null;
  function notify(r){current=r;onChange(r,labels[r.state]||labels.unavailable);return r;}
  async function read(refresh){var c=window.ENROLLMENT_PAYMENT_CONFIG;var r=await fetch(c.url+'/rest/v1/rpc/registration_grow_status',{method:'POST',headers:{'Content-Type':'application/json',apikey:c.key},body:JSON.stringify({kind:kind,token:token,refresh:refresh})});if(!r.ok)throw Error();var d=await r.json();if(!d.ok)throw Error();return d;}
  function check(refresh){if(inflight)return inflight;inflight=(async function(){try{var d=await read(refresh===true);notify(d);for(var i=0;d.state==='checking'&&i<6;i++){await new Promise(function(resolve){setTimeout(resolve,2000)});d=await read(false);notify(d);}return d;}catch(e){return notify({state:'unavailable',can_complete:false,paid:false});}finally{inflight=null;}})();return inflight;}
  function watchReturn(){
   function refresh(){if(!current.paid&&current.state!=='cash'&&document.visibilityState!=='hidden')check(true);}
   window.addEventListener('focus',refresh);
   window.addEventListener('pageshow',refresh);
   document.addEventListener('visibilitychange',refresh);
   refresh();
  }
  return {check:check,watchReturn:watchReturn,getState:function(){return current;}};
 }};
})();
