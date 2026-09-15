import { loadLegacyBook, mutateLegacyBook } from './legacyRecords'
import { completeLegacyTask, type TaskPayload } from './taskCompatibility'
import { pacificDay, pacificInput, TIME_ZONE } from './time'
export type TaskStatus = 'open' | 'done' | 'cancelled'
export interface Task {
  id: string; user_id: string; title: string; notes?: string | null; status: TaskStatus
  due_at?: string | null; all_day: boolean; calendar_event_id?: string | null
  created_at: string; updated_at: string; metadata: TaskPayload
}
function project(payload: TaskPayload, id: string): Task {
  return {id,user_id:'',title:payload.text || payload.title || '',notes:payload.notes || '',status:payload.is_done ? 'done' : payload.status === 'cancelled' ? 'cancelled' : 'open',due_at:payload.due_date ? pacificInput(payload.due_date,payload.due_time || '00:00').toISOString() : null,all_day:!payload.due_time,created_at:payload.created_at || '',updated_at:payload.updated_at || '',metadata:{...payload,id}}
}
export async function listTasks(status?: TaskStatus | null): Promise<Task[]> {
  const book = await loadLegacyBook()
  return book.records.filter(r=>r.collection==='tasks').map(r=>project(r.payload,r.id)).filter(t=>!status || t.status===status).sort((a,b)=>(a.due_at || '9999').localeCompare(b.due_at || '9999'))
}
export interface TaskInput {title?:string;notes?:string;dueAt?:Date|null;clearDue?:boolean;allDay?:boolean;metadata?:TaskPayload;expectedUpdatedAt?:string}
function patch(input:TaskInput):TaskPayload {
  const row:TaskPayload = {}
  // Explicit editable fields only: never allow the editor to overwrite points or IDs.
  for(const field of ['category','priority','subs','repeat','energy','estimate','duration','planned_date','waiting','quick','pinned','quad']) if(input.metadata && field in input.metadata) row[field]=input.metadata[field]
  if(input.title!==undefined) { if(!input.title.trim()) throw new Error('Enter a task title'); row.text=input.title.trim().slice(0,2000) }
  if(input.notes!==undefined) row.notes=input.notes
  if(input.clearDue) {row.due_date=null;row.due_time=null}
  else if(input.dueAt) {
    row.due_date=pacificDay(input.dueAt)
    row.due_time=input.allDay ? null : new Intl.DateTimeFormat('en-GB',{timeZone:TIME_ZONE,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(input.dueAt)
  }
  return row
}
export async function createTask(input:TaskInput & {title:string}):Promise<Task> {
  const id=crypto.randomUUID(), now=new Date().toISOString()
  const payload={id,text:'',is_done:false,category:'Personal',priority:'normal',progress:0,subs:[],repeat:'',status:'active',...patch(input),created_at:now,updated_at:now}
  await mutateLegacyBook(()=>({changes:[{collection:'tasks',id,payload}]}))
  return project(payload,id)
}
export async function updateTask(id:string,input:TaskInput):Promise<Task> {
  let result:Task | undefined
  await mutateLegacyBook(book=>{
    const record=book.records.find(r=>r.collection==='tasks' && r.id===id)
    if(!record) throw new Error('Task no longer exists. Refresh and try again.')
    if(input.expectedUpdatedAt !== undefined && input.expectedUpdatedAt !== (record.payload.updated_at || '')) throw new Error('This task changed elsewhere. Close the editor and refresh before saving.')
    const payload={...record.payload,...patch(input),id,updated_at:new Date().toISOString()}
    result=project(payload,id)
    return {changes:[{collection:'tasks',id,payload}]}
  })
  return result!
}
export async function setTaskStatus(id:string,status:TaskStatus):Promise<Task> {
  if(status==='cancelled') throw new Error('Use delete or mark complete for this task.')
  let result:Task | undefined
  await mutateLegacyBook(book=>{
    const record=book.records.find(r=>r.collection==='tasks' && r.id===id)
    if(!record) throw new Error('Task no longer exists. Refresh and try again.')
    const task:TaskPayload={...record.payload,id}
    const now=new Date()
    const {row,settings,next}=completeLegacyTask(task,status==='done',book.records.filter(r=>r.collection==='tasks').map(r=>({...r.payload,id:r.id})),book.settings,now,crypto.randomUUID())
    result=project(row,id)
    if(row===task) return {changes:[]}
    const logId=crypto.randomUUID()
    const changes=[{collection:'tasks',id,payload:row},{collection:'log',id:logId,payload:{id:logId,task_id:id,action:status==='done'?'completed':'reopened',old_text:task.text,new_text:task.text,created_at:now.toISOString()}}]
    if(next) changes.push({collection:'tasks',id:next.id,payload:next})
    return {changes,settings}
  })
  return result!
}
export async function deleteTask(id:string):Promise<void> { await mutateLegacyBook(()=>({changes:[{collection:'tasks',id,deleted:true}]})) }

