(function () {
  'use strict';
  var terms = null, ready = true, box, saved = false;
  var edited = new Set();
  function message(text) { if (box) { box.textContent = text; box.hidden = false; } }
  function safeLink(value) {
    try { var u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && /(^|\.)(grow\.link|meshulam\.co\.il|grow\.business)$/.test(u.hostname); } catch (e) { return false; }
  }
  function render(target, paymentButton) {
    target.textContent = '';
    var title = document.createElement('h3'); title.textContent = 'תנאי התשלום שסוכמו עבורכם'; target.appendChild(title);
    var line = document.createElement('p');
    var amount = (terms.initial_agorot / 100).toLocaleString('he-IL', {style:'currency',currency:'ILS'});
    line.textContent = 'יתרת חודש ' + terms.service_month.slice(0,7).split('-').reverse().join('/') + ': ' + amount + '. הסכום מתייחס לשיעורים שנותרו לאחר הניסיון; תשלום הניסיון נפרד.';
    target.appendChild(line);
    if (terms.initial_lesson_agorot != null) {
      var breakdown = document.createElement('p');
      breakdown.textContent = 'מחיר מיוחד לחודש הראשון בלבד: ' + terms.initial_lesson_count + ' שיעורים × ' + (terms.initial_lesson_agorot/100).toLocaleString('he-IL') + ' ₪ = ' + amount + '. שיעור הניסיון אינו כלול.';
      target.appendChild(breakdown);
    }
    if (terms.monthly_agorot) {
      var monthly = document.createElement('p');
      monthly.textContent = 'החל מהחודש הבא — מחיר חודשי מוסכם: ' + (terms.monthly_agorot / 100).toLocaleString('he-IL', {style:'currency',currency:'ILS'}) + (terms.sibling_discount ? ' · מחיר אחים' : '') + '.';
      target.appendChild(monthly);
      if (terms.monthly_method === 'recurring' && terms.recurring_starts_on) {
        var start = document.createElement('p'); start.textContent = 'מועד תחילת הוראת הקבע המתוכנן: ' + terms.recurring_starts_on.split('-').reverse().join('/') + '. הקמתה תאושר בנפרד.'; target.appendChild(start);
      }
    }
    var method = document.createElement('p');
    method.textContent = terms.monthly_method === 'cash' ? 'סוכם על תשלום חודשי במזומן. אין צורך להקים הוראת קבע. התשלום יתואם מול המרכז.' : 'הוראת הקבע לחודשים הבאים תוסדר בנפרד. הקישור כאן מיועד לתשלום חד־פעמי ליתרת החודש בלבד.';
    target.appendChild(method);
    if (paymentButton && terms.initial_agorot > 0 && terms.monthly_method !== 'cash' && safeLink(terms.payment_url)) {
      var a = document.createElement('a'); a.href = terms.payment_url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.className = 'btn btn-primary'; a.textContent = 'לתשלום מאובטח ב־Grow · ' + amount; target.appendChild(a);
      var note = document.createElement('p'); note.textContent = 'אם כבר שילמתם, אין לשלם שוב. פתיחת הקישור או השלמת ההרשמה אינן אישור שהתקבל תשלום.'; target.appendChild(note);
    }
  }
  window.EnrollmentPayment = {
    init: function (kind, token) {
      if (!token) return;
      ready = false;
      var form = document.querySelector('form');
      form.addEventListener('input', function(e){ edited.add(e.target.id); });
      form.addEventListener('change', function(e){ edited.add(e.target.id); });
      box = document.createElement('section'); box.className = 'enrollment-payment-terms'; box.setAttribute('aria-live','polite');
      // Outside the step containers so the agreed terms remain visible before submission.
      form.parentNode.insertBefore(box, form);
      message('טוענים את תנאי התשלום האישיים…');
      form.addEventListener('submit', function (e) { if (!ready) { e.preventDefault(); e.stopImmediatePropagation(); message('תנאי התשלום האישיים טרם נטענו. רעננו את העמוד לפני ההרשמה.'); } }, true);
      var c = window.ENROLLMENT_PAYMENT_CONFIG;
      fetch(c.url + '/rest/v1/rpc/registration_payment_terms', {method:'POST',headers:{'Content-Type':'application/json',apikey:c.key},body:JSON.stringify({kind:kind,token:token})})
        .then(function (r) { if (!r.ok) throw Error('terms_failed'); return r.json(); })
        .then(function (r) {
          if (!r.ok) throw Error('invalid_link');
          terms = r.terms;
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
          if (terms && terms.monthly_agorot) {
            var price = document.querySelector('.payment-price');
            if (price) price.textContent = (terms.monthly_agorot/100).toLocaleString('he-IL') + ' ₪ / לחודש — המחיר שסוכם עבורכם';
          }
          if (terms && terms.initial_lesson_agorot != null && (!Number.isInteger(terms.initial_lesson_agorot) || terms.initial_lesson_agorot<=0 || !Number.isInteger(terms.initial_lesson_count) || terms.initial_lesson_count<1 || terms.initial_lesson_agorot*terms.initial_lesson_count!==terms.initial_agorot)) throw Error('invalid_breakdown');
          ready = true;
          if (terms) render(box,false); else box.hidden=true;
        }).catch(function () { message('לא הצלחנו לטעון את תנאי ההרשמה האישיים. רעננו את העמוד או בקשו קישור אישי חדש מהמרכז.'); });
    },
    completed: function () {
      if (saved || !terms || !ready) return;
      saved = true; box.hidden = true;
      var result = document.createElement('section'); result.className='enrollment-payment-terms'; render(result,true); document.getElementById('success-card').appendChild(result);
    }
  };
})();
