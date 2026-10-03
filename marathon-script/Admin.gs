// Private spreadsheet UI. These functions are never routed by the public doPost.
var MW_CAMPAIGNS='מרתונים להרשמה';
function mwRequireOwner_(){if(Session.getActiveUser().getEmail().toLowerCase()!=='ohadmath12@gmail.com')throw Error('לוח הניהול זמין לבעל החשבון בלבד');}
function mwManagerPage_(){mwRequireOwner_();return HtmlService.createHtmlOutputFromFile('MarathonAdmin').setTitle('MyTheMatix · ניהול מרתונים').addMetaTag('viewport','width=device-width, initial-scale=1');}
function mwCampaignRows_(ss){var sh=ss.getSheetByName(MW_CAMPAIGNS);if(!sh)return[];return sh.getRange('A5:G1000').getValues().filter(function(r){return r[0]&&r[1]&&r[5]==='הרשמה פתוחה'&&typeof r[4]==='number'&&isFinite(r[4])&&r[4]>=0;}).map(function(r){return[r[1],'',r[2],'',r[4],r[5],r[3],r[0],r[0]+' | '+r[1]];});}
function onOpen(){SpreadsheetApp.getUi().createMenu('ניהול מרתונים').addItem('פתיחת לוח השיבוץ','openMarathonManager').addToUi();}
function openMarathonManager(){mwRequireOwner_();SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutputFromFile('MarathonAdmin').setWidth(1200).setHeight(760),'ניהול ושיבוץ מרתונים');}
function installMarathonManager(){mwRequireOwner_();
 var ss=SpreadsheetApp.openById(MW_BOOK),sh=ss.getSheetByName(MW_CAMPAIGNS);
 if(!sh){sh=ss.insertSheet(MW_CAMPAIGNS,ss.getNumSheets());sh.setRightToLeft(true);sh.setHiddenGridlines(true);sh.setFrozenRows(4);sh.getRange('A1:G1').merge().setValue('מרתונים פתוחים להרשמה — שיבוץ לקבוצות מתבצע בנפרד');sh.getRange('A2:G2').merge().setValue('מגדירים מרתון לפי מבחן, כיתה ובית ספר. יוצרים קבוצות ומשבצים עד 6 תלמידים בלוח הניהול הפרטי.');sh.getRange('A4:G4').setValues([['מזהה מרתון','שם המרתון','כיתה','בית ספר','מחיר לתלמיד','מצב הרשמה','הערות פנימיות']]).setBackground('#1e293a').setFontColor('#ffffff').setFontWeight('bold');sh.setColumnWidths(1,7,160);sh.setColumnWidth(2,360);sh.setColumnWidth(4,280);sh.setColumnWidth(7,300);sh.hideColumns(1);sh.getRange('E5:E1000').setNumberFormat('#,##0.00 "₪"');sh.getRange('F5:F1000').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['טיוטה','הרשמה פתוחה','הרשמה סגורה'],true).setAllowInvalid(false).build());}
 var groups=ss.getSheetByName('מרתונים');if(groups.getMaxColumns()<11)groups.insertColumnsAfter(groups.getMaxColumns(),11-groups.getMaxColumns());groups.getRange('J4:K4').setValues([['מזהה מרתון להרשמה','מקומות בקבוצה']]).setBackground('#1e293a').setFontColor('#ffffff').setFontWeight('bold');groups.hideColumns(10);groups.setColumnWidth(11,140);
 var p=ss.getSheetByName('משתתפי מרתונים');if(p.getMaxColumns()<24)p.insertColumnsAfter(p.getMaxColumns(),24-p.getMaxColumns());p.getRange('X4').setValue('מזהה מרתון להרשמה');p.hideColumns(24);p.getRange('R5:R1000').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['ממתין לשיבוץ','נרשם','רשימת המתנה','בוטל'],true).setAllowInvalid(false).build());
 installMarathonWebIntake();console.log('Marathon manager installed; historical rows preserved.');
}
function mwAdminState(){mwRequireOwner_();return mwAdminState_(SpreadsheetApp.openById(MW_BOOK));}
function mwAdminState_(ss){
 var campaigns=ss.getSheetByName(MW_CAMPAIGNS).getRange('A5:G1000').getValues().filter(function(r){return r[0];}).map(function(r){return{id:r[0],name:r[1],grade:r[2],school:r[3],price:r[4],status:r[5]};});
 var groups=ss.getSheetByName('מרתונים').getRange('A5:K1000').getValues().filter(function(r){return r[9]&&r[7];}).map(function(r){return{id:r[7],campaign:r[9],name:r[3],date:r[1] instanceof Date?Utilities.formatDate(r[1],'Asia/Jerusalem','yyyy-MM-dd'):'',status:r[5],capacity:Math.min(6,Number(r[10])||6)};});
 var people=ss.getSheetByName('משתתפי מרתונים').getRange('A5:X1000').getValues().map(function(r,i){return{row:i+5,id:r[19],campaign:r[23],group:r[18],name:r[3],phone:String(r[4]),school:r[5],level:r[6],status:r[17],attended:r[7]==='כן',paid:Number(r[11])||0};}).filter(function(r){return r.campaign;});
 return{campaigns:campaigns,groups:groups,people:people,schools:MW_SCHOOLS,grades:MW_CLASSES,registrationUrl:'https://ohadmath12.github.io/MyMath/marathons/',sheetUrl:ss.getUrl()};
}
function mwAdminCreateCampaign(data){mwRequireOwner_();
 var name=mwText_(data.name,180),grade=mwText_(data.grade,20),school=mwText_(data.school,120),price=Number(data.price);
 if(!name||MW_CLASSES.indexOf(grade)<0||(school&&MW_SCHOOLS.indexOf(school)<0)||data.price===''||!isFinite(price)||price<0)throw Error('יש למלא שם, כיתה ומחיר תקינים');
 var lock=LockService.getScriptLock();lock.waitLock(20000);try{var ss=SpreadsheetApp.openById(MW_BOOK),sh=ss.getSheetByName(MW_CAMPAIGNS),rows=sh.getRange('A5:G1000').getValues(),index=rows.findIndex(function(r){return!r[0]&&!r[1];});if(index<0)throw Error('הטבלה מלאה');var id='MC-'+mwCommandId_(data.commandId);var existing=rows.find(function(r){return r[0]===id;});if(existing)return{id:id};sh.getRange(index+5,1,1,7).setValues([[id,mwSafe_(name),grade,school,price,'טיוטה','']]);return{id:id};}finally{lock.releaseLock();}
}
function mwAdminCampaignStatus(id,status){mwRequireOwner_();if(['טיוטה','הרשמה פתוחה','הרשמה סגורה'].indexOf(status)<0)throw Error('מצב לא תקין');var lock=LockService.getScriptLock();lock.waitLock(20000);try{var sh=SpreadsheetApp.openById(MW_BOOK).getSheetByName(MW_CAMPAIGNS),rows=sh.getRange('A5:G1000').getValues(),i=rows.findIndex(function(r){return r[0]===id;});if(i<0)throw Error('המרתון לא נמצא');sh.getRange(i+5,6).setValue(status);return{ok:true};}finally{lock.releaseLock();}}
function mwAdminCreateGroup(data){mwRequireOwner_();
 var name=mwText_(data.name,100);if(!name||!/^\d{4}-\d{2}-\d{2}$/.test(data.date))throw Error('יש למלא שם קבוצה ותאריך');
 var d=Utilities.parseDate(data.date,'Asia/Jerusalem','yyyy-MM-dd');if(Utilities.formatDate(d,'Asia/Jerusalem','yyyy-MM-dd')!==data.date||data.date<Utilities.formatDate(new Date(),'Asia/Jerusalem','yyyy-MM-dd'))throw Error('יש לבחור תאריך היום או בעתיד');
 var lock=LockService.getScriptLock();lock.waitLock(20000);try{var ss=SpreadsheetApp.openById(MW_BOOK),campaign=ss.getSheetByName(MW_CAMPAIGNS).getRange('A5:G1000').getValues().find(function(r){return r[0]===data.campaign;});if(!campaign)throw Error('המרתון לא נמצא');var sh=ss.getSheetByName('מרתונים'),rows=sh.getRange('A5:K1000').getValues(),i=rows.findIndex(function(r){return!r[1]&&!r[2]&&!r[7];});if(i<0)throw Error('טבלת הקבוצות מלאה');var r=i+5,id='m-'+mwCommandId_(data.commandId);if(rows.some(function(r){return r[7]===id;}))return{id:id};
 sh.getRange(r,1,1,11).setValues([[mwSafe_(campaign[1]+' — '+name+' — '+Utilities.formatDate(d,'Asia/Jerusalem','dd/MM/yyyy')),d,campaign[2],mwSafe_(name),campaign[4],'מתוכנן','',id,id+' | '+campaign[1]+' — '+name,data.campaign,6]]);return{id:id};}finally{lock.releaseLock();}
}
function mwAdminAssign(data){mwRequireOwner_();var lock=LockService.getScriptLock();lock.waitLock(20000);try{return mwAssign_(SpreadsheetApp.openById(MW_BOOK),data);}finally{lock.releaseLock();}}
function mwAssign_(ss,data){
 var sh=ss.getSheetByName('משתתפי מרתונים'),rows=sh.getRange('A5:X1000').getValues(),i=Number(data.row)-5;if(!Number.isInteger(i)||i<0||i>=rows.length)throw Error('תלמיד לא נמצא');var p=rows[i];if(!p[23]||p[19]!==data.participantId)throw Error('הרשומה השתנתה; רעננו את הלוח');if(p[17]==='בוטל')throw Error('ההרשמה בוטלה');if(p[7]==='כן')throw Error('כבר תועדה נוכחות; שינוי שיוך מצריך בדיקה ידנית');
 var target=data.group||'',group=null;
 if(target){group=ss.getSheetByName('מרתונים').getRange('A5:K1000').getValues().find(function(r){return r[7]===target;});if(!group||group[9]!==p[23])throw Error('יש לבחור קבוצה של אותו מרתון');if(['בוטל','התקיים'].indexOf(group[5])>=0||!(group[1] instanceof Date)||Utilities.formatDate(group[1],'Asia/Jerusalem','yyyy-MM-dd')<Utilities.formatDate(new Date(),'Asia/Jerusalem','yyyy-MM-dd'))throw Error('הקבוצה אינה זמינה לשיבוץ');var count=rows.filter(function(r,j){return j!==i&&r[18]===target&&r[17]==='נרשם';}).length;if(count>=Math.min(6,Number(group[10])||6))throw Error('הקבוצה מלאה — עד 6 תלמידים. יש לבחור קבוצה אחרת או לפתוח חדשה');}
 else if(Number(p[11])>0)throw Error('קיים תשלום; אין להחזיר להמתנה לפני בדיקת החיוב');
 if(p[18]===target&&p[17]===(target?'נרשם':'ממתין לשיבוץ'))return{ok:true};
 var range=sh.getRange(i+5,1,1,24),formulas=range.getFormulas()[0],values=p.map(function(v,j){return formulas[j]||v;});values[1]=group?group[8]:'';values[17]=target?'נרשם':'ממתין לשיבוץ';values[18]=target;range.setValues([values]);SpreadsheetApp.flush();return{ok:true};
}
function mwAdminSetStatus(data){mwRequireOwner_();return mwAdminCampaignStatus(data.id,data.status);}

function mwCommandId_(id){if(typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))throw Error('יש לרענן את המסך ולנסות שוב');return id;}
