// Private spreadsheet UI. These functions are never routed by the public doPost.
var MW_CAMPAIGNS='מרתונים להרשמה';
function mwRequireOwner_(){if(Session.getActiveUser().getEmail().toLowerCase()!=='ohadmath12@gmail.com')throw Error('לוח הניהול זמין לבעל החשבון בלבד');}
function mwManagerPage_(){mwRequireOwner_();return HtmlService.createHtmlOutputFromFile('MarathonAdmin').setTitle('MyTheMatix · ניהול מרתונים').addMetaTag('viewport','width=device-width, initial-scale=1');}
function mwCampaignRows_(ss){var sh=ss.getSheetByName(MW_CAMPAIGNS);if(!sh)return[];return sh.getRange('A5:G1000').getValues().filter(function(r){return r[0]&&r[1]&&r[5]==='הרשמה פתוחה'&&typeof r[4]==='number'&&isFinite(r[4])&&r[4]>=0;}).map(function(r){return[r[1],'',r[2],'',r[4],r[5],r[3],r[0],r[0]+' | '+r[1]];});}
function onOpen(){SpreadsheetApp.getUi().createMenu('ניהול מרתונים').addItem('פתיחת לוח השיבוץ','openMarathonManager').addToUi();}
function openMarathonManager(){mwRequireOwner_();SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutputFromFile('MarathonAdmin').setWidth(1200).setHeight(760),'ניהול ושיבוץ מרתונים');}
function installMarathonManager(){mwRequireOwner_();
 var ss=SpreadsheetApp.openById(MW_BOOK),sh=ss.getSheetByName(MW_CAMPAIGNS);
 if(!sh){sh=ss.insertSheet(MW_CAMPAIGNS,ss.getNumSheets());sh.setRightToLeft(true);sh.setHiddenGridlines(true);sh.setFrozenRows(4);sh.getRange('A1:G1').merge().setValue('מרתונים פנימיים — שיבוץ בקשות לקבוצות');sh.getRange('A2:G2').merge().setValue('בקשות מגיעות מהטופס הקבוע. משייכים למרתון ולבית ספר, ואז לקבוצה של עד 6 תלמידים בלוח הניהול.');sh.getRange('A4:G4').setValues([['מזהה מרתון','שם המרתון','כיתה','בית ספר','מחיר לתלמיד','מצב הרשמה','הערות פנימיות']]).setBackground('#1e293a').setFontColor('#ffffff').setFontWeight('bold');sh.setColumnWidths(1,7,160);sh.setColumnWidth(2,360);sh.setColumnWidth(4,280);sh.setColumnWidth(7,300);sh.hideColumns(1);sh.getRange('E5:E1000').setNumberFormat('#,##0.00 "₪"');sh.getRange('F5:F1000').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['טיוטה','הרשמה פתוחה','הרשמה סגורה'],true).setAllowInvalid(false).build());}
 var groups=ss.getSheetByName('מרתונים');if(groups.getMaxColumns()<11)groups.insertColumnsAfter(groups.getMaxColumns(),11-groups.getMaxColumns());groups.getRange('J4:K4').setValues([['מזהה מרתון להרשמה','מקומות בקבוצה']]).setBackground('#1e293a').setFontColor('#ffffff').setFontWeight('bold');groups.hideColumns(10);groups.setColumnWidth(11,140);
 var p=ss.getSheetByName('משתתפי מרתונים');if(p.getMaxColumns()<24)p.insertColumnsAfter(p.getMaxColumns(),24-p.getMaxColumns());p.getRange('X4').setValue('מזהה מרתון להרשמה');p.hideColumns(24);p.getRange('R5:R1000').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['ממתין לשיבוץ','נרשם','רשימת המתנה','בוטל'],true).setAllowInvalid(false).build());
 installMarathonWebIntake();console.log('Marathon manager installed; historical rows preserved.');
}
function mwAdminState(){mwRequireOwner_();return mwAdminState_(SpreadsheetApp.openById(MW_BOOK));}
function mwAdminState_(ss){
 var campaigns=ss.getSheetByName(MW_CAMPAIGNS).getRange('A5:G1000').getValues().filter(function(r){return r[0];}).map(function(r){return{id:r[0],name:r[1],grade:r[2],school:r[3],price:r[4],status:r[5]};});
 var groups=ss.getSheetByName('מרתונים').getRange('A5:K1000').getValues().filter(function(r){return r[9]&&r[7];}).map(function(r){return{id:r[7],campaign:r[9],name:r[3],date:r[1] instanceof Date?Utilities.formatDate(r[1],'Asia/Jerusalem','yyyy-MM-dd'):'',status:r[5],capacity:Math.min(6,Number(r[10])||6)};});
 var sources=mwSources_(ss);
 var people=ss.getSheetByName('משתתפי מרתונים').getRange('A5:X1000').getValues().map(function(r,i){var receipt=mwReceipt_(r),source=sources[receipt],p=source?source.payload:{};return{receipt:receipt,kind:p.kind||'',grade:p.grade||String(r[6]).split(' / ')[0],units:p.level||String(r[6]).split(' / ').slice(1).join(' / '),examDate:p.examDate||'',city:p.city||'',received:source?source.received:'',row:i+5,id:r[19],campaign:r[23],group:r[18],name:r[3],phone:String(r[4]),school:r[5],level:r[6],status:r[17],attended:r[7]==='כן',paid:Number(r[11])||0};}).filter(function(r){return r.campaign||(r.kind==='interest'&&r.id);});
 people.forEach(function(person){var source=sources[person.receipt];person.checkoutAmount=source&&source.payload.checkout?source.payload.checkout.amount:null;person.paymentMethod=source&&source.payload.checkout?source.payload.checkout.method||'grow':'';});
 return{crmEnabled:mwCrmEnabled_(),campaigns:campaigns,groups:groups,people:people,invitations:mwAdminInvitations_(),paymentSettings:mwPaymentSettings_(),schools:MW_SCHOOLS,grades:MW_CLASSES,levels:MW_LEVELS,registrationUrl:'https://ohadmath12.github.io/MyMath/marathons/',sheetUrl:ss.getUrl()};
}
function mwAdminCreateCampaign(data){mwRequireOwner_();mwCrmLegacyWrite_();
 var name=mwText_(data.name,180),grade=mwText_(data.grade,20),school=mwText_(data.school,120),price=Number(data.price);
 if(!name||MW_CLASSES.indexOf(grade)<0||(school&&MW_SCHOOLS.indexOf(school)<0)||data.price===''||!isFinite(price)||price<0)throw Error('יש למלא שם, כיתה ומחיר תקינים');
 var lock=LockService.getScriptLock();lock.waitLock(20000);try{var ss=SpreadsheetApp.openById(MW_BOOK),sh=ss.getSheetByName(MW_CAMPAIGNS),rows=sh.getRange('A5:G1000').getValues(),index=rows.findIndex(function(r){return!r[0]&&!r[1];});if(index<0)throw Error('הטבלה מלאה');var id='MC-'+mwCommandId_(data.commandId);var existing=rows.find(function(r){return r[0]===id;});if(existing)return{id:id};sh.getRange(index+5,1,1,7).setValues([[id,mwSafe_(name),grade,school,price,'טיוטה','']]);return{id:id};}finally{lock.releaseLock();}
}
function mwAdminCampaignStatus(id,status){mwRequireOwner_();mwCrmLegacyWrite_();if(['טיוטה','הרשמה פתוחה','הרשמה סגורה'].indexOf(status)<0)throw Error('מצב לא תקין');var lock=LockService.getScriptLock();lock.waitLock(20000);try{var sh=SpreadsheetApp.openById(MW_BOOK).getSheetByName(MW_CAMPAIGNS),rows=sh.getRange('A5:G1000').getValues(),i=rows.findIndex(function(r){return r[0]===id;});if(i<0)throw Error('המרתון לא נמצא');sh.getRange(i+5,6).setValue(status);return{ok:true};}finally{lock.releaseLock();}}
function mwAdminCreateGroup(data){mwRequireOwner_();mwCrmLegacyWrite_();
 var name=mwText_(data.name,100);if(!name||!/^\d{4}-\d{2}-\d{2}$/.test(data.date))throw Error('יש למלא שם קבוצה ותאריך');
 var d=Utilities.parseDate(data.date,'Asia/Jerusalem','yyyy-MM-dd');if(Utilities.formatDate(d,'Asia/Jerusalem','yyyy-MM-dd')!==data.date||data.date<Utilities.formatDate(new Date(),'Asia/Jerusalem','yyyy-MM-dd'))throw Error('יש לבחור תאריך היום או בעתיד');
 var lock=LockService.getScriptLock();lock.waitLock(20000);try{var ss=SpreadsheetApp.openById(MW_BOOK),campaign=ss.getSheetByName(MW_CAMPAIGNS).getRange('A5:G1000').getValues().find(function(r){return r[0]===data.campaign;});if(!campaign)throw Error('המרתון לא נמצא');var sh=ss.getSheetByName('מרתונים'),rows=sh.getRange('A5:K1000').getValues(),i=rows.findIndex(function(r){return!r[1]&&!r[2]&&!r[7];});if(i<0)throw Error('טבלת הקבוצות מלאה');var r=i+5,id='m-'+mwCommandId_(data.commandId);if(rows.some(function(r){return r[7]===id;}))return{id:id};
 sh.getRange(r,1,1,11).setValues([[mwSafe_(campaign[1]+' — '+name+' — '+Utilities.formatDate(d,'Asia/Jerusalem','dd/MM/yyyy')),d,campaign[2],mwSafe_(name),campaign[4],'מתוכנן','',id,id+' | '+campaign[1]+' — '+name,data.campaign,6]]);return{id:id};}finally{lock.releaseLock();}
}
function mwAdminAssign(data){mwRequireOwner_();mwCrmLegacyWrite_();var lock=LockService.getScriptLock();lock.waitLock(20000);try{return mwAssign_(SpreadsheetApp.openById(MW_BOOK),data);}finally{lock.releaseLock();}}
function mwAssign_(ss,data){
 var sh=ss.getSheetByName('משתתפי מרתונים'),rows=sh.getRange('A5:X1000').getValues(),i=Number(data.row)-5;if(!Number.isInteger(i)||i<0||i>=rows.length)throw Error('תלמיד לא נמצא');var p=rows[i];if(!p[23]||p[19]!==data.participantId)throw Error('הרשומה השתנתה; רעננו את הלוח');if(p[17]==='בוטל')throw Error('ההרשמה בוטלה');if(p[7]==='כן')throw Error('כבר תועדה נוכחות; שינוי שיוך מצריך בדיקה ידנית');
 var target=data.group||'',group=null;
 if(target){group=ss.getSheetByName('מרתונים').getRange('A5:K1000').getValues().find(function(r){return r[7]===target;});if(!group||group[9]!==p[23])throw Error('יש לבחור קבוצה של אותו מרתון');if(['בוטל','התקיים'].indexOf(group[5])>=0||!(group[1] instanceof Date)||Utilities.formatDate(group[1],'Asia/Jerusalem','yyyy-MM-dd')<Utilities.formatDate(new Date(),'Asia/Jerusalem','yyyy-MM-dd'))throw Error('הקבוצה אינה זמינה לשיבוץ');var count=rows.filter(function(r,j){return j!==i&&r[18]===target&&r[17]==='נרשם';}).length;if(count>=Math.min(6,Number(group[10])||6))throw Error('הקבוצה מלאה — עד 6 תלמידים. יש לבחור קבוצה אחרת או לפתוח חדשה');}
 else if(Number(p[11])>0)throw Error('קיים תשלום; אין להחזיר להמתנה לפני בדיקת החיוב');
 if(p[18]===target&&p[17]===(target?'נרשם':'ממתין לשיבוץ'))return{ok:true};
 var range=sh.getRange(i+5,1,1,24),formulas=range.getFormulas()[0],values=p.map(function(v,j){return formulas[j]||v;});values[1]=group?group[8]:'';values[17]=target?'נרשם':'ממתין לשיבוץ';values[18]=target;range.setValues([values]);SpreadsheetApp.flush();return{ok:true};
}
function mwAdminSetStatus(data){mwRequireOwner_();mwCrmLegacyWrite_();return mwAdminCampaignStatus(data.id,data.status);}

function mwCommandId_(id){if(typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))throw Error('יש לרענן את המסך ולנסות שוב');return id;}

// General requests acquire an internal price only when the owner selects a marathon.
function mwAdminAssignCampaign(data){mwRequireOwner_();mwCrmLegacyWrite_();var lock=LockService.getScriptLock();lock.waitLock(20000);try{return mwAssignCampaign_(SpreadsheetApp.openById(MW_BOOK),data);}finally{lock.releaseLock();}}
function mwAssignCampaign_(ss,data){
 var sh=ss.getSheetByName('משתתפי מרתונים'),rows=sh.getRange('A5:X1000').getValues(),i=Number(data.row)-5;
 if(!Number.isInteger(i)||i<0||i>=rows.length)throw Error('תלמיד לא נמצא');var p=rows[i],receipt=mwReceipt_(p),source=mwSources_(ss)[receipt];
 if(p[19]!==data.participantId||!receipt||receipt!==data.receipt||!source||source.payload.kind!=='interest')throw Error('הרשומה השתנתה; רעננו את הלוח');
 var target=data.campaign||'',current=String(p[23]||'');
 if(current===target)return{ok:true};
 if(current!==String(data.expectedCampaign||''))throw Error('השיוך השתנה; רעננו את הלוח');
 var checkout=source.payload.checkout,firstPrepaidAssignment=checkout&&!current&&target&&p[8]===checkout.amount;
 if(checkout&&p[8]!==checkout.amount)throw Error('מחיר הרשומה שונה מהמחיר בטופס; יש לבדוק לפני השיבוץ');
 if(p[17]!=='ממתין לשיבוץ'||p[18]||p[7]==='כן'||(Number(p[11])!==0&&!firstPrepaidAssignment)||p[20]!=='')throw Error('שינוי מרתון זמין רק לפני שיבוץ, תשלום או נוכחות');
 var campaign=null;
 if(target){
  campaign=ss.getSheetByName(MW_CAMPAIGNS).getRange('A5:G1000').getValues().find(function(r){return r[0]===target;});
  if(!campaign||campaign[5]==='הרשמה סגורה'||typeof campaign[4]!=='number'||!isFinite(campaign[4])||campaign[4]<0)throw Error('יש לבחור מרתון פעיל עם מחיר פנימי תקין');
  if(campaign[2]!==source.payload.grade||(campaign[3]&&campaign[3]!==source.payload.school))throw Error('הכיתה ובית הספר אינם תואמים למרתון');
  if(rows.some(function(r,j){return j!==i&&r[23]===target&&r[17]!=='בוטל'&&(r[19]===p[19]||(mwName_(r[3])===mwName_(p[3])&&String(r[4])===String(p[4])));}))throw Error('התלמיד כבר מופיע במרתון הזה; יש לבדוק את ההרשמה הקיימת');
 }
 var range=sh.getRange(i+5,1,1,24),formulas=range.getFormulas()[0],values=p.map(function(v,j){return formulas[j]||v;});
 values[8]=checkout?checkout.amount:(campaign?campaign[4]:'');values[23]=target;range.setValues([values]);SpreadsheetApp.flush();return{ok:true};
}

function mwAdminSavePaymentSettings(data){mwRequireOwner_();var lock=LockService.getScriptLock();lock.waitLock(20000);try{return mwSavePaymentSettings_(data);}finally{lock.releaseLock();}}
function mwSavePaymentSettings_(data){
 var amount=Number(data.amount),url=mwGrowUrl_(data.url),id=mwCommandId_(data.commandId);
 if(data.amount===''||!isFinite(amount)||amount<=0||amount>10000||Math.abs(amount*100-Math.round(amount*100))>0.000001)throw Error('יש להזין סכום חיובי תקין בשקלים, עד 10,000 ₪');
 if(data.confirmed!==true)throw Error('יש לבדוק בקישור Grow שהסכום תואם ולאשר');
 var props=PropertiesService.getScriptProperties(),current=mwPaymentSettings_();
 if(current.revision===id){if(current.amount!==amount||current.url!==url)throw Error('מזהה שמירה כבר שימש להגדרות אחרות');return{ok:true};}
 if(String(data.expectedRevision||'')!==current.revision)throw Error('ההגדרות השתנו; רעננו לפני השמירה');
 // Reusing a URL for a different amount can change an earlier registrant's checkout.
 var all=props.getProperties();Object.keys(all).filter(function(k){return k.indexOf('MW_CHECKOUT_')===0;}).forEach(function(k){var old=JSON.parse(all[k]);if(old.url===url&&old.amount!==amount)throw Error('לסכום אחר יש ליצור קישור Grow חדש, כדי לשמור על המחיר של נרשמים קודמים');});
 var settings={amount:amount,url:url,revision:id,updatedAt:new Date().toISOString()};
 props.setProperty('MW_CHECKOUT_'+id,JSON.stringify(settings));props.setProperty('MW_PAYMENT_SETTINGS_V1',JSON.stringify(settings));return{ok:true};
}

function mwAdminCreateInvitation(data){mwRequireOwner_();var lock=LockService.getScriptLock();lock.waitLock(20000);try{
 var id=mwCommandId_(data.commandId),first=mwText_(data.first,60),last=mwText_(data.last,60),phone=mwPhone_(data.phone,false),amount=Number(data.amount),method=data.method;
 if(!first||!last||!['grow','cash'].includes(method)||data.amount===''||!isFinite(amount)||amount<=0||amount>10000||Math.abs(amount*100-Math.round(amount*100))>0.000001)throw Error('יש למלא שם תלמיד, טלפון הורה וסכום תקינים');
 var standard=mwPaymentSettings_(),url=method==='cash'?'':(amount===100&&!data.url?standard.url:mwGrowUrl_(data.url));if(method==='grow'&&(!url||data.confirmed!==true))throw Error('יש לבדוק ולאשר שקישור Grow מתאים לסכום');
 var props=PropertiesService.getScriptProperties(),old=props.getProperty('MW_INV_'+id),terms={id:id,first:first,last:last,phone:phone,amount:amount,method:method,url:url};
 if(old){var previous=JSON.parse(old);if(JSON.stringify(previous.terms)!==JSON.stringify(terms))throw Error('הפרטים השתנו; רעננו ונסו שוב');return{url:previous.link};}
 var all=props.getProperties();Object.keys(all).filter(function(k){return k.indexOf('MW_INV_')===0&&k.indexOf('MW_INV_TOKEN_')!==0;}).forEach(function(k){var previous=JSON.parse(all[k]);if(url&&previous.url===url&&previous.amount!==amount)throw Error('למחיר שונה נדרש קישור Grow אחר');});
 if(url&&url===standard.url&&amount!==standard.amount)throw Error('קישור ברירת המחדל אינו מתאים למחיר האישי');
 var token=(Utilities.getUuid()+Utilities.getUuid()).replace(/-/g,''),link='https://ohadmath12.github.io/MyMath/marathons/#invite='+token;
 var record=Object.assign({},terms,{terms:terms,expires:Date.now()+30*86400000,link:link});props.setProperty('MW_INV_'+id,JSON.stringify(record));props.setProperty('MW_INV_TOKEN_'+mwTokenHash_(token),id);return{url:link};
 }finally{lock.releaseLock();}}
function mwAdminRevokeInvitation(data){mwRequireOwner_();var id=mwCommandId_(data.id),lock=LockService.getScriptLock();lock.waitLock(20000);try{var props=PropertiesService.getScriptProperties(),raw=props.getProperty('MW_INV_'+id);if(!raw)throw Error('ההזמנה לא נמצאה');var p=JSON.parse(raw);p.revoked=true;props.setProperty('MW_INV_'+id,JSON.stringify(p));return{ok:true};}finally{lock.releaseLock();}}

function mwAdminInvitations_(){var all=PropertiesService.getScriptProperties().getProperties();return Object.keys(all).filter(function(k){return k.indexOf('MW_INV_')===0&&k.indexOf('MW_INV_TOKEN_')!==0;}).map(function(k){var p=JSON.parse(all[k]);return{id:p.id,name:p.first+' '+p.last,amount:p.amount,method:p.method,url:p.link,revoked:!!p.revoked,expires:p.expires};}).sort(function(a,b){return b.expires-a.expires;});}

// CRM cutover: immutable intake snapshots, retry queue, no operational writes back.
function mwCrmEnabled_(){return PropertiesService.getScriptProperties().getProperty('MW_CRM_ENABLED')==='true';}
function mwCrmLegacyWrite_(){if(mwCrmEnabled_())throw Error('השיבוץ עבר ל־CRM. יש לנהל את ההרשמות והמפגשים שם.');}
function mwAdminConfigureCrm(data){
 mwRequireOwner_();var key=String(data.publicKey||'').trim();
 if(!/^(sb_publishable_[A-Za-z0-9_-]+|eyJ[A-Za-z0-9_.-]+)$/.test(key)||key.length>1000)throw Error('מפתח ציבורי לא תקין');
 var props=PropertiesService.getScriptProperties();
 // Probe the authenticated import route with no personal data before enabling.
 var probe=UrlFetchApp.fetch('https://kstdmsfalsqpomaoddoq.supabase.co/rest/v1/rpc/import_marathon_registration',{method:'post',contentType:'application/json',headers:{apikey:key,'x-marathon-key':props.getProperty('MARATHON_GATEWAY_SECRET')},payload:JSON.stringify({p:{source_key:'probe'}}),muteHttpExceptions:true});
 if(probe.getResponseCode()!==400||String(probe.getContentText()).indexOf('invalid_source')<0)throw Error('בדיקת חיבור ה־CRM נכשלה; לא הופעל המעבר');
 props.setProperty('MW_CRM_PUBLIC_KEY',key);props.setProperty('MW_CRM_ENABLED','true');
 if(!ScriptApp.getProjectTriggers().some(function(t){return t.getHandlerFunction()==='retryMarathonIntake';}))ScriptApp.newTrigger('retryMarathonIntake').timeBased().everyMinutes(5).create();
 mwCrmSyncSafely_();return{ok:true};
}
function mwCrmSnapshot_(r,row,sources){
 var receipt=mwReceipt_(r),source=sources[receipt],p=source&&source.payload||{},name=String(r[3]||'').trim();
 var day=r[0] instanceof Date?Utilities.formatDate(r[0],'Asia/Jerusalem','yyyy-MM-dd'):'',today=Utilities.formatDate(new Date(),'Asia/Jerusalem','yyyy-MM-dd');
 var key=receipt?'receipt:'+receipt:'sheet:'+row+':'+String(r[19]||'none').replace(/[^A-Za-z0-9:_-]/g,'_');
 return{source_key:key,student_first_name:p.first||name,student_last_name:p.last||'',parent_name:p.parent||'',parent_phone:String(p.phone||r[4]||''),school_name:String(p.school||r[5]||''),grade:String(p.grade||String(r[6]||'').split(' / ')[0]),study_level:String(p.level||String(r[6]||'').split(' / ').slice(1).join(' / ')),quoted_agorot:typeof r[8]==='number'?Math.round(r[8]*100):null,agreed_method:p.checkout&&p.checkout.method||'',received_agorot:typeof r[11]==='number'?Math.round(r[11]*100):0,payment_date:r[12] instanceof Date?Utilities.formatDate(r[12],'Asia/Jerusalem','yyyy-MM-dd'):String(r[12]||''),payment_method:String(r[13]||''),legacy_group:String(r[1]||''),legacy_date:day,status:r[17]==='בוטל'?'cancelled':day&&day<today?'historical':r[18]?'review':'pending',attendance:r[7]==='כן'?'present':'pending',notes:String(r[16]||'')};
}
function mwCrmQueue_(ss){
 var q=ss.getSheetByName('סנכרון CRM מרתונים');
 if(!q){q=ss.insertSheet('סנכרון CRM מרתונים');q.setRightToLeft(true);q.setFrozenRows(1);q.setHiddenGridlines(true);q.getRange(1,1,1,6).setValues([['מזהה מקור','נתוני קליטה מקוריים','מצב סנכרון','מזהה ב־CRM','עודכן בתאריך','פירוט בקרה']]);q.getRange('A1:F1').setBackground('#1e293a').setFontColor('#ffffff').setFontWeight('bold');q.hideColumns(2);}
 var known={};if(q.getLastRow()>1)q.getRange(2,1,q.getLastRow()-1,1).getValues().forEach(function(x){known[x[0]]=true;});
 var sources=mwSources_(ss),rows=ss.getSheetByName('משתתפי מרתונים').getRange('A5:X1000').getValues(),add=[];
 rows.forEach(function(r,i){if(!r[3])return;var p=mwCrmSnapshot_(r,i+5,sources);if(!known[p.source_key]){add.push([p.source_key,JSON.stringify(p),'ממתין','','','']);known[p.source_key]=true;}});
 if(add.length){var first=q.getLastRow()+1;if(first+add.length>q.getMaxRows())q.insertRowsAfter(q.getMaxRows(),Math.max(500,add.length));q.getRange(first,1,add.length,6).setValues(add);}return q;
}
function mwCrmSyncSafely_(){
 if(!mwCrmEnabled_())return;var lock=LockService.getScriptLock();if(!lock.tryLock(1000))return;
 try{var props=PropertiesService.getScriptProperties(),key=props.getProperty('MW_CRM_PUBLIC_KEY'),secret=props.getProperty('MARATHON_GATEWAY_SECRET');if(!key||!secret)return;
 var q=mwCrmQueue_(SpreadsheetApp.openById(MW_BOOK)),rows=q.getLastRow()>1?q.getRange(2,1,q.getLastRow()-1,6).getValues():[],count=0;
 for(var i=0;i<rows.length&&count<20;i++){var row=rows[i];if(row[2]==='נקלט')continue;count++;
  try{var response=UrlFetchApp.fetch('https://kstdmsfalsqpomaoddoq.supabase.co/rest/v1/rpc/import_marathon_registration',{method:'post',contentType:'application/json',headers:{apikey:key,'x-marathon-key':secret},payload:JSON.stringify({p:JSON.parse(row[1])}),muteHttpExceptions:true});
   if(response.getResponseCode()!==200)throw Error('HTTP '+response.getResponseCode());var result=JSON.parse(response.getContentText());if(!result.id)throw Error('invalid_response');q.getRange(i+2,3,1,4).setValues([['נקלט',result.id,new Date(),'']]);
  }catch(e){q.getRange(i+2,3,1,4).setValues([['ניסיון חוזר','',new Date(),'הקליטה לא אושרה; ניסיון חוזר אוטומטי']]);break;}
 }
 }catch(e){console.error('Marathon CRM sync pending');}finally{lock.releaseLock();}
}
function mwCrmCheckout_(ss,p){
 try{
  var props=PropertiesService.getScriptProperties(),headers={apikey:props.getProperty('MW_CRM_PUBLIC_KEY'),'x-marathon-key':props.getProperty('MARATHON_GATEWAY_SECRET')},q=mwCrmQueue_(ss),rows=q.getRange(2,1,q.getLastRow()-1,6).getValues(),index=rows.findIndex(function(r){return r[0]==='receipt:'+p.id;});
  if(index<0)return'pending';var item=rows[index];
  if(item[2]!=='נקלט'){
   var add=UrlFetchApp.fetch('https://kstdmsfalsqpomaoddoq.supabase.co/rest/v1/rpc/import_marathon_registration',{method:'post',contentType:'application/json',headers:headers,payload:JSON.stringify({p:JSON.parse(item[1])}),muteHttpExceptions:true});
   if(add.getResponseCode()!==200)return'pending';var result=JSON.parse(add.getContentText());if(!result.id)return'pending';q.getRange(index+2,3,1,4).setValues([['נקלט',result.id,new Date(),'']]);
  }
  var response=UrlFetchApp.fetch('https://kstdmsfalsqpomaoddoq.supabase.co/rest/v1/rpc/marathon_checkout_state',{method:'post',contentType:'application/json',headers:headers,payload:JSON.stringify({source:'receipt:'+p.id}),muteHttpExceptions:true});
  if(response.getResponseCode()!==200)return'pending';var state=JSON.parse(response.getContentText());if(!state.known)return'pending';if(state.blocked)return'review';if(state.paid)return'recorded';return'ready';
 }catch(e){return'pending';}
}
