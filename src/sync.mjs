export const collections = ['tasks','events','posts','notes','places','lists','links','habits','reviews','log'];
export const preferenceKeys = ['profile','dayMoods','weekGoal','xp','level','intention','quest','combo','freezeLeft','freezeWeek'];
export function canonical(value) {
  if (Array.isArray(value)) return '['+value.map(canonical).join(',')+']';
  if (value && typeof value==='object') return '{'+Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
  return JSON.stringify(value);
}
export function delta(before, after) {
  const changes=[];
  for(const collection of collections){
    const previous=new Map((before[collection]||[]).map(p=>[p.id,p]));
    for(const payload of after[collection]||[]){
      if(canonical(previous.get(payload.id))!==canonical(payload)) changes.push({collection,id:payload.id,payload});
      previous.delete(payload.id);
    }
    for(const id of previous.keys()) changes.push({collection,id,deleted:true});
  }
  return changes;
}
export function pacificDay(date=new Date()) {
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Vancouver',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const get=t=>parts.find(p=>p.type===t).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
// Imported IDs enter attribute contexts in the original renderer. Reject markup
// instead of trusting an imported backup to contain application-generated IDs.
export function validateBackup(data) {
  if(!data || typeof data!=='object' || Array.isArray(data)) throw Error('Invalid backup');
  const out={}; let count=0;
  function check(value,key='') {
    if(typeof value==='string') {
      if(value.length>1800000) throw Error('A backup field is too large');
      if(/(^id$|Id$|_id$)/.test(key)&&/["'<>\s`]/.test(value)) throw Error('Invalid record identifier');
      if((key==='url'||key==='href')&&value&&!/^https?:\/\//i.test(value)) throw Error('Only web links are supported');
      if(key==='photo'&&value&&!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value)) throw Error('Invalid photo');
    }
    if(Array.isArray(value)) value.forEach(v=>check(v,key));
    else if(value&&typeof value==='object') for(const [k,v] of Object.entries(value)) {
      if(['__proto__','constructor','prototype'].includes(k)) throw Error('Invalid backup key');
      check(v,k);
    }
  }
  check(data);
  for(const c of collections){
    if(data[c]!==undefined&&!Array.isArray(data[c])) throw Error('Invalid '+c);
    out[c]=structuredClone(data[c]||[]); const ids=new Set();
    for(const p of out[c]) {
      if(!p||typeof p!=='object'||Array.isArray(p)||typeof p.id!=='string'||!p.id||p.id.length>200||ids.has(p.id)) throw Error('Missing or duplicate record ID in '+c);
      ids.add(p.id); count++;
      delete p._ownerId;
      if(c==='places')delete p.photo_path;
      if(c==='posts'){p.privacy='private';delete p.groupId;delete p.groupName;p.likes=0;p.liked=false;p.comments=[];}
    }
  }
  if(count>10000) throw Error('Beta limit is 10000 records');
  for(const k of preferenceKeys) if(data[k]!==undefined) out[k]=structuredClone(data[k]);
  if(out.profile) {delete out.profile.group;if(!Array.isArray(out.profile.family))out.profile.family=[];}
  return out;
}
