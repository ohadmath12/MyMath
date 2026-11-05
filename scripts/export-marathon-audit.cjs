// Read-only, encrypted source snapshot for the workspace that owns the private key.
// Credentials and Apps Script properties are never included.
const fs=require('node:fs'),path=require('node:path'),c=require('node:crypto'),zlib=require('node:zlib');
const dir=process.argv[2],files={};
for(const n of fs.readdirSync(dir)){if(n!=='.clasp.json'&&/\.(gs|js|html|json)$/.test(n))files[n]=fs.readFileSync(path.join(dir,n),'utf8');}
const key=c.randomBytes(32),iv=c.randomBytes(12),cipher=c.createCipheriv('aes-256-gcm',key,iv),data=Buffer.concat([cipher.update(zlib.gzipSync(JSON.stringify(files))),cipher.final()]);
const wrapped=c.publicEncrypt({key:fs.readFileSync('.github/marathon-audit-public.pem'),oaepHash:'sha256'},key);
const bundle=Buffer.from(JSON.stringify({key:wrapped.toString('base64'),iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')})).toString('base64');
if(bundle.length>60000)throw Error('Encrypted snapshot exceeds annotation size');
const parts=bundle.match(/.{1,2500}/g);parts.forEach((part,i)=>console.log('::notice title=Encrypted marathon source '+String(i+1).padStart(3,'0')+' of '+parts.length+'::'+part));
