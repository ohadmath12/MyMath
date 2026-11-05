// Verify the dedicated native project before replacing either maintained file.
// This guard logs hashes only; it never exports native source or credentials.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const dir=process.argv[2],base='beeb0bfb8dbc7ce3476a6cc504963d6dca55509e';
const normalize=s=>s.replace(/\r\n/g,'\n').trim();
const hash=s=>crypto.createHash('sha256').update(normalize(s)).digest('hex');
const old=file=>cp.execFileSync('git',['show',base+':'+file],{encoding:'utf8'});
const mappings=[{name:'MarathonForm',ext:'.gs',files:['marathon-script/Intake.gs','marathon-script/Admin.gs']},{name:'MarathonAdmin',ext:'.html',files:['marathon-script/Admin.html']},{name:'קוד',ext:'.gs',files:['marathon-script/Tracker.gs']}];
const verified=JSON.parse(fs.readFileSync('marathon-script/verified-native-hashes.json','utf8'));
const names=fs.readdirSync(dir).filter(n=>/\.(gs|js|html|json)$/.test(n)&&n!=='.clasp.json');
if(names.some(n=>!['MarathonForm','MarathonAdmin','קוד','appsscript'].includes(path.parse(n).name)))throw Error('Unexpected native file; inspect before publishing.');
for(const item of mappings){const matches=names.filter(n=>path.parse(n).name===item.name);if(matches.length!==1)throw Error('Missing or ambiguous native file '+item.name);const filename=path.join(dir,matches[0]),remote=fs.readFileSync(filename,'utf8');const original=item.files.map(old);const updated=item.files.map(f=>fs.readFileSync(f,'utf8'));
 const known=[...['\n','\n\n',''].map(sep=>original.join(sep)),...['\n','\n\n',''].map(sep=>updated.join(sep))];
 const matched=hash(remote)===verified[item.name]||known.some(s=>normalize(s)===normalize(remote));console.log(item.name+': '+(matched?'verified':'MISMATCH')+' sha256='+hash(remote));
 if(!matched){console.log('Known baseline hashes: '+['\n','\n\n',''].map(sep=>hash(original.join(sep))).join(','));throw Error('Native source changed; refusing to overwrite '+item.name);}
 if(process.env.MARATHON_MODE==='publish'&&item.name!=='קוד')fs.writeFileSync(filename,updated.join('\n'));
}
const manifest=fs.readFileSync(path.join(dir,'appsscript.json'),'utf8');if(hash(manifest)!==verified.appsscript)throw Error('Native manifest changed; inspect access settings before publishing.');
console.log('Native sources verified. Existing manifest and tracker retained.');
