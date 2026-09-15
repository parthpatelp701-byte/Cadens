/* Upload only the built static artifact as a draft to the verified existing site. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),os=require('node:os')
const siteId='1518c65d-0660-4777-ab8e-aea64f30fe6a'
const command=process.argv[2]
const production=command==='production'||command==='production-status'
const output=path.resolve(__dirname,production?'../../tests/theme-review/netlify-production.json':'../../tests/theme-review/netlify-draft.json')
const config=JSON.parse(fs.readFileSync(path.join(process.env.APPDATA || path.join(os.homedir(),'AppData/Roaming'),'netlify/Config/config.json'),'utf8'))
const token=config.users?.[config.userId]?.auth?.token
if(!token)throw Error('No authenticated Netlify CLI account found')
async function api(endpoint,options={}){
  const response=await fetch('https://api.netlify.com/api/v1'+endpoint,{...options,headers:{Authorization:'Bearer '+token,...options.headers}})
  if(!response.ok)throw Error('Netlify request failed: '+response.status+' '+endpoint)
  return response.json()
}
function compact(deploy){return{id:deploy.id,state:deploy.state,url:deploy.deploy_ssl_url || deploy.deploy_url,draft:deploy.draft,siteId:deploy.site_id}}
;(async()=>{
  if(command==='inspect'){
    const site=await api('/sites/'+siteId)
    if(site.name!=='cadens-private-beta')throw Error('Site identity mismatch')
    console.log(JSON.stringify({id:site.id,name:site.name,url:site.ssl_url,published:site.published_deploy?.id,build:{base:site.build_settings?.base,command:site.build_settings?.cmd,publish:site.build_settings?.dir}},null,2));return
  }
  if(command==='status'||command==='production-status'){
    const saved=JSON.parse(fs.readFileSync(output,'utf8')),deploy=await api('/deploys/'+saved.id)
    const result=compact(deploy);fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));return
  }
  if(command!=='create'&&command!=='production')throw Error('Use inspect, create, production, status or production-status')
  const dist=path.resolve(__dirname,'../dist'),files={}
  const walk=dir=>{for(const item of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isDirectory())walk(file);else{const relative=path.relative(dist,file).replaceAll('\\','/');files[relative]={file,hash:crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex')}}}}
  walk(dist)
  if(!files['index.html']||!files['_headers']||!files['_redirects'])throw Error('Incomplete build artifact')
  const deploy=await api('/sites/'+siteId+'/deploys',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({draft:!production,title:production?'Cadens heartbeat and auth production release':'Cadens heartbeat and auth handoff review',files:Object.fromEntries(Object.entries(files).map(([name,file])=>[name,file.hash]))})})
  fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(compact(deploy),null,2)+'\n')
  for(const hash of deploy.required || []){
    const entry=Object.entries(files).find(([,file])=>file.hash===hash)
    if(!entry)throw Error('Unexpected requested file digest')
    await api('/deploys/'+deploy.id+'/files/'+entry[0].split('/').map(encodeURIComponent).join('/'),{method:'PUT',headers:{'Content-Type':'application/octet-stream'},body:fs.readFileSync(entry[1].file)})
  }
  console.log(JSON.stringify({...compact(deploy),uploaded:(deploy.required || []).length}))
})().catch(error=>{console.error(error.message);process.exitCode=1})
