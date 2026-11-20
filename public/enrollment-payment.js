(function () {
  'use strict';
  var terms = null, ready = true, box, saved = false, verified = false, resuming = false;
  var edited = new Set();
  var confirmation=null,checkControls=[];
  function message(text) { if (box) { box.textContent = text; box.hidden = false; } }
  function safeLink(value) {
    try { var u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && /(^|\.)(grow\.link|meshulam\.co\.il|grow\.business)$/.test(u.hostname); } catch (e) { return false; }
  }
  function render(target, paymentButton) {
    target.textContent = '';
    if (paymentButton && verified) { var confirmation=document.createElement('p'); confirmation.textContent='קבלת התשלום אושרה על ידי המרכז. אין צורך לשלם שוב.'; target.appendChild(confirmation); return; }
    var family = terms.family_enrollment === true;
    var recurringInitial = terms.monthly_method === 'recurring' && terms.payment_flow === 'recurring_initial';
    var title = document.createElement('h3'); title.textContent = terms.new_siblings ? 'תשלום משפחתי משותף לשני הילדים' : family ? 'הרשמה משפחתית — הצטרפות אח או אחות' : 'תנאי התשלום שסוכמו עבורכם'; target.appendChild(title);
    if (family) {
      var sibling = document.createElement('p'); sibling.textContent = 'אח או אחות שכבר במסגרת: ' + terms.existing_sibling_name + '. הפרטים והחתימה בטופס זה מיועדים לילד המצטרף בלבד; אין צורך לרשום מחדש את האח הקיים.'; target.appendChild(sibling);
    }
    var line = document.createElement('p');
    var amount = (terms.initial_agorot / 100).toLocaleString('he-IL', {style:'currency',currency:'ILS'});
    line.textContent = (family ? 'תשלום חד־פעמי לילד המצטרף — יתרת חודש ' : 'תשלום עבור חודש ') + terms.service_month.slice(0,7).split('-').reverse().join('/') + ': ' + amount + '. תשלום הניסיון נפרד.';
    target.appendChild(line);
    if (terms.monthly_method === 'cash') {
      var trial = terms.unpaid_trial_agorot || 0;
      if (trial > 0) {
        var trialLine = document.createElement('p'); trialLine.textContent = 'שיעור ניסיון שטרם שולם: ' + (trial / 100).toLocaleString('he-IL', {style:'currency',currency:'ILS'}) + '.'; target.appendChild(trialLine);
      }
      var total = document.createElement('p');
      var totalText = document.createElement('strong'); totalText.textContent = 'סה״כ לתשלום במזומן: ' + ((terms.initial_agorot + trial) / 100).toLocaleString('he-IL', {style:'currency',currency:'ILS'}) + '.'; total.appendChild(totalText); target.appendChild(total);
    }
    if (terms.initial_lesson_agorot != null) {
      var breakdown = document.createElement('p');
      breakdown.textContent = 'מחיר מיוחד לחודש הראשון בלבד: ' + terms.initial_lesson_count + ' שיעורים × ' + (terms.initial_lesson_agorot/100).toLocaleString('he-IL') + ' ₪ = ' + amount + '. שיעור הניסיון אינו כלול.';
      target.appendChild(breakdown);
    }
    if (family) {
      var familyMonthly = document.createElement('p'); familyMonthly.textContent = 'החל מ־' + terms.recurring_starts_on.split('-').reverse().join('/') + ': 600 ₪ לכל ילד — 1,200 ₪ לחודש לשני הילדים יחד. המרכז יעדכן את הוראת הקבע הקיימת ב־Grow. התשלום החד־פעמי כאן אינו מקים הוראת קבע נוספת.'; target.appendChild(familyMonthly);
    }
    if (terms.monthly_agorot && !family) {
      var monthly = document.createElement('p');
      monthly.textContent = 'המחיר החודשי להמשך: ' + (terms.monthly_agorot / 100).toLocaleString('he-IL', {style:'currency',currency:'ILS'}) + (terms.sibling_discount ? ' · מחיר אחים' : '') + '.';
      var personalRecurring = terms.monthly_agorot !== 65000 && terms.monthly_method === 'recurring' && /^\d{4}-\d{2}-\d{2}$/.test(terms.recurring_starts_on || '');
      if (personalRecurring) {
        monthly.textContent = 'המחיר החודשי שסוכם עבורכם: ' + (terms.monthly_agorot / 100).toLocaleString('he-IL') + ' ש״ח ב־' + Number(terms.recurring_starts_on.slice(8,10)) + ' בכל חודש, החל מ־' + terms.recurring_starts_on.split('-').reverse().join('/') + (recurringInitial ? '. לאחר התשלום הראשון המרכז יעדכן את הוראת הקבע לסכום ולמועד אלה.' : '. הוראת הקבע תוסדר בנפרד.');
      }
      target.appendChild(monthly);
      if (!personalRecurring && terms.monthly_method === 'recurring' && terms.recurring_starts_on) {
        var start = document.createElement('p'); start.textContent = 'מועד החיוב הבא שסוכם: ' + terms.recurring_starts_on.split('-').reverse().join('/') + (recurringInitial ? '. לאחר התשלום הראשון המרכז יעדכן את הוראת הקבע למועד זה ולמחיר החודשי שסוכם.' : '. הקמתה תאושר בנפרד.'); target.appendChild(start);
      }
    }
    var method = document.createElement('p');
    method.textContent = terms.monthly_method === 'cash' ? 'סוכם על תשלום הסכומים המפורטים לעיל והתשלום החודשי במזומן. אין צורך להזין אשראי או להקים הוראת קבע. השלמת הטופס אינה אישור קבלת תשלום.' : recurringInitial ? 'עברו ל־Grow להזנת אשראי ולהקמת הוראת קבע. החיוב הראשון יבוצע מיד בסכום התשלום המוצג כאן. לאחריו המרכז יעדכן את הסכום והתאריך לחיובים הבאים כפי שסוכם לעיל.' : 'הוראת הקבע לחודשים הבאים תוסדר בנפרד. הקישור כאן מיועד לתשלום חד־פעמי ליתרת החודש בלבד.';
    target.appendChild(method);
    if (paymentButton && terms.new_siblings) {
      var familyLink=document.createElement('a');familyLink.href=terms.family_url;familyLink.target='_top';familyLink.className='btn btn-primary';familyLink.textContent='להמשך ההרשמה המשפחתית והתשלום המשותף';target.appendChild(familyLink);return;
    }
    if (paymentButton && terms.initial_agorot > 0 && terms.monthly_method !== 'cash' && safeLink(terms.payment_url)) {
      var a = document.createElement('a'); a.href = terms.payment_url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.className = 'btn btn-primary'; a.textContent = (recurringInitial ? 'לתשלום הראשון ולהקמת הוראת קבע · ' : 'לתשלום מאובטח ב־Grow · ') + amount; target.appendChild(a);
      var note = document.createElement('p'); note.textContent = 'אם כבר שילמתם, אין לשלם שוב. פתיחת הקישור או השלמת ההרשמה אינן אישור שהתקבל תשלום.'; target.appendChild(note);
    }
  }
  window.EnrollmentPayment = {
    init: function (kind, token) {
      if (!token) { var unavailable=document.querySelector('form'); if(unavailable){unavailable.hidden=true;unavailable.insertAdjacentHTML('beforebegin','<p>להרשמה לתוכנית נדרש קישור אישי מהמרכז. התשלום מופיע בשלב האחרון של ההרשמה.</p>');} return; }
      ready = false;
      var form = document.querySelector('form');
      form.hidden = true; form.inert = true;
      form.addEventListener('input', function(e){ edited.add(e.target.id); });
      form.addEventListener('change', function(e){ edited.add(e.target.id); });
      box = document.createElement('section'); box.className = 'enrollment-payment-terms'; box.id='enrollment-checkout'; box.setAttribute('aria-live','polite');
      // Outside the step containers so the agreed terms remain visible before submission.
      form.parentNode.insertBefore(box, form);
      message('טוענים את תנאי התשלום האישיים…');
      form.addEventListener('submit', function (e) { if (!ready) { e.preventDefault(); e.stopImmediatePropagation(); message('תנאי התשלום טרם נטענו. רעננו לפני השלמת ההרשמה.'); } }, true);
      var c = window.ENROLLMENT_PAYMENT_CONFIG;
      fetch(c.url + '/rest/v1/rpc/registration_payment_terms', {method:'POST',headers:{'Content-Type':'application/json',apikey:c.key},body:JSON.stringify({kind:kind,token:token})})
        .then(function (r) { if (!r.ok) throw Error('terms_failed'); return r.json(); })
        .then(function (r) {
          if (!r.ok) throw Error('invalid_link');
          terms = r.terms; verified = r.payment_verified === true;
          if (terms && (!Number.isInteger(terms.initial_agorot) || terms.initial_agorot<0 || !/^\d{4}-\d{2}-01$/.test(terms.service_month) || ['cash','recurring'].indexOf(terms.monthly_method)<0 || (terms.monthly_method==='recurring'&&terms.initial_agorot>0&&!safeLink(terms.payment_url)))) throw Error('invalid_terms');
          if (kind === 'trial' && r.prefill) {
            ['parent_name','parent_phone','student_first_name','student_last_name','class_name','school_name'].forEach(function(key){
              var field = document.getElementById(key), value = r.prefill[key];
              if (!field || edited.has(key) || field.value || typeof value !== 'string' || !value) return;
              if (field.tagName === 'SELECT' && !Array.from(field.options).some(function(o){ return o.value === value; })) {
                if (key !== 'school_name') return;
                field.add(new Option(value, value));
              }
              field.value = value;
            });
          }
          if (terms && terms.family_enrollment && (terms.family_enrollment !== true || terms.monthly_method !== 'recurring' || terms.payment_flow !== 'separate' || terms.monthly_agorot !== 60000 || terms.family_monthly_agorot !== 120000 || terms.initial_lesson_agorot !== 15000 || typeof terms.existing_sibling_name !== 'string' || !terms.existing_sibling_name.trim() || !/^\d{4}-\d{2}-10$/.test(terms.recurring_starts_on || ''))) throw Error('invalid_family_terms');
          if (terms && terms.new_siblings) { var familyNote=document.querySelector('.payment-note'); if(familyNote) familyNote.textContent='שני אחים חדשים מצטרפים יחד: 150 ₪ לכל שיעור שנותר לכל ילד. לאחר הפרטים והחתימות של שני הילדים, יוצג תשלום משותף אחד בשלב האחרון. מהחודש הבא: 600 ₪ לילד — 1,200 ₪ למשפחה; המרכז יעדכן את הסכום ומועד החיוב ב־Grow.'; }
          if (terms && terms.monthly_agorot) {
            var price = document.querySelector('.payment-price');
            if (price) price.textContent = terms.family_enrollment ? '1,200 ₪ / לחודש לשני הילדים — מהחודש הבא' : (terms.monthly_agorot/100).toLocaleString('he-IL') + ' ₪ / לחודש — המחיר שסוכם עבורכם';
          }
          if (terms && terms.initial_lesson_agorot != null && (!Number.isInteger(terms.initial_lesson_agorot) || terms.initial_lesson_agorot<=0 || !Number.isInteger(terms.initial_lesson_count) || terms.initial_lesson_count<1 || terms.initial_lesson_agorot*terms.initial_lesson_count!==terms.initial_agorot)) throw Error('invalid_breakdown');
          if (terms && terms.unpaid_trial_agorot != null && (!Number.isInteger(terms.unpaid_trial_agorot) || terms.unpaid_trial_agorot < 0 || terms.unpaid_trial_agorot > 10000000 || (terms.unpaid_trial_agorot > 0 && terms.monthly_method !== 'cash'))) throw Error('invalid_unpaid_trial');
          if (terms && terms.new_siblings && (terms.new_siblings !== true || terms.monthly_agorot !== 120000 || terms.payment_flow !== 'recurring_initial' || !/^https:\/\/ohadmath12\.github\.io\/MyMath\/family\.html#family=[a-f0-9]{64}$/.test(terms.family_url || ''))) throw Error('invalid_family_terms');
          ready = true;
          if (window.FormPaymentStep) window.FormPaymentStep.configure(false);
          if (!terms) throw Error('missing_terms');
          resuming = r.registration_saved === true;
          var embedded = terms.new_siblings && window.parent !== window && new URLSearchParams(location.search).get('family_embed') === '1';
          if (embedded) { box.hidden=true; } else {
            render(box,true);
            var finishNote=document.createElement('p');finishNote.textContent=verified?'התשלום אושר על ידי המרכז. אין לשלם שוב; בדיקת Grow נדרשת להשלמת ההרשמה.':terms.monthly_method==='cash'?'לאחר הסדרת התשלום במזומן, לחצו על השלמת הרשמה.':'השלימו את התשלום ב־Grow, חזרו לעמוד הזה ולחצו על השלמת הרשמה. אם כבר שילמתם, אין לשלם שוב.';box.appendChild(finishNote);
          }
          if (!embedded) {
            var paymentStatus=document.createElement('p'); paymentStatus.setAttribute('role','status');box.appendChild(paymentStatus);
            var checkButton=document.createElement('button');checkButton.type='button';checkButton.className='btn btn-primary';checkButton.textContent='בדיקת התשלום';box.appendChild(checkButton);checkControls=[paymentStatus,checkButton];
            var submitButton=document.getElementById('submit-btn');
            confirmation=window.GrowConfirmation.create(kind,token,function(state,label){
              paymentStatus.textContent=label;checkButton.disabled=state.state==='checking';
              checkButton.hidden=state.can_complete===true;
              if(submitButton&&!resuming)submitButton.disabled=state.can_complete!==true;
              if(state.paid)box.querySelectorAll('a[target="_blank"]').forEach(function(a){a.hidden=true;});
            });
            checkButton.addEventListener('click',function(){confirmation.check(true);});
            var openedPayment=false;box.querySelectorAll('a[target="_blank"]').forEach(function(a){a.addEventListener('click',function(){openedPayment=true;});});
            window.addEventListener('focus',function(){if(openedPayment){openedPayment=false;confirmation.check(true);}});
            form.addEventListener('submit',function(event){if(confirmation.getState().can_complete!==true){event.preventDefault();event.stopImmediatePropagation();confirmation.check(true);}},true);
            if(submitButton&&!resuming)submitButton.disabled=true;
            confirmation.watchReturn();
          }
          if (!resuming) { form.hidden=false;form.inert=false; }
          if (r.registration_saved === true) document.dispatchEvent(new CustomEvent('registration-payment-resume',{detail:{registrationId:r.registration_id}}));
        }).catch(function () { message('לא הצלחנו לטעון את תנאי ההרשמה האישיים. רעננו את העמוד או בקשו קישור אישי חדש מהמרכז.'); });
    },
    completed: function () {
      if (saved || !terms || !ready) return;
      saved = true; box.hidden = true;
      if (terms.new_siblings && window.parent !== window && new URLSearchParams(location.search).get('family_embed') === '1') return;
      var result = document.createElement('section'); result.className='enrollment-payment-terms'; if(resuming) {render(result,true);checkControls.forEach(function(n){result.appendChild(n);});box=result;} else { var note=document.createElement('p');note.textContent='ההרשמה נשלחה. המרכז יבדוק את קבלת התשלום וישלים את הטיפול.';result.appendChild(note); } document.getElementById('success-card').appendChild(result);
      if (window.FormPaymentStep) window.FormPaymentStep.show(result);
    }
  };
})();
