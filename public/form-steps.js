/* Presentation only: existing submission handlers and payloads remain authoritative. */
(() => {
  'use strict';
  const form = document.querySelector('#registration-form, #trial-form, #lead-form');
  if (!form) return;
  const inquiry = form.id === 'lead-form';
  const trial = form.id === 'trial-form' || inquiry;
  const pages = [];
  const titles = inquiry ? ['פרטי הורה', 'פרטי תלמיד', 'אישור ושליחה'] : trial ? ['פרטי הורה', 'פרטי תלמיד', 'אישור ושליחה'] : ['על התוכנית', 'פרטי הורה', 'פרטי תלמיד', 'תקנון וחתימה'];
  const add = nodes => {
    const section = document.createElement('section');
    section.className = 'wizard-page';
    section.tabIndex = -1;
    section.setAttribute('aria-label', titles[pages.length]);
    nodes.forEach(node => section.append(node));
    form.append(section); pages.push(section);
  };
  if (inquiry) {
    const groups=[...form.querySelectorAll('.form-group')];
    add([groups[0]]);add([groups[1]]);add([form.querySelector('.submit-row')]);
  } else if (trial) {
    const grid = form.querySelector('.grid');
    const labels = [...grid.children];
    add(labels.slice(4)); add(labels.slice(0,4)); grid.remove();
    add([...form.querySelectorAll('.note, #turnstile, #submit')]);
  } else {
    const groups = [...form.querySelectorAll('.form-group')];
    add([document.getElementById('program'), document.getElementById('payment'), document.getElementById('contact')]);
    pages[0].classList.add('program-step');
    add([groups[2]]); add([groups[0], groups[1]]);
    add([document.getElementById('terms'), groups[3], form.querySelector('.submit-row')]);
    const main = document.querySelector('main');
    main.prepend(document.getElementById('registration-section'));

  }
  const progress = document.createElement('ol'); progress.className = 'form-progress'; progress.setAttribute('aria-label','שלבי ההרשמה');
  titles.forEach((title,index) => {const li=document.createElement('li'); const n=document.createElement('span'); n.textContent=index+1;li.append(n,document.createTextNode(title));progress.append(li);});
  form.prepend(progress);
  // Personal-link prefill requires a visible security widget before step one.
  if (!trial) form.append(document.getElementById('turnstile-widget'));
  const nav=document.createElement('div');nav.className='step-navigation';
  const back=document.createElement('button');back.type='button';back.textContent='חזרה';back.className='step-back';
  const next=document.createElement('button');next.type='button';next.textContent='המשך לשלב הבא';next.className='step-next';
  nav.append(back,next);form.append(nav);
  let current=0, personalReview=false;
  function reviewPersonalDetails(){
    if(!trial||!window.trialInvitePrefilled)return;
    personalReview=true;current=pages.length-1;
    pages.forEach(page=>page.hidden=false);progress.hidden=true;nav.hidden=true;
    document.dispatchEvent(new Event('form-step-shown'));
  }
  document.addEventListener('trial-invitation-prefilled',reviewPersonalDetails);
  function show(index,focus=true){
    if(personalReview)return;
    next.textContent = !trial && index === 0 ? 'ממשיכים להרשמה' : 'המשך לשלב הבא';
    current=index; pages.forEach((page,i)=>page.hidden=i!==index);
    [...progress.children].forEach((li,i)=>{li.classList.toggle('complete',i<index);if(i===index)li.setAttribute('aria-current','step');else li.removeAttribute('aria-current');});
    back.hidden=index===0;next.hidden=index===pages.length-1;
    document.dispatchEvent(new Event('form-step-shown'));
    if(focus){pages[index].focus({preventScroll:true});progress.scrollIntoView({block:'start',behavior:'smooth'});}
  }
  function valid(){
    for(const input of pages[current].querySelectorAll('input,select,textarea')){
      if(!input.checkValidity()){input.reportValidity();return false;}
    } return true;
  }
  next.addEventListener('click',()=>{if(valid())show(current+1);});
  back.addEventListener('click',()=>show(current-1));
  form.addEventListener('submit',event=>{
    if(current<pages.length-1){event.preventDefault();event.stopImmediatePropagation();if(valid())show(current+1);}
  },true);
  form.addEventListener('invalid',event=>{const index=pages.findIndex(page=>page.contains(event.target));if(index>=0&&index!==current)show(index,false);},true);
  document.addEventListener('reveal-form-field',event=>{const index=pages.findIndex(page=>page.contains(event.detail));if(index>=0)show(index,false);});
  show(0,false);reviewPersonalDetails();
})();
