import { supabase } from '@/lib/supabase'
import { loadLegacyBook } from './legacyRecords'
/** Complete canonical Daybook snapshot, plus all accessible calendar rows. Any failure aborts the export. */
async function allRows(table:string) {
 const rows:unknown[]=[]; const size=500;
 for(let offset=0;;offset+=size){const {data,error}=await supabase.from(table).select('*').order('id').range(offset,offset+size-1);if(error)throw error;rows.push(...(data||[]));if(!data||data.length<size)return rows}
}
export async function buildUserExport():Promise<Record<string,unknown>> {
 const {data,error}=await supabase.auth.getUser();if(error)throw error;if(!data.user)throw new Error('Please sign in again');
 const [book,calendars,events]=await Promise.all([loadLegacyBook(),allRows('calendars'),allRows('calendar_events')]);
 const {data:session}=await supabase.auth.getSession();if(session.session?.user.id!==data.user.id)throw new Error('Account changed. Please retry export.');
 return {format:'cadens-export',version:2,exported_at:new Date().toISOString(),user:{id:data.user.id,email:data.user.email},daybook:book,calendars,calendar_events:events,note:'Canonical records include tasks, saves, lists, journals, settings and their original metadata. Calendar rows include shared calendars visible to this account. Photos are referenced by storage path; this JSON does not contain photo files.'}
}
export function downloadJson(filename:string,data:unknown){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
