import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const loader=source.slice(source.indexOf('  async function loadLeadPrefill'),source.indexOf('  function createClientSubmissionId'));
function setup(response,edited=[]) {
 const fields={};for(const key of ['parent_name','parent_phone','parent_email','student_first_name','student_last_name','class_name','school_name'])fields[key]={value:'',tagName:'INPUT'};
 fields.school_name={value:'',tagName:'SELECT',options:[],add(option){this.options.push(option);}};
 let resets=0,request;
 const ctx=vm.createContext({document:{getElementById:key=>fields[key]},editedPrefillFields:new Set(edited),prefillNotice:{},prefillState:'pending',turnstileToken:'old',leadToken:'a'.repeat(64),ENDPOINT:'https://example.test/api/register',AbortSignal,Option:function(text,value){this.text=text;this.value=value;},fetch:async(url,options)=>{request={url,options};return response;},resetTurnstile:()=>resets++});
 vm.runInContext(loader,ctx);return {ctx,fields,run:()=>vm.runInContext("loadLeadPrefill('challenge')",ctx),resets:()=>resets,request:()=>request};
}
test('fills stored fields, preserves edits, supports free-text schools, never fills consent',async()=>{
 const t=setup({ok:true,json:async()=>({ok:true,fields:{student_first_name:'בן',student_last_name:'בהיר',school_name:'בית ספר אחר',parent_phone:'0500000000',signature:'forged'}})},['parent_phone']);
 t.fields.student_last_name.value='User edit';await t.run();assert.equal(t.fields.student_first_name.value,'בן');assert.equal(t.fields.student_last_name.value,'User edit');assert.equal(t.fields.parent_phone.value,'');assert.equal(t.fields.school_name.value,'בית ספר אחר');assert.equal(t.fields.school_name.options.length,1);assert.equal(t.ctx.prefillState,'ready');assert.equal(t.resets(),1);assert.equal(t.request().url,'https://example.test/api/registration-prefill');assert.equal(t.request().options.cache,'no-store');assert.equal(t.fields.signature,undefined);
});
test('failed/expired links show an actionable message and block conversion submission',async()=>{
 const t=setup({ok:false,json:async()=>({ok:false})});await t.run();assert.equal(t.ctx.prefillState,'failed');assert.match(t.ctx.prefillNotice.textContent,/קישור אישי חדש/);assert.equal(t.resets(),1);assert.match(source,/leadToken && prefillState !== 'ready'/);
});
