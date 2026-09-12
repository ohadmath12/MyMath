(function () {
  'use strict';

  /* Cloudflare validates Turnstile and applies rate limiting before forwarding
     to Apps Script. GitHub Pages gets the public endpoint from config.js. */
  var ENDPOINT = (window.MYTHEMATIX_CONFIG && window.MYTHEMATIX_CONFIG.apiEndpoint) || './api/register';

  var CONFIG = {
    contact: {
      address: 'הרי יהודה 54, גני תקווה',
      phone: '052-454-9680',
      email: 'ohadmath12@gmail.com'
    }
  };

  document.getElementById('footer-year').textContent = new Date().getFullYear();

  function renderContact() {
    var grid = document.getElementById('contact-grid');
    var items = [
      { icon: 'icon-map-pin', label: 'כתובת', value: CONFIG.contact.address },
      { icon: 'icon-phone', label: 'טלפון', value: CONFIG.contact.phone },
      { icon: 'icon-mail', label: 'דוא״ל', value: CONFIG.contact.email }
    ];

    items.forEach(function (item) {
      var el = document.createElement('div');
      el.className = 'contact-item';
      el.innerHTML =
        '<svg class="icon" aria-hidden="true"><use href="#' + item.icon + '"/></svg>' +
        '<span><strong>' + item.label + ':</strong> ' + item.value + '</span>';
      grid.appendChild(el);
    });
  }

  renderContact();

  /* ---------------- In-page navigation ----------------
     Apps Script injects this document into a cross-origin sandbox iframe via
     postMessage, so its URL (.../userCodeAppPanel) serves no content on its
     own. A plain href="#id" is therefore a real navigation, not a scroll: the
     browser reloads the bare sandbox shell, the injection never re-runs, and
     the user lands on a blank page. Scroll by hand instead and swallow the
     navigation. The href is kept in the markup for accessibility. */
  var hashLinks = document.querySelectorAll('a[href^="#"]');

  Array.prototype.forEach.call(hashLinks, function (link) {
    link.addEventListener('click', function (evt) {
      var targetId = link.getAttribute('href').slice(1);
      if (!targetId) return;

      var target = document.getElementById(targetId);
      if (!target) return;

      evt.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  /* ---------------- Signature pad ---------------- */
  var canvas = document.getElementById('signature-pad');
  var ctx = canvas.getContext('2d');
  var signatureWrap = document.getElementById('signature-wrap');
  var hasSignatureStroke = false;
  var drawing = false;
  var lastPoint = null;

  function resizeCanvas() {
    var ratio = window.devicePixelRatio || 1;
    var rect = canvas.getBoundingClientRect();
    var imageData = null;

    if (canvas.width > 0 && canvas.height > 0) {
      imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }

    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111827';

    if (imageData) {
      ctx.putImageData(imageData, 0, 0);
    }
  }

  resizeCanvas();
  window.addEventListener('resize', debounce(resizeCanvas, 200));

  function getPoint(evt) {
    var rect = canvas.getBoundingClientRect();
    var clientX = evt.touches ? evt.touches[0].clientX : evt.clientX;
    var clientY = evt.touches ? evt.touches[0].clientY : evt.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function startDraw(evt) {
    evt.preventDefault();
    drawing = true;
    lastPoint = getPoint(evt);
  }

  function moveDraw(evt) {
    if (!drawing) return;
    evt.preventDefault();
    var point = getPoint(evt);
    ctx.beginPath();
    ctx.moveTo(lastPoint.x, lastPoint.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastPoint = point;
    hasSignatureStroke = true;
    clearFieldError('signature');
  }

  function endDraw() {
    drawing = false;
    lastPoint = null;
  }

  canvas.addEventListener('mousedown', startDraw);
  canvas.addEventListener('mousemove', moveDraw);
  window.addEventListener('mouseup', endDraw);

  canvas.addEventListener('touchstart', startDraw, { passive: false });
  canvas.addEventListener('touchmove', moveDraw, { passive: false });
  canvas.addEventListener('touchend', endDraw);
  canvas.addEventListener('touchcancel', endDraw);

  document.getElementById('clear-signature').addEventListener('click', function () {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasSignatureStroke = false;
  });

  function debounce(fn, wait) {
    var timeout;
    return function () {
      clearTimeout(timeout);
      timeout = setTimeout(fn, wait);
    };
  }

  /* ---------------- Form handling ---------------- */
  var form = document.getElementById('registration-form');
  var formCard = document.getElementById('form-card');
  var submitBtn = document.getElementById('submit-btn');
  var submitBtnLabel = document.getElementById('submit-btn-label');
  var formError = document.getElementById('form-error');
  var successCard = document.getElementById('success-card');
  var successId = document.getElementById('success-id');

  var isSubmitting = false;
  var clientSubmissionId = null;
  var turnstileWidgetId = null;
  var turnstileToken = '';

  function createClientSubmissionId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return String(Date.now()) + '-' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  }

  function initializeTurnstile() {
    var siteKey = window.MYTHEMATIX_CONFIG && window.MYTHEMATIX_CONFIG.turnstileSiteKey;
    if (!siteKey || !window.turnstile) {
      showFormError('בדיקת האבטחה לא נטענה. רעננו את העמוד ונסו שוב.');
      return;
    }

    turnstileWidgetId = window.turnstile.render('#turnstile-widget', {
      sitekey: siteKey,
      action: 'registration',
      theme: 'light',
      size: 'flexible',
      callback: function (token) {
        turnstileToken = token;
        clearFieldError('turnstile');
      },
      'expired-callback': function () {
        turnstileToken = '';
      },
      'error-callback': function () {
        turnstileToken = '';
        setFieldError('turnstile', 'בדיקת האבטחה נכשלה. נסו שוב.');
      }
    });
  }

  function resetTurnstile() {
    turnstileToken = '';
    if (window.turnstile && turnstileWidgetId !== null) {
      window.turnstile.reset(turnstileWidgetId);
    }
  }

  window.addEventListener('load', initializeTurnstile);

  function clearFieldError(key) {
    var errEl = document.getElementById('err-' + key);
    if (errEl) errEl.textContent = '';

    var fieldEl = document.getElementById(key);
    if (fieldEl) fieldEl.classList.remove('invalid');

    if (key === 'signature') {
      signatureWrap.classList.remove('invalid');
    }
  }

  function setFieldError(key, message) {
    var errEl = document.getElementById('err-' + key);
    if (errEl) errEl.textContent = message;

    var fieldEl = document.getElementById(key);
    if (fieldEl) fieldEl.classList.add('invalid');

    if (key === 'signature') {
      signatureWrap.classList.add('invalid');
    }
  }

  function clearAllErrors() {
    var keys = [
      'student_first_name', 'student_last_name', 'student_id', 'student_phone', 'student_email',
      'school_name', 'class_name', 'units', 'is_science',
      'parent_role', 'parent_name', 'parent_email', 'signature', 'turnstile'
    ];
    keys.forEach(clearFieldError);
    formError.textContent = '';
    formError.classList.remove('visible');
  }

  function showFormError(message) {
    formError.textContent = message;
    formError.classList.add('visible');
  }

  function getRadioValue(name) {
    var checked = form.querySelector('input[name="' + name + '"]:checked');
    return checked ? checked.value : '';
  }

  function normalizeIsraeliMobilePhone(value) {
    var digits = String(value || '').replace(/\D/g, '');

    if (/^9725\d{8}$/.test(digits)) {
      digits = '0' + digits.substring(3);
    } else if (/^5\d{8}$/.test(digits)) {
      digits = '0' + digits;
    }

    return /^05\d{8}$/.test(digits) ? digits : '';
  }

  function normalizeIsraeliId(value) {
    var text = String(value || '').trim();
    if (/[^\d\s-]/.test(text)) return '';

    var digits = text.replace(/\D/g, '');
    if (digits.length < 5 || digits.length > 9) return '';
    digits = ('000000000' + digits).slice(-9);

    var sum = 0;
    for (var i = 0; i < digits.length; i++) {
      var product = Number(digits.charAt(i)) * (i % 2 === 0 ? 1 : 2);
      sum += product > 9 ? product - 9 : product;
    }
    return sum % 10 === 0 ? digits : '';
  }

  function validateForm() {
    var valid = true;
    var textFields = [
      'student_first_name', 'student_last_name', 'student_id', 'student_phone',
      'school_name', 'class_name', 'units', 'parent_name', 'parent_email'
    ];

    textFields.forEach(function (key) {
      var el = document.getElementById(key);
      if (!el.value || !el.value.trim()) {
        setFieldError(key, 'שדה חובה');
        valid = false;
      }
    });

    var phoneField = document.getElementById('student_phone');
    if (phoneField.value && !normalizeIsraeliMobilePhone(phoneField.value)) {
      setFieldError('student_phone', 'יש להזין מספר נייד ישראלי תקין');
      valid = false;
    }

    var studentIdField = document.getElementById('student_id');
    if (studentIdField.value && !normalizeIsraeliId(studentIdField.value)) {
      setFieldError('student_id', 'יש להזין מספר זהות ישראלי תקין');
      valid = false;
    }

    ['student_email', 'parent_email'].forEach(function (key) {
      var emailField = document.getElementById(key);
      if (emailField.value && !emailField.checkValidity()) {
        setFieldError(key, 'יש להזין כתובת דוא״ל תקינה');
        valid = false;
      }
    });

    if (!getRadioValue('is_science')) {
      setFieldError('is_science', 'שדה חובה');
      valid = false;
    }

    if (!getRadioValue('parent_role')) {
      setFieldError('parent_role', 'שדה חובה');
      valid = false;
    }

    if (!hasSignatureStroke) {
      setFieldError('signature', 'יש לחתום לפני שליחת הטופס');
      valid = false;
    }

    if (!turnstileToken) {
      setFieldError('turnstile', 'יש להשלים את בדיקת האבטחה');
      valid = false;
    }

    return valid;
  }

  function setLoadingState(loading) {
    isSubmitting = loading;
    submitBtn.disabled = loading;
    submitBtnLabel.textContent = loading ? 'שומר את ההרשמה…' : 'שליחת הרשמה';
  }

  function resetForm() {
    form.reset();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasSignatureStroke = false;
    clientSubmissionId = null;
  }

  function showSuccess(registrationId) {
    formCard.querySelector('form').style.display = 'none';
    successCard.classList.add('visible');
    successId.textContent = 'מספר הרשמה: ' + registrationId;
  }

  form.addEventListener('submit', function (evt) {
    evt.preventDefault();

    if (isSubmitting) return;

    clearAllErrors();

    if (!validateForm()) {
      showFormError('נא להשלים את כל השדות המסומנים ולוודא שהחתימה מולאה.');
      var firstInvalid = form.querySelector('.invalid, .signature-wrap.invalid');
      if (firstInvalid) {
        firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    if (!clientSubmissionId) clientSubmissionId = createClientSubmissionId();

    var payload = {
      student_first_name: document.getElementById('student_first_name').value,
      student_last_name: document.getElementById('student_last_name').value,
      student_id: normalizeIsraeliId(document.getElementById('student_id').value),
      student_phone: normalizeIsraeliMobilePhone(document.getElementById('student_phone').value),
      student_email: document.getElementById('student_email').value,
      school_name: document.getElementById('school_name').value,
      class_name: document.getElementById('class_name').value,
      is_science: getRadioValue('is_science'),
      units: document.getElementById('units').value,
      parent_role: getRadioValue('parent_role'),
      parent_name: document.getElementById('parent_name').value,
      parent_email: document.getElementById('parent_email').value,
      signature_data_url: canvas.toDataURL('image/png'),
      honeypot: document.getElementById('hp-field').value,
      client_submission_id: clientSubmissionId,
      turnstile_token: turnstileToken
    };

    setLoadingState(true);

    fetch(ENDPOINT, {
      method: 'POST',
      // text/plain keeps the GitHub Pages request CORS-simple; the Worker still
      // parses and validates the body as JSON.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        return res.json();
      })
      .then(function (response) {
        setLoadingState(false);
        if (response && response.ok) {
          resetForm();
          showSuccess(response.registrationId);
        } else {
          resetTurnstile();
          showFormError('לא הצלחנו לשמור את ההרשמה. נסו שוב בעוד מספר רגעים.');
        }
      })
      .catch(function () {
        setLoadingState(false);
        resetTurnstile();
        showFormError('לא הצלחנו לשמור את ההרשמה. נסו שוב בעוד מספר רגעים.');
      });
  });
})();
