/* Isolated read-only gallery: production scripts never enter the sandbox.
   No tokens, provider URLs, API calls, form submission, or persistent form data. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const sources = {individual:'../index.html',family:'../index.html',sibling:'../index.html',inquiry:'../inquiry/index.html',lead:'../lead/index.html',trial:'../trial/index.html',marathon:'../marathons/index.html'};
  const cache = new Map(); let pages = [], styles = '', bodyClass = '', current = 0, generation = 0;
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const markup = nodes => nodes.filter(Boolean).map(n => n.outerHTML).join('');
  const card = (title, text, button) => `<section class="form-group"><h2>${escape(title)}</h2><p>${escape(text)}</p>${button?`<button type="button" class="btn btn-primary">${escape(button)}</button>`:''}</section>`;
  function payment(family=false) {
    const cash=$('route').value==='cash';
    if (family && !cash) return `<section id="family-payment"><h2>שלב 3 — תשלום והשלמת הרשמה</h2><section id="family-terms"><h3>יתרת חודש — 300 ₪</h3><p>מחיר חודשי להמשך — 1,200 ₪ לשני הילדים, החל מ־10/12/2026.</p></section><p>הפרטים והחתימות של שני הילדים שמורים. תשלום אחד, והרשמה אוטומטית לשניהם — בלי לשלוח שוב את הטפסים.</p><button type="button" id="family-complete">לתשלום ולהשלמת ההרשמה</button></section>`;

    if ($('form').value === 'individual' && $('route').value === 'advance') return `<section id="enrollment-checkout"><h3 class="checkout-first-amount">חיוב ראשון — 1 ₪</h3><p>מחיר חודשי להמשך — 650 ₪ החל מ־10/12/2026.</p></section><button type="button" id="submit-btn">לתשלום ולהשלמת ההרשמה</button>`;
    if ($('form').value === 'individual' && $('route').value === 'recurring') {
      // Synthetic example; wording mirrors the new-registration render path.

      return `<section id="enrollment-checkout" class="enrollment-payment-terms"><h3 class="checkout-first-amount">יתרת חודש — 480 ₪</h3><p>מחושב בהתאם למספר השיעורים שנותרו בחודש.</p><p>מחיר חודשי להמשך — 650 ₪ החל מ־10/12/2026.</p></section><div class="submit-row"><button type="button" id="submit-btn" class="btn btn-primary">לתשלום ולהשלמת ההרשמה</button></div>`;
    }

    if ($('form').value === 'sibling' && !cash) return `<section id="enrollment-checkout" class="enrollment-payment-terms"><h3>יתרת חודש — 450 ₪</h3><p>מחושב בהתאם למספר השיעורים שנותרו בחודש.</p><p>תשלום חד־פעמי עבור האח המצטרף.</p><p>מהחודש הבא המחיר החודשי לשני הילדים יחד יתעדכן ל־1,200 ₪, החל מ־10/12/2026.</p></section><button type="button" class="btn btn-primary">לתשלום ולהשלמת ההרשמה</button>`;
    const text=cash?'מסלול מזומן: השלמת פרטים וחתימה. התשלום מתואם בנפרד עם המרכז.':$('form').value==='sibling'?'תשלום חד־פעמי עבור השיעורים שנותרו לאח המצטרף.':$('route').value==='advance'?'התשלום הראשון עבור החודש הבא במלואו.':family?'תשלום משותף לשני הילדים, בהתאם לתנאים האישיים.':'התשלום הראשון עבור החודש שנבחר, בהתאם לתנאים האישיים.';
    return card('תשלום והשלמת הרשמה',text,cash?'השלמת ההרשמה':'לתשלום ולהשלמת ההרשמה');
  }
  async function load() {
    const revision=++generation, kind=$('form').value, enrollment=['individual','family','sibling'].includes(kind);
    $('route').disabled=!enrollment; $('note').textContent='טוענים את שדות הטופס…';
    try {
      const url=new URL(sources[kind],location.href);
      if(!cache.has(url.href)){const response=await fetch(url,{credentials:'omit'});if(!response.ok)throw Error('load');cache.set(url.href,await response.text());}
      if(revision!==generation)return;
      const doc=new DOMParser().parseFromString(cache.get(url.href),'text/html');
      // Remove every executable/network-bearing element before serialization.
      doc.querySelectorAll('script,iframe,object,embed,base,meta,link:not([rel=stylesheet]),#form-loading-screen').forEach(n=>n.remove());
      doc.querySelectorAll('*').forEach(n=>{for(const a of [...n.attributes])if(/^on/i.test(a.name)||['action','formaction','srcset'].includes(a.name))n.removeAttribute(a.name);});
      doc.querySelectorAll('a').forEach(n=>{n.removeAttribute('href');n.removeAttribute('target');});
      doc.querySelectorAll('input,textarea').forEach(n=>{n.removeAttribute('value');n.removeAttribute('checked');n.setAttribute('autocomplete','off');if(n.tagName==='TEXTAREA')n.textContent='';});
      doc.querySelectorAll('button').forEach(n=>{n.type='button';n.disabled=false;});
      doc.querySelectorAll('[src]').forEach(n=>{const asset=new URL(n.getAttribute('src'),url);if(asset.origin===location.origin)n.setAttribute('src',asset.href);else n.removeAttribute('src');});
      styles=[...doc.querySelectorAll('link[rel=stylesheet]')].map(n=>new URL(n.getAttribute('href'),url)).filter(u=>u.origin===location.origin&&!u.pathname.endsWith('/apple-forms.css')).map(u=>`<link rel="stylesheet" href="${escape(u.href)}">`).join('');
      bodyClass=doc.body.className;
      const form=doc.querySelector('form'), groups=[...form.querySelectorAll('.form-group')], section=id=>doc.getElementById(id);
      if(enrollment){
        const price=doc.querySelector('.payment-price');if(price)price.textContent='המחיר האישי יופיע בטופס ההורה';
        const contact=section('contact');if(contact)contact.appendChild(Object.assign(doc.createElement('p'),{textContent:'052-835-9521'}));
        const child=[['על התוכנית',markup([section('program'),section('contact')])],['פרטי הורה',markup([groups[2]])],['פרטי תלמיד',markup([groups[0],groups[1]])],['תקנון וחתימה',markup([section('terms'),groups[3]])]];
        pages=kind==='family'?[...child.map(([t,h])=>['ילד 1 · '+t,h]),...child.map(([t,h])=>['ילד 2 · '+t,h])]:child;
        pages.push(['תשלום והשלמת הרשמה',payment(kind==='family')]);
        if($('route').value!=='cash')pages.push(['ממתינים לאישור',card('ממתינים לאישור התשלום','המחשה בלבד: לאחר תשלום מוצלח ההרשמה מושלמת אוטומטית.')]);
        pages.push(['הצלחה',card('תודה, הרשמתכם התקבלה',kind==='family'?'המחשה בלבד: ההרשמה הושלמה עבור שני הילדים.':'המחשה בלבד: ההרשמה הושלמה.')]);
      }else{
        if(kind==='trial'){const fields=[...form.querySelector('.grid').children];pages=[['פרטי הורה',markup(fields.slice(4))],['פרטי תלמיד',markup(fields.slice(0,4))],['אישור ושליחה',markup([...form.querySelectorAll('.note,#submit')])]];}
        else pages=[['פרטי הורה',markup([groups[0]])],['פרטי תלמיד',markup([groups[1]])],['אישור ושליחה',markup([form.querySelector('.submit-row')])]];
        if(['trial','marathon'].includes(kind))pages.push(['תשלום',card('ממשיכים לתשלום מאובטח','המחשה בלבד: כאן מוצג הקישור בהתאם למחיר שסוכם.','לתשלום מאובטח')]);
        pages.push(['הצלחה',card('הפרטים התקבלו','המחשה בלבד — לא נשלחו פרטים מהתצוגה הזו.')]);
      }
      $('note').textContent='שדות ונוסחים מתוך הטפסים הקיימים; מסכי התשלום והסטטוס הם המחשה ללא פרטי לקוחות או סכומים אישיים. לחתימה ולכפתורי הטופס אין פעולת שליחה. ביחיד בהוראת קבע: דוגמה בלבד — 480 ₪ לנובמבר 2026, 650 ₪ להמשך מ־10/12/2026.';
      show(Math.min(current,pages.length-1));
    }catch(error){ console.error('Review rendering:',error); $('note').textContent='לא הצלחנו לטעון את הטופס. רענן את העמוד ונסה שוב.'; }
  }
  function show(index){
    current=index;const [title,html]=pages[index];
    $('steps').replaceChildren(...pages.map(([name],i)=>{const b=document.createElement('button');b.type='button';b.textContent=name;if(i===index)b.setAttribute('aria-current','step');b.onclick=()=>show(i);return b;}));
    const policy="default-src 'none'; style-src "+location.origin+"; img-src "+location.origin+" data:; font-src "+location.origin+"; script-src 'none'; connect-src 'none'; form-action 'none'; base-uri 'none'";
    $('preview').srcdoc=`<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${escape(policy)}">${styles}${$('design').value==='apple'?`<link rel="stylesheet" href="${escape(new URL('apple.css',location.href).href)}">`:''}<link rel="stylesheet" href="${escape(new URL('frame.css',location.href).href)}"></head><body class="${escape(bodyClass)}"><main><div class="review-label">בקרה בלבד · ${escape(title)}</div><form>${html}</form></main></body></html>`;
    $('previous').disabled=index===0;$('next').disabled=index===pages.length-1;$('position').textContent=`${index+1} / ${pages.length}`;
    history.replaceState(null,'','#'+new URLSearchParams({form:$('form').value,route:$('route').value,step:String(index+1),width:$('width').value,design:$('design').value}));
  }
  const params=new URLSearchParams(location.hash.slice(1));
  for(const id of ['form','route','width','design'])if([...$(id).options].some(o=>o.value===params.get(id)))$(id).value=params.get(id);
  current=Math.max(0,(parseInt(params.get('step'),10)||1)-1);
  $('form').onchange=()=>{current=0;load();};$('route').onchange=load;
  $('width').onchange=()=>{$('viewport').classList.toggle('mobile',$('width').value==='mobile');if(pages.length)show(current);};$('width').onchange();
  $('design').onchange=()=>{if(pages.length)show(current);};
  $('previous').onclick=()=>show(current-1);$('next').onclick=()=>show(current+1);
  $('copy').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);$('note').textContent='הקישור לשלב הועתק. אפשר לצרף אותו להערות שלך.';}catch{$('note').textContent='אפשר להעתיק את כתובת העמוד משורת הכתובת.';}};
  load();
})();
