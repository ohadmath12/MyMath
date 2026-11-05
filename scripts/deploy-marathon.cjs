// Preserve each existing deployment's distinct access configuration.
// Credentials stay in the runner and are used only with the Google API.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const dir=process.argv[2],scriptId='10yjfPOG85mOasZ9Yoma3qXio6PQq_IsKNWnASjo44haCgH0VFdmkniBe';
const targets=[{name:'manager',id:'AKfycbxAv_dxmYYQAsVqjdci3cPqjXmbgLAy_pCx7nkSkYc_sScoTIS2ud5Hv7wEeq-BHg16_A',access:'MYSELF'},{name:'intake',id:'AKfycbwb0mJBIoLu-aEbWJ528FtYouI0WV6W0rZJ0HRtoPqeAZAqBHYBWhDnPiL4vMgfgdP-jw',access:'ANYONE_ANONYMOUS'}];
async function getDeployment(id){const saved=JSON.parse(fs.readFileSync(path.join(os.homedir(),'.clasprc.json'))),auth=saved.tokens?.default||saved.token||saved;if(!auth.access_token)throw Error('Publishing credential unavailable');const r=await fetch('https://script.googleapis.com/v1/projects/'+scriptId+'/deployments/'+id,{headers:{Authorization:'Bearer '+auth.access_token}});if(!r.ok)throw Error('Cannot read deployment metadata: HTTP '+r.status);return r.json();}
function config(d){const web=d.entryPoints?.find(e=>e.entryPointType==='WEB_APP')?.webApp;if(!web)throw Error('Missing existing web app');return web;}
function clasp(args){cp.execFileSync('clasp',args,{cwd:dir,stdio:'inherit'});}
(async()=>{
 const before=[];for(const target of targets){const d=await getDeployment(target.id),web=config(d);if(web.entryPointConfig.access!==target.access||web.entryPointConfig.executeAs!=='USER_DEPLOYING')throw Error('Unexpected access configuration for '+target.name);before.push({target,web});}
 const manifestFile=path.join(dir,'appsscript.json'),original=JSON.parse(fs.readFileSync(manifestFile,'utf8')),result={};
 for(const {target,web} of before){const manifest={...original,webapp:{...original.webapp,...web.entryPointConfig}};fs.writeFileSync(manifestFile,JSON.stringify(manifest,null,2)+'\n');clasp(['push','--force']);clasp(['deploy','--deploymentId',target.id,'--description','general marathon '+target.name+' '+process.env.GITHUB_SHA.slice(0,7)]);const updated=await getDeployment(target.id),actual=config(updated);if(actual.url!==web.url||actual.entryPointConfig.access!==web.entryPointConfig.access||actual.entryPointConfig.executeAs!==web.entryPointConfig.executeAs)throw Error('Deployment access/URL mismatch; manual review required');result[target.name]={version:updated.deploymentConfig.versionNumber,access:actual.entryPointConfig.access,url:actual.url};}
 console.log('::notice title=Marathon deployments verified::'+JSON.stringify(result));
})().catch(e=>{console.error('::error::'+e.message);process.exitCode=1;});
