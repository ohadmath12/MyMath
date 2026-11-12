import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../public/trial/invitation.js',import.meta.url),'utf8');
class Element{constructor(tag){this.tag=tag;this.children=[]}replaceChildren(){this.children=[]}append(e){this.children.push(e)}}
const container=new Element('div'),window={};let requests=0;
vm.runInNewContext(source,{window,document:{getElementById:()=>container,createElement:t=>new Element(t)},location:{hash:''},URL,URLSearchParams,Intl,fetch:()=>{requests++;throw Error('not allowed')}});
window.showPersonalTrialPayment({amount_agorot:12000,payment_method:'cash',paid:false,payment_url:'https://pay.grow.link/stale'});
assert.equal(container.children.length,1);assert.match(container.children[0].textContent,/120/);assert.match(container.children[0].textContent,/במזומן/);assert.ok(!container.children[0].textContent.includes('אינו זמין'));
window.showPersonalTrialPayment({amount_agorot:12000,payment_method:'cash',paid:true});assert.match(container.children[0].textContent,/כבר תועד/);
window.showPersonalTrialPayment({amount_agorot:12000,payment_method:'grow',paid:false,payment_url:'https://pay.grow.link/fixture'});assert.equal(container.children[1].tag,'a');
assert.equal(requests,0);console.log('PASS: cash trial has no checkout, retains unpaid status, existing Grow flow preserved');
