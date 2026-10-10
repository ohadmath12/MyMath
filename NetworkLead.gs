/** Network landing intake. Server-only through the existing gateway secret. */
var NETWORK_LEAD_HEADERS_ = ['מזהה פנייה','תאריך קליטה','שם הורה','טלפון הורה','שם תלמיד/ה','כיתה','בית ספר','דוא״ל','סניף מבוקש','מקור','אחראי לטיפול','סטטוס טיפול','הערות'];
function networkLeadNormalize_(p) {
  function field(k,max,optional) {
    var v=typeof p[k]==='string'?p[k].trim().replace(/\s+/g,' '):'';
    if ((!optional&&!v)||v.length>max||/[\u0000-\u001f]/.test(v)) throw new Error('Invalid network field');
    return v;
  }
  var id=field('client_submission_id',36);
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw new Error('Invalid submission ID');
  var branch=field('branch',60);
  if(['גני תקווה','פתח תקווה — רונן רחמאני','פתח תקווה — בן יחזקאל'].indexOf(branch)<0)throw new Error('Invalid branch');
  var phone=field('parent_phone',30).replace(/[\s()\-]/g,'').replace(/^\+972/,'0').replace(/^972/,'0');
  if(!/^05\d{8}$/.test(phone))throw new Error('Invalid phone');
  var grade=field('class_name',5);
  if(['ז','ח','ט','י','י״א','י״ב'].indexOf(grade)<0)throw new Error('Invalid grade');
  var email=field('parent_email',254,true);
  if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Invalid email');
  return {client_submission_id:id.toLowerCase(),branch:branch,parent_name:field('parent_name',80),parent_phone:phone,student_first_name:field('student_first_name',60),student_last_name:field('student_last_name',60),class_name:grade,school_name:field('school_name',80),parent_email:email,availability:''};
}
function networkLeadIntake_(payload) {
  var p=networkLeadNormalize_(payload);
  if(p.branch==='גני תקווה') {
    p.operation='public_lead_intake';
    p.intake_channel='network_landing';
    delete p.branch;
    return forwardLeadRequest_(p);
  }
  var lock=LockService.getScriptLock();lock.waitLock(30000);
  try {
    var book=SpreadsheetApp.openById('15kR_-Sr6K5NRQM4zoD4-kU9Xq8qV1_5PWJIv5bLyOo4');
    var sheet=book.getSheets().filter(function(s){return s.getSheetId()===1800000004;})[0];
    if(!sheet||JSON.stringify(sheet.getRange(4,1,1,13).getDisplayValues()[0])!==JSON.stringify(NETWORK_LEAD_HEADERS_))throw new Error('Network sheet contract changed');
    var values=[p.client_submission_id,'',p.parent_name,p.parent_phone,p.student_first_name+' '+p.student_last_name,p.class_name,p.school_name,p.parent_email,p.branch,'דף הנחיתה',p.branch.indexOf('רונן')>=0?'רונן רחמאני':'בן יחזקאל','חדש',''];
    var rows=sheet.getLastRow()>4?sheet.getRange(5,1,sheet.getLastRow()-4,13).getDisplayValues():[];
    var prior=rows.filter(function(r){return r[0]===p.client_submission_id;});
    if(prior.length>1)throw new Error('Duplicate receipt');
    if(prior.length){
      if([2,3,4,5,6,7,8,9].some(function(i){return prior[0][i]!==values[i];}))throw new Error('Submission conflict');
      return {ok:true};
    }
    var row=Math.max(5,sheet.getLastRow()+1);
    if(row>10000)throw new Error('Network sheet capacity reached');
    if(row>sheet.getMaxRows())sheet.insertRowsAfter(sheet.getMaxRows(),100);
    values[1]=Utilities.formatDate(new Date(),'Asia/Jerusalem','dd/MM/yyyy HH:mm');
    var safe=values.map(function(v){return /^[=+@\-]/.test(v)?"'"+v:v;});
    sheet.getRange(row,1,1,13).setNumberFormat('@').setValues([safe]);
    SpreadsheetApp.flush();
    if(JSON.stringify(sheet.getRange(row,1,1,13).getDisplayValues()[0])!==JSON.stringify(values))throw new Error('Readback mismatch');
    return {ok:true};
  }finally{lock.releaseLock();}
}
