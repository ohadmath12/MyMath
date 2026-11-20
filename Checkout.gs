/** Durable, capability-protected checkout drafts. Never confirms payment from a redirect. */
var CHECKOUT_HEADERS_=['key','receipt_hash','created_at','file_id','state','registration_id','checked_at','armed','lease_until','invitation_hash','payment_confirmed'];
function checkoutRpc_(name,body){
 var r=UrlFetchApp.fetch('https://kstdmsfalsqpomaoddoq.supabase.co/rest/v1/rpc/'+name,{method:'post',contentType:'application/json',headers:{apikey:'sb_publishable_V1975vBFl1SQ4xKowUfCtQ_3-jhmrza'},payload:JSON.stringify(body),muteHttpExceptions:true});
 if(r.getResponseCode()!==200)throw Error('checkout_provider_unavailable');var d=JSON.parse(r.getContentText());if(!d.ok)throw Error('checkout_invitation_unavailable');return d;
}
function checkoutHash_(s){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,s).map(function(b){return ('0'+((b+256)%256).toString(16)).slice(-2);}).join('');}
function checkoutSheet_(){var book=SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID'));var s=book.getSheetByName('PendingCheckouts');if(!s){s=book.insertSheet('PendingCheckouts');s.appendRow(CHECKOUT_HEADERS_);s.setFrozenRows(1);}else if(!s.getRange(1,CHECKOUT_HEADERS_.length).getValues()[0][0])s.getRange(1,CHECKOUT_HEADERS_.length).setValue(CHECKOUT_HEADERS_[CHECKOUT_HEADERS_.length-1]);return s;}
function checkoutRows_(s){return s.getLastRow()<2?[]:s.getRange(2,1,s.getLastRow()-1,CHECKOUT_HEADERS_.length).getValues();}
function checkoutTerms_(terms){var out={};['initial_agorot','monthly_agorot','monthly_method','service_month','payment_flow','payment_url','recurring_starts_on','family_enrollment','new_siblings','family_url'].forEach(function(k){out[k]=terms[k]===undefined?null:terms[k];});return JSON.stringify(out);}
function enableUnifiedCheckout(){
 var triggers=ScriptApp.getProjectTriggers();if(!triggers.some(function(t){return t.getHandlerFunction()==='processPendingCheckouts';}))ScriptApp.newTrigger('processPendingCheckouts').timeBased().everyMinutes(1).create();
 checkoutSheet_();PropertiesService.getScriptProperties().setProperty('UNIFIED_CHECKOUT_ENABLED','true');return {ok:true};
}
function checkoutReady_(){if(PropertiesService.getScriptProperties().getProperty('UNIFIED_CHECKOUT_ENABLED')!=='true')throw Error('checkout_not_enabled');}
function stageCheckoutDraft_(payload){
 checkoutReady_();validateRequiredFields_(payload);var n=normalizePayload_(payload);validateNormalizedPayload_(n);decodeSignature_(n.signature_data_url);
 var kind=payload.lead_token?'lead':'trial',token=payload.lead_token||payload.trial_token;
 if(!/^[a-f0-9]{64}$/.test(token||'')||(payload.lead_token&&payload.trial_token))throw Error('invalid_invitation');
 var t=checkoutRpc_('registration_payment_terms',{kind:kind,token:token});if(!t.terms)throw Error('missing_terms');
 var family=payload.family_token||'',group=null;
 if(family){group=checkoutRpc_('family_registration_public',{token:family});if(kind!=='lead'||!group.children||!group.children.some(function(c){return c.token===token;}))throw Error('wrong_family');}
 if(!!t.terms.new_siblings!==!!family)throw Error('family_checkout_required');
 var key=checkoutHash_(kind+':'+token+':'+n.client_submission_id),lock=LockService.getScriptLock();lock.waitLock(30000);
 try{
  var s=checkoutSheet_(),rows=checkoutRows_(s),i=rows.findIndex(function(r){return r[0]===key;});
  if(i>=0){var old=JSON.parse(DriveApp.getFileById(rows[i][3]).getBlob().getDataAsString());if(JSON.stringify(old.payload)!==JSON.stringify(Object.assign({},n,kind==='lead'?{lead_token:token}:{trial_token:token})))throw Error('draft_changed');return {ok:true,checkout_token:old.receipt,payment_url:old.payment_url,state:rows[i][4]};}
  if(rows.some(function(r){return r[9]===checkoutHash_(kind+':'+token)&&['pending','paid'].indexOf(r[4])>=0;}))throw Error('existing_checkout_resume_required');
  var receipt=(Utilities.getUuid()+Utilities.getUuid()).replace(/-/g,''),data={receipt:receipt,kind:kind,token:token,family_token:family,terms:checkoutTerms_(t.terms),payment_url:t.terms.payment_url||'',payload:Object.assign({},n,kind==='lead'?{lead_token:token}:{trial_token:token})};
  var folder=DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty('SIGNATURE_FOLDER_ID'));
  var file=folder.createFile(Utilities.newBlob(JSON.stringify(data),'application/json','pending-checkout-'+key+'.json'));
  s.appendRow([key,checkoutHash_(receipt),new Date(),file.getId(),'pending','',new Date(0),!family,'',checkoutHash_(kind+':'+token),false]);
  return {ok:true,checkout_token:receipt,payment_url:data.payment_url,state:'pending'};
 }finally{lock.releaseLock();}
}
function checkoutFind_(receipt){if(!/^[a-f0-9]{64}$/.test(receipt||''))throw Error('invalid_checkout');var s=checkoutSheet_(),rows=checkoutRows_(s),hash=checkoutHash_(receipt),i=rows.findIndex(function(r){return r[1]===hash;});if(i<0)throw Error('invalid_checkout');return {sheet:s,row:i+2,values:rows[i]};}
function armFamilyCheckout_(p){
 checkoutReady_();if(!Array.isArray(p.checkout_tokens)||p.checkout_tokens.length!==2||p.checkout_tokens[0]===p.checkout_tokens[1])throw Error('invalid_family_checkout');
 var g=checkoutRpc_('family_registration_public',{token:p.family_token}),found=p.checkout_tokens.map(checkoutFind_),drafts=found.map(function(f){return JSON.parse(DriveApp.getFileById(f.values[3]).getBlob().getDataAsString());});
 if(!g.children||g.children.length!==2||drafts.some(function(d){return d.family_token!==p.family_token;})||g.children.some(function(c){return drafts.filter(function(d){return d.token===c.token;}).length!==1;}))throw Error('family_mismatch');
 drafts.forEach(function(d){var t=checkoutRpc_('registration_payment_terms',{kind:d.kind,token:d.token});if(checkoutTerms_(t.terms)!==d.terms)throw Error('terms_changed');});
 var lock=LockService.getScriptLock();lock.waitLock(30000);try{found.forEach(function(f){f.sheet.getRange(f.row,8).setValue(true);});}finally{lock.releaseLock();}
 var payment=checkoutPaymentState_('family',p.family_token);
 return {ok:true,payment_url:payment.can_complete?'':g.payment_url,state:'pending'};
}
function checkoutStatus_(p){
 var f=checkoutFind_(p.checkout_token),v=f.values;
 return {ok:true,state:v[4],registrationId:v[4]==='completed'?String(v[5]):null,payment_confirmed:v[10]===true};
}
function processPendingCheckouts(){
 checkoutReady_();var s=checkoutSheet_(),rows=checkoutRows_(s),now=Date.now(),processed=0;
 var ordered=rows.map(function(v,i){return {v:v,row:i+2};}).sort(function(a,b){return Number(new Date(a.v[6]||0))-Number(new Date(b.v[6]||0));});
 for(var i=0;i<ordered.length&&processed<10;i++){
  var v=ordered[i].v,row=ordered[i].row;if(v[7]!==true||['completed','terms_changed','expired'].indexOf(v[4])>=0||Number(new Date(v[8]||0))>now)continue;
  var age=now-Number(new Date(v[2]));if(age>7*86400000&&v[4]!=='paid'){s.getRange(row,5).setValue('expired');continue;}
  var gap=age>86400000?3600000:age>3600000?600000:60000;
  if(now-Number(new Date(v[6]||0))<gap)continue;processed++;
  try{checkoutProcessRow_(row);}catch(e){console.error('Checkout retry pending at row '+row);}
 }
}
function checkoutProcessRow_(row){
 var lock=LockService.getScriptLock();lock.waitLock(30000);var s=checkoutSheet_(),v;
 try{v=s.getRange(row,1,1,CHECKOUT_HEADERS_.length).getValues()[0];if(v[7]!==true||v[4]==='completed'||Number(new Date(v[8]||0))>Date.now())return;s.getRange(row,7).setValue(new Date());s.getRange(row,9).setValue(new Date(Date.now()+300000));}finally{lock.releaseLock();}
 try{
  var d=JSON.parse(DriveApp.getFileById(v[3]).getBlob().getDataAsString()),t=checkoutRpc_('registration_payment_terms',{kind:d.kind,token:d.token});
  if(checkoutTerms_(t.terms)!==d.terms){s.getRange(row,5).setValue('terms_changed');return;}
  var status=checkoutRpc_('registration_grow_status',{kind:d.kind,token:d.token,refresh:true});
  if(status.state==='checking'){Utilities.sleep(2000);status=checkoutRpc_('registration_grow_status',{kind:d.kind,token:d.token,refresh:false});}
  if(!status.can_complete)return;
  s.getRange(row,11).setValue(status.paid===true);
  s.getRange(row,5).setValue(status.paid===true?'paid':'pending');
  var result=saveRegistration(d.payload);if(!result.ok||!result.registrationId)throw Error('save_failed');
  s.getRange(row,5,1,2).setValues([['completed',result.registrationId]]);
 }finally{s.getRange(row,9).setValue('');}
}

function checkoutResume_(p){
 if(!/^[a-f0-9]{64}$/.test(p.token||'')||['lead','trial','family'].indexOf(p.kind)<0)throw Error('invalid_invitation');
 var invitations=p.kind==='family'?checkoutRpc_('family_registration_public',{token:p.token}).children.map(function(c){return {kind:'lead',token:c.token};}):[{kind:p.kind,token:p.token}];
 var rows=checkoutRows_(checkoutSheet_()),found=[];
 invitations.forEach(function(c){var hash=checkoutHash_(c.kind+':'+c.token),r=rows.slice().reverse().find(function(v){return v[9]===hash&&['expired','terms_changed'].indexOf(v[4])<0;});if(r){var d=JSON.parse(DriveApp.getFileById(r[3]).getBlob().getDataAsString());found.push({checkout_token:d.receipt,state:r[4],payment_url:['paid','completed'].indexOf(r[4])>=0?'':d.payment_url,registrationId:r[5]||null,armed:r[7]===true,child_token:d.token});}});
 return {ok:true,checkouts:found,complete_set:found.length===invitations.length};
}

function checkoutPaymentState_(kind,token){
 var d=checkoutRpc_('registration_grow_status',{kind:kind,token:token,refresh:true});
 for(var i=0;d.state==='checking'&&i<3;i++){Utilities.sleep(2000);d=checkoutRpc_('registration_grow_status',{kind:kind,token:token,refresh:false});}
 if(!d.can_complete&&d.state!=='pending')throw Error('payment_check_unavailable');return d;
}
function stageCheckout_(payload){
 var d=stageCheckoutDraft_(payload);if(payload.family_token)return d;
 var state=checkoutPaymentState_(payload.lead_token?'lead':'trial',payload.lead_token||payload.trial_token);
 if(state.can_complete){d.payment_url='';var f=checkoutFind_(d.checkout_token);checkoutProcessRow_(f.row);d.state=checkoutStatus_({checkout_token:d.checkout_token}).state;}
 return d;
}
