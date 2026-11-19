import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../public/family.js',import.meta.url),'utf8');
class Element{constructor(){this.hidden=true;this.children=[];this.events={};this.style={};this.contentWindow={};}set textContent(v){this.text=v;this.children=[]}get textContent(){return this.text}appendChild(v){this.children.push(v)}setAttribute(k,v){this[k]=v}removeAttribute(k){delete this[k]}addEventListener(k,fn){this.events[k]=fn}focus(){}}
async function scenario(result){const nodes={};const document={getElementById:id=>nodes[id]??=(new Element()),createElement:()=>new Element()};const events={};let calls=0;const window={ENROLLMENT_PAYMENT_CONFIG:{url:'https://example.invalid',key:'mock'},addEventListener:(k,f)=>events[k]=f};vm.runInNewContext(source,{document,window,location:{hash:'#family='+'f'.repeat(64),origin:'https://example.invalid'},URLSearchParams,sessionStorage:{getItem:()=>null,setItem(){}},fetch:async()=>{calls++;return {ok:true,json:async()=>result}}});await new Promise(r=>setTimeout(r,0));return {nodes,events,calls};}
const data={ok:true,children:[{name:'Child A',token:'a'.repeat(64),lessons:1,completed:false},{name:'Child B',token:'b'.repeat(64),lessons:1,completed:false}],initial_agorot:30000,monthly_agorot:120000,recurring_starts_on:'2026-12-10',payment_url:'https://pay.grow.link/mock'};
const s=await scenario(data);assert.equal(s.nodes['family-payment'],undefined);assert.match(s.nodes['child-form'].src,/#lead=a{64}$/);assert.equal(s.nodes['family-next'].hidden,true);
const emit=(origin,source,token)=>s.events.message({origin,source,data:{type:'mythematix-family-child-saved',token}});
emit('https://evil.invalid',s.nodes['child-form'].contentWindow,data.children[0].token);assert.equal(s.nodes['family-next'].hidden,true);
emit('https://example.invalid',{},data.children[0].token);assert.equal(s.nodes['family-next'].hidden,true);
emit('https://example.invalid',s.nodes['child-form'].contentWindow,data.children[1].token);assert.equal(s.nodes['family-next'].hidden,true);
emit('https://example.invalid',s.nodes['child-form'].contentWindow,data.children[0].token);assert.equal(s.nodes['family-next'].hidden,false);s.nodes['family-next'].events.click();assert.match(s.nodes['child-form'].src,/#lead=b{64}$/);assert.equal(s.nodes['family-payment'],undefined);
emit('https://example.invalid',s.nodes['child-form'].contentWindow,data.children[1].token);s.nodes['family-next'].events.click();assert.equal(s.nodes['family-payment'].hidden,false);assert.equal(s.nodes['family-pay'].href,data.payment_url);assert.equal(s.calls,1);
for(const invalid of [{...data,initial_agorot:15000},{...data,payment_url:'https://evil.invalid'},{ok:false}]){const s=await scenario(invalid);assert.equal(s.nodes['family-payment'],undefined);assert.match(s.nodes['family-status'].textContent,/לא ניתן לטעון/);}
console.log('PASS: both saved children required before shared checkout; foreign-origin, wrong-frame and wrong-child events ignored; inconsistent sums rejected; no charge or registration requests');
