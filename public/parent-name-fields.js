/* Separate required parent names; keep the existing full-name API contract. */
(function(){
 'use strict';
 document.querySelectorAll('[data-parent-name-fields]').forEach(function(holder){
  var form=holder.closest('form'),old=form.elements.namedItem('parent_name');
  var first=form.elements.namedItem('parent_first_name'),last=form.elements.namedItem('parent_last_name');
  function clean(v){return v.trim().replace(/\s+/g,' ');}
  function sync(){
   var a=clean(first.value),b=clean(last.value);
   first.setCustomValidity(a?'':'יש למלא שם פרטי של ההורה.');
   last.setCustomValidity(b?'':'יש למלא שם משפחה של ההורה.');
   if(a&&b&&a.length+b.length+1>80)last.setCustomValidity('השם המלא יכול להכיל עד 80 תווים.');
   old.value=a&&b?a+' '+b:'';
   old.dispatchEvent(new Event('input',{bubbles:true}));
  }
  first.addEventListener('input',sync);last.addEventListener('input',sync);
  first.addEventListener('change',sync);last.addEventListener('change',sync);
  // Preserve legacy prefill verbatim for reference; do not guess compound-name boundaries.
  var note=document.createElement('p');note.className='note';note.hidden=true;holder.appendChild(note);
  function showSavedName(){if(old.value&&!first.value&&!last.value){note.textContent='השם השמור: '+old.value+'. נא להזין שם פרטי ושם משפחה בשדות הנפרדים.';note.hidden=false;}}
  document.addEventListener('form-step-shown',showSavedName);
  document.addEventListener('trial-invitation-prefilled',showSavedName);
  old.addEventListener('input',showSavedName);
  form.addEventListener('submit',function(e){
   sync();var bad=[first,last].find(function(x){return !x.checkValidity();});
   if(bad){e.preventDefault();e.stopImmediatePropagation();document.dispatchEvent(new CustomEvent('reveal-form-field',{detail:bad}));bad.reportValidity();}
  },true);
  form.addEventListener('reset',function(){old.value='';first.setCustomValidity('');last.setCustomValidity('');note.hidden=true;});
 });
})();
