import { loadLegacyBook, mutateLegacyBook, type LegacyRecord } from './legacyRecords'
import { pacificDay } from './time'
import { supabase } from '@/lib/supabase'

export type Mood = 'great' | 'good' | 'ok' | 'low' | 'hard'

export interface Journal {
  id: string
  user_id: string
  name: string
  color: string
  icon: string
  is_default: boolean
  created_at: string
}

export interface JournalEntry {
  id: string
  journal_id: string
  user_id: string
  title: string | null
  body: string
  entry_date: string
  is_favorite: boolean
  mood: Mood | null
  location_label: string | null
  weather_summary: string | null
  template_key: string | null
  word_count: number
  created_at: string
  updated_at: string
}

export interface JournalStreak {
  current: number
  longest: number
  total_entries: number
}

/** Day One–style prompts */
export const DAILY_PROMPTS = [
  'What made today meaningful?',
  'What am I grateful for right now?',
  'What did I learn today?',
  'What do I need less of right now?',
  'What energized me today?',
  'Who showed up for me this week?',
  'What would I tell yesterday’s self?',
  'What am I avoiding, and why?',
  'A small win I almost overlooked…',
  'What does “enough” look like today?',
  'How did I take care of myself?',
  'What conversation stayed with me?',
  'If today had a title, what would it be?',
  'What am I proud of that nobody saw?',
  'What do I want more of tomorrow?',
]

export const JOURNAL_TEMPLATES: {
  key: string
  name: string
  body: string
}[] = [
  {
    key: 'gratitude',
    name: 'Gratitude',
    body: 'Three things I’m grateful for:\n1. \n2. \n3. \n\nOne person I appreciate:\n',
  },
  {
    key: 'daily',
    name: 'Daily log',
    body: 'Morning:\n\nAfternoon:\n\nEvening:\n\nHighlight:\n',
  },
  {
    key: 'work',
    name: 'Work reflection',
    body: 'Shipped:\n\nBlocked by:\n\nLearned:\n\nTomorrow’s priority:\n',
  },
  {
    key: 'mood',
    name: 'Mood check',
    body: 'How I feel: \n\nWhy:\n\nWhat would help:\n',
  },
  {
    key: 'free',
    name: 'Blank',
    body: '',
  },
]

export function promptForToday(date = new Date()): string {
  const day = Math.floor(date.getTime() / 86400000)
  return DAILY_PROMPTS[day % DAILY_PROMPTS.length]
}

const DEFAULT_JOURNAL = 'default'
async function journalUserId() { const {data,error}=await supabase.auth.getSession(); if(error)throw error; if(!data.session)throw new Error('Please sign in again'); return data.session.user.id }
export async function ensureDefaultJournal():Promise<Journal> { return {id:DEFAULT_JOURNAL,user_id:await journalUserId(),name:'My journal',color:'#8B5CF6',icon:'book',is_default:true,created_at:'1970-01-01T00:00:00.000Z'} }
export async function listJournals():Promise<Journal[]> { const book=await loadLegacyBook(); return [await ensureDefaultJournal(),...(book.settings.cadensJournals||[])] }
export async function createJournal(name:string,color='#8B5CF6'):Promise<Journal> {
 if(!name.trim())throw new Error('Enter a journal name'); const journal:Journal={id:crypto.randomUUID(),user_id:await journalUserId(),name:name.trim(),color,icon:'book',is_default:false,created_at:new Date().toISOString()};
 await mutateLegacyBook(book=>({changes:[],settings:{...book.settings,cadensJournals:[...(book.settings.cadensJournals||[]),journal]}}));return journal
}
export function noteToJournal(r:LegacyRecord,userId=''):JournalEntry {
 const p=r.payload; const body=String(p.body||''); const created=p.created_at||p.updated_at||'1970-01-01T00:00:00.000Z';
 return {id:r.id,user_id:userId,journal_id:p.journal_id||DEFAULT_JOURNAL,title:p.title||null,body,entry_date:p.entry_date||pacificDay(created),is_favorite:!!p.is_favorite,mood:p.mood||null,location_label:p.location_label||null,weather_summary:p.weather_summary||null,template_key:p.template_key||null,word_count:body.trim()?body.trim().split(/\s+/).length:0,created_at:created,updated_at:p.updated_at||created}
}
export async function listEntries(opts?:{journalId?:string;query?:string;limit?:number;offset?:number}):Promise<JournalEntry[]> {
 const book=await loadLegacyBook(); const q=opts?.query?.trim().toLocaleLowerCase(); const all=book.records.filter(r=>r.collection==='notes'&&r.payload.cadensJournal).map(r=>noteToJournal(r)).filter(e=>(!opts?.journalId||e.journal_id===opts.journalId)&&(!q||`${e.title} ${e.body}`.toLocaleLowerCase().includes(q))).sort((a,b)=>b.entry_date.localeCompare(a.entry_date)||b.created_at.localeCompare(a.created_at));return all.slice(opts?.offset||0,opts?.limit===undefined?undefined:(opts?.offset||0)+opts.limit)
}
export async function createEntry(input:{journalId?:string;body:string;title?:string;entryDate?:string;mood?:Mood;locationLabel?:string;templateKey?:string}):Promise<JournalEntry> {
 const id=crypto.randomUUID();const now=new Date().toISOString();const payload={id,cadensJournal:true,journal_id:input.journalId||DEFAULT_JOURNAL,body:input.body,title:input.title||'',entry_date:input.entryDate||pacificDay(new Date()),mood:input.mood,location_label:input.locationLabel,template_key:input.templateKey,created_at:now,updated_at:now}; await mutateLegacyBook(book=>{if(payload.journal_id!==DEFAULT_JOURNAL&&!(book.settings.cadensJournals||[]).some((j:Journal)=>j.id===payload.journal_id))throw new Error('Journal no longer exists');return {changes:[{collection:'notes',id,payload}]}});return noteToJournal({collection:'notes',id,payload})
}
export async function updateEntry(id:string,patch:Partial<Pick<JournalEntry,'title'|'body'|'is_favorite'|'mood'|'location_label'>>):Promise<void> {
 await mutateLegacyBook(book=>{const record=book.records.find(r=>r.collection==='notes'&&r.id===id&&r.payload.cadensJournal);if(!record)throw new Error('Entry no longer exists');return {changes:[{...record,payload:{...record.payload,...patch,updated_at:new Date().toISOString()}}]}})
}
export async function deleteEntry(id:string):Promise<void> {await mutateLegacyBook(book=>{if(!book.records.some(r=>r.collection==='notes'&&r.id===id&&r.payload.cadensJournal))throw new Error('Entry no longer exists');return {changes:[{collection:'notes',id,deleted:true}]}})}
export async function onThisDay(date=new Date()):Promise<JournalEntry[]> {const today=pacificDay(date);return (await listEntries()).filter(e=>e.entry_date.slice(5)===today.slice(5)&&e.entry_date<today)}
export function streakFromEntries(entries:JournalEntry[],today=pacificDay(new Date())):JournalStreak {
 const dates=[...new Set(entries.map(e=>e.entry_date).filter(d=>d<=today))].sort();let longest=0,run=0,previous='';
 const dayNumber=(d:string)=>Date.parse(d+'T00:00:00Z')/86400000;
 for(const d of dates){run=previous&&dayNumber(d)-dayNumber(previous)===1?run+1:1;longest=Math.max(longest,run);previous=d}
 let current=0;let cursor=dayNumber(today);const set=new Set(dates.map(dayNumber));if(!set.has(cursor))cursor--;while(set.has(cursor)){current++;cursor--}
 return {current,longest,total_entries:entries.length}
}
export async function getStreak():Promise<JournalStreak> {return streakFromEntries(await listEntries())}
export async function calendarMonth(year:number,month:number):Promise<{entry_date:string;entry_count:number}[]> {const prefix=`${year}-${String(month).padStart(2,'0')}`;const counts=new Map<string,number>();for(const entry of await listEntries())if(entry.entry_date.startsWith(prefix))counts.set(entry.entry_date,(counts.get(entry.entry_date)||0)+1);return [...counts].map(([entry_date,entry_count])=>({entry_date,entry_count}))}
export async function uploadJournalImage(entryId:string,file:File):Promise<string> {
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>1200000)throw new Error('Use JPEG, PNG or WebP smaller than 1.2 MB');
 const path=`${await journalUserId()}/journal/${entryId}/${crypto.randomUUID()}`;const {error}=await supabase.storage.from('cadens-photos').upload(path,file,{upsert:false,contentType:file.type});if(error)throw error;
 try {await mutateLegacyBook(book=>{const r=book.records.find(r=>r.collection==='notes'&&r.id===entryId&&r.payload.cadensJournal);if(!r)throw new Error('Entry no longer exists');return {changes:[{...r,payload:{...r.payload,media:[...(r.payload.media||[]),path]}}]}})}catch(error){await supabase.storage.from('cadens-photos').remove([path]);throw error}return path
}
export async function journalImageUrl(path:string):Promise<string> {const {data,error}=await supabase.storage.from('cadens-photos').createSignedUrl(path,3600);if(error)throw error;return data.signedUrl}

/** Mode preference: elevate Journal in the product experience */
export function getAppMode(): 'cadens' | 'journal' {
  try {
    return localStorage.getItem('cadens-app-mode') === 'journal' ? 'journal' : 'cadens'
  } catch {
    return 'cadens'
  }
}

export function setAppMode(mode: 'cadens' | 'journal') {
  try {
    localStorage.setItem('cadens-app-mode', mode)
  } catch {
    /* ignore */
  }
}

