(function(){
 document.querySelectorAll('input[name="parent_name"]').forEach(function(old){
  var holder=document.createElement('div');holder.className='field-grid';
  ['first','last'].forEach(function(kind){var label=document.createElement('label');label.textContent=kind==='first'?'שם פרטי של ההורה *':'שם משפחה של ההורה *';var field=document.createElement('input');field.type='text';field.name=field.id='parent_'+kind+'_name';field.required=true;field.maxLength=60;field.autocomplete=kind==='first'?'given-name':'family-name';label.appendChild(field);holder.appendChild(label);field.addEventListener('input',sync);});
  // Never guess how a compound existing full name splits. Explicit parts remain required.
  var outer=old.closest('label')||old.parentElement;outer.parentElement.insertBefore(holder,outer);old.type='hidden';old.required=false;
  var oldLabel=outer.tagName==='LABEL'?outer:outer.querySelector('label[for="parent_name"]');if(oldLabel)oldLabel.hidden=true;
  var version=document.createElement('input');version.type='hidden';version.name='parent_name_version';version.value='2';holder.appendChild(version);
  function sync(){var a=holder.querySelector('[name="parent_first_name"]'),b=holder.querySelector('[name="parent_last_name"]');old.value=(a.value.trim()+' '+b.value.trim()).trim();old.dispatchEvent(new Event('input',{bubbles:true}));}
  old.form.addEventListener('submit',function(e){sync();if(!holder.querySelector('[name="parent_first_name"]').value.trim()||!holder.querySelector('[name="parent_last_name"]').value.trim()){e.preventDefault();e.stopImmediatePropagation();holder.querySelector('input').reportValidity();}},true);
 });
})();
