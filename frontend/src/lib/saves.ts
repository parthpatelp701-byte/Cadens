import { loadLegacyBook, mutateLegacyBook, type LegacyRecord } from './legacyRecords'
export type SaveKind = 'link' | 'note' | 'image' | 'place' | 'list'
export interface SaveItem {
 id:string; kind:SaveKind; title?:string|null; body?:string|null; url?:string|null; domain?:string|null;
 image_path?:string|null; collection?:string|null; ai_summary?:string|null; created_at:string; updated_at?:string; rank?:number;
 items?: {id:string;text:string;done:boolean;url?:string}[]
}
export function saveRecordId(collection:string,id:string) { return `${collection}:${encodeURIComponent(id)}` }
function sourceId(id:string) { const at=id.indexOf(':'); const collection=id.slice(0,at); if(!['notes','links','places','lists'].includes(collection)) throw new Error('Invalid save'); return {collection,id:decodeURIComponent(id.slice(at+1))} }
export function safeWebUrl(value:unknown):string|null { try { const u=new URL(String(value)); return ['https:','http:'].includes(u.protocol)?u.href:null } catch{return null} }
export function recordToSave(r:LegacyRecord):SaveItem {
 const p=r.payload; const url=safeWebUrl(p.url); const kind:SaveKind=r.collection==='links'?'link':r.collection==='places'?'place':r.collection==='lists'?'list':p.image_path?'image':'note'
 return {id:saveRecordId(r.collection,r.id),kind,title:p.title||p.name,body:p.body??p.note??'',url,domain:url?new URL(url).hostname:null,image_path:p.image_path,collection:p.collection||r.collection,items:p.items,created_at:p.created_at||p.updated_at||'1970-01-01T00:00:00.000Z',updated_at:p.updated_at}
}
export async function listSaves(collection?:string|null):Promise<SaveItem[]> {
 const book=await loadLegacyBook(); return book.records.filter(r=>['notes','links','places','lists'].includes(r.collection)&&!r.payload.cadensJournal).map(recordToSave).filter(r=>!collection||r.collection===collection).sort((a,b)=>b.created_at.localeCompare(a.created_at))
}
export async function searchSaves(query:string,_useAi=false) { const q=query.trim().toLocaleLowerCase(); return (await listSaves()).filter(s=>[s.title,s.body,s.url,s.collection,...(s.items||[]).map(i=>i.text)].join(' ').toLocaleLowerCase().includes(q)) }
export async function aiFindSaves(query:string) { return searchSaves(query) }
export async function createSave(input:{kind:SaveKind;title?:string;body?:string;url?:string;collection?:string;imagePath?:string}):Promise<SaveItem> {
 const collection=input.kind==='link'?'links':input.kind==='place'?'places':input.kind==='list'?'lists':'notes'
 const url=input.url?safeWebUrl(input.url):null; if(input.kind==='link'&&!url) throw new Error('Enter an http or https link.')
 const now=new Date().toISOString(); const id=crypto.randomUUID(); const payload={id,title:input.title?.trim()||url||'Untitled',name:input.title?.trim(),body:input.body||'',note:input.body||'',url,collection:input.collection,image_path:input.imagePath,items:input.kind==='list'?[]:undefined,created_at:now,updated_at:now}
 await mutateLegacyBook(()=>({changes:[{collection,id,payload}]})); return recordToSave({collection,id,payload})
}
export async function deleteSave(id:string) { const source=sourceId(id); await mutateLegacyBook(()=>({changes:[{...source,deleted:true}]})) }
export async function updateSave(id:string,patch:{title?:string;body?:string;collection?:string}, expectedUpdatedAt?:string) {
 const source=sourceId(id); let result!:SaveItem; await mutateLegacyBook(book=>{const r=book.records.find(r=>r.collection===source.collection&&r.id===source.id); if(!r)throw new Error('Save no longer exists.'); if(expectedUpdatedAt !== undefined && (r.payload.updated_at || r.payload.created_at || '') !== expectedUpdatedAt)throw new Error('This save changed on another device. Reload before editing.'); const payload:Record<string,any>={...r.payload,...patch,updated_at:new Date().toISOString()}; if(patch.body!==undefined&&['places','links'].includes(source.collection))payload.note=patch.body; if(patch.title!==undefined&&source.collection==='places')payload.name=patch.title; result=recordToSave({...source,payload}); return {changes:[{...source,payload}]}}); return result
}
export async function toggleSaveListItem(id:string,itemId:string) {const source=sourceId(id); if(source.collection!=='lists')throw new Error('Not a list'); await mutateLegacyBook(book=>{const r=book.records.find(r=>r.collection==='lists'&&r.id===source.id); if(!r)throw new Error('List no longer exists'); return {changes:[{...source,payload:{...r.payload,items:(r.payload.items||[]).map((i:any)=>i.id===itemId?{...i,done:!i.done}:i),updated_at:new Date().toISOString()}}]}})}
export async function addSaveListItem(id:string,text:string) {
 const source=sourceId(id);if(source.collection!=='lists'||!text.trim())throw new Error('Enter a list item');
 await mutateLegacyBook(book=>{const r=book.records.find(r=>r.collection==='lists'&&r.id===source.id);if(!r)throw new Error('List no longer exists');return {changes:[{...r,payload:{...r.payload,items:[...(r.payload.items||[]),{id:crypto.randomUUID(),text:text.trim(),done:false}],updated_at:new Date().toISOString()}}]}})
}
