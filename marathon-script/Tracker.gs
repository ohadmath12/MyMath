// Marathon tracker — Ganei Tikva. No payment processing or messages.
function onEdit(e){
 if(!e||!e.range)return;
 const ss=e.source,sh=e.range.getSheet(),name=sh.getName();
 if(!['מרתונים','משתתפי מרתונים'].includes(name)||e.range.getRow()<5)return;
 if(name==='מרתונים'&&sh.getMaxColumns()<9)return;
 if(name==='משתתפי מרתונים'&&sh.getMaxColumns()<22)return;
 const lock=LockService.getScriptLock();if(!lock.tryLock(5000)){ss.toast('המערכת עסוקה; נסה שוב');return;}
 try{
  if(name==='מרתונים'){
   for(let r=e.range.getRow();r<=Math.min(1000,e.range.getLastRow());r++){
    const x=sh.getRange(r,1,1,9).getValues()[0];
    if(x[1] instanceof Date&&x[2]){
     if(!x[7])sh.getRange(r,8).setValue('m-'+Utilities.getUuid());
     if(!x[5])sh.getRange(r,6).setValue('מתוכנן');
     SpreadsheetApp.flush();
     const id=sh.getRange(r,8).getValue(),label=sh.getRange(r,9).getDisplayValue();
     const p=ss.getSheetByName('משתתפי מרתונים'),ids=p.getRange('S5:S1000').getValues();
     ids.forEach((v,i)=>{if(v[0]===id)p.getRange(i+5,2).setValue(label);});
    }
   }return;
  }
  if(e.range.getColumn()>3||e.range.getLastColumn()<2)return;
  if(e.range.getNumRows()!==1||e.range.getNumColumns()!==1){ss.toast('בבחירת מרתון ותלמיד יש לערוך תא אחד בכל פעם. בדוק את עמודת הבקרה.');return;}
  const r=e.range.getRow(),v=sh.getRange(r,1,1,22).getValues()[0];
  const eventId=String(v[1]).split(' | ')[0].trim(),leadId=String(v[2]).split(' | ')[0].trim();
  if(v[17]&&((v[18]&&eventId!==v[18])||(v[19]&&leadId!==v[19])))throw Error('אין להחליף תלמיד או מרתון בהרשמה קיימת. סמן ביטול ופתח שורה חדשה');
  const events=ss.getSheetByName('מרתונים').getRange('A5:I1000').getValues();
  const leads=ss.getSheetByName('סנכרון לידים').getRange('A5:H1000').getValues();
  const ev=eventId ? events.find(x=>x[7]===eventId) : null,ld=leadId ? leads.find(x=>x[1]===leadId) : null;
  if(v[1]&&!ev)throw Error('בחר מרתון תקין מהרשימה');
  if(v[2]&&!ld)throw Error('בחר תלמיד מסנכרון הלידים; אם אינו מופיע הוסף אותו במעקב הלידים');
  if(ev&&ld){
   if(!v[17]&&ev[5]==='בוטל')throw Error('המרתון בוטל');
   const existing=sh.getRange('S5:T1000').getValues();
   if(existing.some((x,i)=>i+5!==r&&x[0]===eventId&&x[1]===leadId))throw Error('התלמיד כבר משויך למרתון הזה. עדכן את הרשומה הקיימת');
  }
  if(ev)sh.getRange(r,19).setValue(eventId);
  if(ld)sh.getRange(r,20).setValue(leadId);
  if(ev&&ld&&!v[17]){
   if(typeof ev[4]==='number'&&isFinite(ev[4])&&ev[4]>=0)sh.getRange(r,9).setValue(ev[4]);
   else sh.getRange(r,9).clearContent();
   sh.getRange(r,18).setValue('נרשם');
   ss.toast('ההרשמה נשמרה. המחיר נשמר להרשמה; נוכחות ותשלום מתעדכנים בנפרד.');
  }
 }catch(err){
  if(name==='משתתפי מרתונים'&&e.range.getNumRows()===1&&e.range.getNumColumns()===1)e.range.setValue(e.oldValue||'');
  ss.toast(err.message,'בדיקת הרשמה',12);
 }finally{lock.releaseLock();}
}
