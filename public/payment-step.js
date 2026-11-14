/* A presentation-only final step. Never creates a payment or changes paid state. */
(function () {
  'use strict';
  var enabled = false;
  function progress(final) {
    var original = document.querySelector('form .form-progress');
    if (!original) return null;
    var bar = final ? original.cloneNode(true) : original;
    var item = bar.querySelector('[data-payment-step]');
    if (enabled && !item) {
      item = document.createElement('li'); item.setAttribute('data-payment-step', '');
      var number = document.createElement('span'); number.textContent = bar.children.length + 1;
      item.appendChild(number); item.appendChild(document.createTextNode('תשלום מאובטח')); bar.appendChild(item);
    }
    if (!enabled && item) item.remove();
    if (final) {
      bar.hidden = false;
      Array.from(bar.children).forEach(function (li) {
        li.removeAttribute('aria-current');
        li.classList.toggle('complete', li !== item);
      });
      if (item) item.setAttribute('aria-current', 'step');
    }
    return bar;
  }
  window.FormPaymentStep = {
    configure: function (value) { enabled = !!value; progress(false); },
    show: function (container) {
      if (!enabled || !container || !container.querySelector('a[href]')) return;
      var bar = progress(true);
      var heading = document.createElement('h2'); heading.textContent = 'ממשיכים לתשלום מאובטח';
      var note = document.createElement('p'); note.className = 'payment-step-saved';
      note.textContent = 'הפרטים נשמרו בהצלחה. נשאר להסדיר את התשלום לפי הסכום שסוכם.';
      container.classList.add('payment-wizard-final');
      container.setAttribute('tabindex', '-1'); container.setAttribute('aria-label', 'תשלום מאובטח');
      container.prepend(note); container.prepend(heading); if (bar) container.prepend(bar);
      var success = document.getElementById('success-card');
      if (success && success.contains(container)) Array.from(success.children).forEach(function (child) { if (child !== container) child.hidden = true; });
      container.hidden = false; container.focus({preventScroll:true}); container.scrollIntoView({block:'start',behavior:'smooth'});
    }
  };
  document.addEventListener('form-step-shown', function () { progress(false); });
})();
