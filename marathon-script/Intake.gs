// Marathon-only endpoint. Public access is through the authenticated Cloudflare gateway.
var MW_BOOK='1QEgeUA2bXlBFs2sl5QoZUxgBzvRlvxcbVJb0ptGgdG4';
var MW_LOG='קליטת טופס מרתונים';
var MW_SCHOOLS=['חטיבת הביניים הראשונים, גני תקווה','חטיבת בראשית, גני תקווה','תיכון מיתר, גני תקווה','חטיבת בן צבי, קריית אונו','תיכון בן צבי, קריית אונו','חטיבת שמעון פרס, קריית אונו','חטיבת שז"ר, קריית אונו'];
var MW_CLASSES=['ז','ח','ט','י','י״א','י״ב'];
var MW_LEVELS=['לא רלוונטי','הקבצה א','הקבצה א׳ חדשה','הקבצה ב','3 יח״ל','4 יח״ל','5 יח״ל','לא ידוע עדיין'];
function mwText_(v,max){if(typeof v!=='string')throw Error('invalid_field');v=v.normalize('NFKC').trim().replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ');if(v.length>max)throw Error('invalid_field');return v;}
function mwPhone_(v,optional){v=mwText_(v||'',40).replace(/[\s().-]/g,'').replace(/^(?:\+972|00972)/,'0');if(optional&&!v)return '';if(!/^05\d{8}$/.test(v))throw Error('invalid_phone');return v;}
function mwSafe_(s){return /^[=+@-]/.test(String(s))?"'"+s:s;}
function mwName_(s){return String(s).normalize('NFKC').trim().replace(/\s+/g,' ').replace(/[׳״'"\u200e\u200f]/g,'').toLowerCase();}
function mwNormalize_(a){
 if(!a||typeof a!=='object'||Array.isArray(a))throw Error('invalid_payload');
 var p={id:mwText_(a.client_submission_id,64),event:mwText_(a.event_id,80),first:mwText_(a.student_first_name,60),last:mwText_(a.student_last_name,60),school:mwText_(a.school_name,120),grade:mwText_(a.class_name,20),level:mwText_(a.units,40),parent:mwText_(a.parent_name,100),phone:mwPhone_(a.parent_phone,false),studentPhone:mwPhone_(a.student_phone,true),email:mwText_(a.parent_email||'',150),notes:mwText_(a.notes||'',1000),price:a.quoted_price};
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(p.id)||!p.event||!p.first||!p.last||!p.parent)throw Error('invalid_required');
 if(p.school==='אחר'){p.school=mwText_(a.school_other,120);if(!p.school)throw Error('invalid_school');}else if(MW_SCHOOLS.indexOf(p.school)<0)throw Error('invalid_school');
 if(MW_CLASSES.indexOf(p.grade)<0||MW_LEVELS.indexOf(p.level)<0)throw Error('invalid_study');
 if(p.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email))throw Error('invalid_email');
 if(typeof p.price!=='number'||!isFinite(p.price)||p.price<0)throw Error('invalid_price');return p;
}
function mwEvents_(ss){var today=Utilities.formatDate(new Date(),'Asia/Jerusalem','yyyy-MM-dd');return ss.getSheetByName('מרתונים').getRange('A5:I1000').getValues().filter(function(r){return r[7]&&r[0]&&r[1] instanceof Date&&Utilities.formatDate(r[1],'Asia/Jerusalem','yyyy-MM-dd')>=today&&r[5]==='הרשמה פתוחה'&&typeof r[4]==='number'&&isFinite(r[4])&&r[4]>=0;});}
function mwCatalog_(ss){return mwCampaignRows_(ss).map(function(r){return{id:String(r[7]),name:String(r[0]),price:r[4]};});}
function mwEnsureLog_(ss){
 var log=ss.getSheetByName(MW_LOG);if(log&&log.getLastRow()>0){if(log.getRange(1,1).getValue()!=='מזהה בקשה')throw Error('intake_schema_mismatch');return log;}
 if(!log)log=ss.insertSheet(MW_LOG);log.setRightToLeft(true);log.setFrozenRows(1);log.setHiddenGridlines(true);
 log.getRange(1,1,1,19).setValues([['מזהה בקשה','נשלח בתאריך','מרתון שנבחר','שם פרטי','שם משפחה','בית ספר','כיתה','רמה','שם הורה','טלפון הורה','טלפון תלמיד','דוא״ל הורה','הערות','מצב קליטה','פירוט בקרה','שורה במשתתפים','מזהה משתתף','מזהה מרתון','נתוני מקור לשחזור']]);
 log.getRange('A1:S1').setBackground('#1e293a').setFontColor('#ffffff').setFontWeight('bold').setWrap(true);log.setRowHeight(1,42);log.setColumnWidths(1,19,150);log.setColumnWidth(3,300);log.setColumnWidth(15,320);log.getRange('B2:B1000').setNumberFormat('dd/MM/yyyy HH:mm');log.getRange('J2:L1000').setNumberFormat('@');log.hideColumns(19);return log;
}
function installMarathonWebIntake(){mwRequireOwner_();var ss=SpreadsheetApp.openById(MW_BOOK);mwEnsureLog_(ss);if(!ScriptApp.getProjectTriggers().some(function(t){return t.getHandlerFunction()==='retryMarathonIntake';}))ScriptApp.newTrigger('retryMarathonIntake').timeBased().everyMinutes(5).create();console.log('Marathon intake ready; open events: '+mwCatalog_(ss).length);}
function doGet(){try{return mwManagerPage_();}catch(error){return ContentService.createTextOutput(JSON.stringify({ok:false})).setMimeType(ContentService.MimeType.JSON);}}
function doPost(e){
 var result;
 try{
  if(!e||!e.postData||typeof e.postData.contents!=='string'||e.postData.contents.length>12000)throw Error('invalid_body');
  var body=JSON.parse(e.postData.contents),secret=PropertiesService.getScriptProperties().getProperty('MARATHON_GATEWAY_SECRET');
  if(!secret||!body||body.gateway_secret!==secret||!body.payload)throw Error('unauthorized');
  var ss=SpreadsheetApp.openById(MW_BOOK),a=body.payload;
  if(a.operation==='marathon_catalog')result={ok:true,events:mwCatalog_(ss)};
  else if(a.operation==='marathon_intake'){
   var p=mwNormalize_(a),lock=LockService.getScriptLock();lock.waitLock(20000);
   try{result=mwIntake_(ss,p);}finally{lock.releaseLock();}
  }else throw Error('invalid_operation');
 }catch(error){console.error('Marathon intake: '+String(error.message));result={ok:false,code:['event_changed','study_mismatch'].indexOf(error.message)>=0?error.message:'intake_failed'};}
 return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}
function mwIntake_(ss,p){
 var log=mwEnsureLog_(ss),records=log.getLastRow()>1?log.getRange(2,1,log.getLastRow()-1,19).getValues():[],old=records.findIndex(function(r){return r[0]===p.id;});
 if(old>=0){
  if(records[old][18]!==JSON.stringify(p))throw Error('receipt_mismatch');
  if(['נקלט','כבר רשום','נדרש בירור'].indexOf(records[old][13])>=0)return{ok:true};
  mwProcess_(ss,log,old+2,p);return{ok:true};
 }
 var events=mwCampaignRows_(ss).filter(function(r){return String(r[7])===p.event;});
 if(events.length===1&&(events[0][2]!==p.grade||(events[0][6]&&events[0][6]!==p.school)))throw Error('study_mismatch');
 if(events.length!==1||events[0][4]!==p.price)throw Error('event_changed');
 var lr=Math.max(2,log.getLastRow()+1);if(lr>log.getMaxRows())log.insertRowsAfter(log.getMaxRows(),500);
 log.getRange(lr,1,1,19).setValues([[p.id,new Date(),mwSafe_(events[0][0]),mwSafe_(p.first),mwSafe_(p.last),mwSafe_(p.school),p.grade,p.level,mwSafe_(p.parent),p.phone,p.studentPhone,mwSafe_(p.email),mwSafe_(p.notes),'ממתין','','','',p.event,JSON.stringify(p)]]);
 mwProcess_(ss,log,lr,p);return{ok:true};
}
function mwResult_(log,row,status,detail,participantRow,uid,event){log.getRange(row,14,1,5).setValues([[status,mwSafe_(detail),participantRow,uid,event]]);}
function mwReview_(message){var e=Error(message);e.review=true;throw e;}
function mwProcess_(ss,log,lr,p){
 try{
  var sh=ss.getSheetByName('משתתפי מרתונים'),rows=sh.getRange('A5:X1000').getValues();
  var receipt=rows.findIndex(function(r){return String(r[16]).indexOf('טופס מרתון: '+p.id)>=0;});
  if(receipt>=0){mwResult_(log,lr,'נקלט','',receipt+5,rows[receipt][19],rows[receipt][23]);return;}
  var duplicate=rows.findIndex(function(r){return String(r[23])===p.event&&mwName_(r[3])===mwName_(p.first+' '+p.last)&&String(r[4]).replace(/\D/g,'')===p.phone;});
  if(duplicate>=0){mwResult_(log,lr,rows[duplicate][17]==='בוטל'?'נדרש בירור':'כבר רשום','קיימת הרשמה לתלמיד; אין חיוב נוסף. פרטי הפנייה נשמרו לבדיקה.',duplicate+5,rows[duplicate][19],p.event);return;}
  if(rows.some(function(r){return String(r[23])===p.event&&mwName_(r[3])===mwName_(p.first+' '+p.last);}))mwReview_('שם זה כבר מופיע במרתון עם טלפון אחר; יש לבדוק לפני הוספת חיוב');
  var events=mwCampaignRows_(ss).filter(function(r){return String(r[7])===p.event;});
  if(events.length!==1||events[0][4]!==p.price)mwReview_('האירוע נסגר או מחירו השתנה בזמן הקליטה; לבדוק מול ההורה');
  var ev=events[0],index=rows.findIndex(function(r){return!r[1]&&!r[2]&&!r[17]&&!r[18]&&!r[19];});if(index<0)mwReview_('טבלת המשתתפים מלאה; יש להרחיב אותה');
  var r=index+5,uid='MF-'+Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,p.phone+'|'+mwName_(p.first+' '+p.last)).map(function(b){return('0'+((b+256)%256).toString(16)).slice(-2);}).join('').slice(0,24);
  var values=[`=IF(S${r}="","",IFERROR(XLOOKUP(S${r},'מרתונים'!H$5:H$1000,'מרתונים'!B$5:B$1000),""))`,'',uid+' | '+p.first+' '+p.last,mwSafe_(p.first+' '+p.last),p.phone,mwSafe_(p.school),mwSafe_(p.grade+' / '+p.level),'',ev[4],`=IF(C${r}="","",IF(R${r}="ממתין לשיבוץ",0,IF(ISNUMBER(U${r}),U${r},IF(R${r}="נרשם",IF(ISNUMBER(I${r}),I${r},""),IF(R${r}="רשימת המתנה",0,"")))))`,`=IF(C${r}="","",IF(R${r}="ממתין לשיבוץ","לא",IF(J${r}="","טרם נקבע",IF(L${r}>=J${r},"כן","לא"))))`,'','','',`=IF(J${r}="","",J${r}-L${r})`,`=IF(C${r}="","",IF(R${r}="ממתין לשיבוץ","ממתין לשיבוץ",IF(J${r}="","חיוב טרם נקבע",IF(O${r}<0,"זכות / החזר לבדיקה",IF(O${r}=0,"שולם",IF(L${r}>0,"שולם חלקית","ממתין לתשלום"))))))`,mwSafe_('טופס מרתון: '+p.id+(p.notes?' | '+p.notes:'')),'ממתין לשיבוץ','',uid,'',`=IF(C${r}="","",IF(COUNTIFS(X$5:X$1000,X${r},T$5:T$1000,T${r})>1,"הרשמה כפולה",IF(J${r}="","יש לקבוע חיוב",IF(AND(L${r}<>0,M${r}=""),"חסר תאריך תשלום",""))))`,'',ev[7]];
  sh.getRange(r,3).clearDataValidations();sh.getRange(r,5).setNumberFormat('@');sh.getRange(r,1,1,24).setValues([values]);sh.getRange(r,23).setNote('מקור: טופס המרתונים. פרטי ההורה בלשונית '+MW_LOG+'.');SpreadsheetApp.flush();mwResult_(log,lr,'נקלט','',r,uid,ev[7]);
 }catch(error){mwResult_(log,lr,error.review?'נדרש בירור':'ממתין',error.review?error.message:'תקלה טכנית; ניסיון אוטומטי נוסף מתבצע כל 5 דקות','','',p.event);if(!error.review)throw error;}
}
function retryMarathonIntake(){var lock=LockService.getScriptLock();if(!lock.tryLock(20000))return;try{var ss=SpreadsheetApp.openById(MW_BOOK),log=ss.getSheetByName(MW_LOG);if(!log||log.getLastRow()<2)return;var rows=log.getRange(2,1,log.getLastRow()-1,19).getValues(),count=0;rows.forEach(function(r,i){if(r[13]==='ממתין'&&r[18]&&count++<30)mwProcess_(ss,log,i+2,JSON.parse(r[18]));});}finally{lock.releaseLock();}}
