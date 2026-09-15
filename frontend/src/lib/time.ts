import { TZDate } from '@date-fns/tz'
export const TIME_ZONE='America/Vancouver'
export function pacificNow(){return TZDate.tz(TIME_ZONE)}
export function pacificDay(value:Date|string=new Date()){
  return new Intl.DateTimeFormat('en-CA',{timeZone:TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value))
}
export function pacificTime(value:Date|string){return new Intl.DateTimeFormat('en-US',{timeZone:TIME_ZONE,hour:'numeric',minute:'2-digit'}).format(new Date(value))}
export function pacificInput(day:string,time='00:00'){
  const [y,m,d]=day.split('-').map(Number),[h,min]=time.split(':').map(Number)
  return new TZDate(y,m-1,d,h,min,0,TIME_ZONE)
}
