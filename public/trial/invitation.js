'use strict';
window.trialInviteToken=new URLSearchParams(location.hash.slice(1)).get('invite');
window.trialInviteReady=false;
window.trialInviteTerms=null;
window.trialInviteRpc=async function(name,args){
 const c=window.ENROLLMENT_PAYMENT_CONFIG;
 const response=await fetch(`${c.url}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:c.key,'Content-Type':'application/json'},body:JSON.stringify(args)});
 if(!response.ok)throw new Error('invitation_failed');
 const data=await response.json();if(!data?.ok)throw new Error('invitation_invalid');return data;
};
window.showPersonalTrialPayment=function(data){
 const container=document.getElementById('trial-payment');container.replaceChildren();container.hidden=false;
 const note=document.createElement('p');
 const price=new Intl.NumberFormat('he-IL',{style:'currency',currency:'ILS'}).format(data.amount_agorot/100);
 note.textContent=data.paid?'התשלום כבר תועד במערכת. אין לשלם שוב.':data.needs_review?'הפרטים נקלטו לבדיקה כדי למנוע כפילות. ניצור איתכם קשר לפני המשך התשלום.':`מחיר שיעור הניסיון שסוכם: ${price}. התשלום חד־פעמי, בנפרד מההרשמה למסגרת קבועה. אם כבר שילמתם, אין לשלם שוב — פנו אלינו לאישור.`;
 container.append(note);
 if(data.payment_url&&!data.paid){
  const u=new URL(data.payment_url);
  if(u.protocol!=='https:'||!['grow.link','meshulam.co.il','grow.business'].some(h=>u.hostname===h||u.hostname.endsWith('.'+h)))return;
  const link=document.createElement('a');link.href=u.href;link.target='_blank';link.rel='noopener noreferrer';link.textContent=`לתשלום מאובטח ב־Grow · ${price}`;container.append(link);
 }else if(!data.paid&&!data.needs_review){note.textContent+=' הקישור לתשלום אינו זמין כרגע. פנו אלינו להשלמת הטיפול.';}
};
if(window.trialInviteToken){
 const f=document.getElementById('trial-form'),msg=document.getElementById('message');
 f.hidden=true;msg.textContent='טוענים את תנאי הניסיון האישיים…';
 const priceNote=f.querySelector('.note');priceNote.textContent='טוענים את המחיר שסוכם…';
 window.trialInviteRpc('read_trial_invitation',{token:window.trialInviteToken}).then(data=>{
  window.trialInviteTerms=data;window.trialInviteReady=true;
  const price=new Intl.NumberFormat('he-IL',{style:'currency',currency:'ILS'}).format(data.amount_agorot/100);
  priceNote.textContent=`מחיר שיעור הניסיון שסוכם: ${price}, בתשלום חד־פעמי. לאחר אישור הפרטים יוצג הקישור לתשלום. מילוי הטופס אינו אישור שיבוץ או תשלום.`;
  const badge=document.createElement('p');badge.className='note';badge.textContent=`מחיר אישי לשיעור הניסיון: ${price}`;f.before(badge);
  if(data.submitted){msg.textContent='הפרטים כבר נקלטו. אין צורך לשלוח טופס נוסף.';window.showPersonalTrialPayment(data);return;}
  if(data.prefill){for(const [name,value] of Object.entries(data.prefill)){if(!value)continue;const input=f.elements.namedItem(name);if(!input)continue;
   if(name==='school_name'&&!Array.from(input.options).some(o=>o.value===value)){input.value='__other__';const other=document.getElementById('school_other');other.value=value;input.dispatchEvent(new Event('change'));}
   else input.value=value;
  }}
  msg.textContent='';f.hidden=false;
 }).catch(()=>{msg.textContent='הקישור אינו זמין או שפג תוקפו. פנו אלינו לקבלת קישור אישי חדש. לא בוצע חיוב.';f.hidden=true});
}
