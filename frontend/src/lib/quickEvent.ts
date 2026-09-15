import { pacificNow } from './time'
/** Parse simple natural-ish quick add: "Meeting tomorrow 3pm" / "Dentist Friday" */
export function parseQuickEvent(text: string): { title: string; startsAt: Date; allDay: boolean } {
  let startsAt = pacificNow()
  startsAt.setMinutes(0, 0, 0)
  startsAt.setHours(startsAt.getHours() + 1)
  let allDay = false
  let title = text.trim()

  const lower = title.toLowerCase()

  if (/\btomorrow\b/.test(lower)) {
    startsAt.setDate(startsAt.getDate() + 1)
    title = title.replace(/\btomorrow\b/i, '').trim()
  } else if (/\btoday\b/.test(lower)) {
    title = title.replace(/\btoday\b/i, '').trim()
  }

  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  for (let i = 0; i < days.length; i++) {
    const re = new RegExp(`\\b${days[i]}\\b`, 'i')
    if (re.test(lower)) {
      const target = i
      const cur = startsAt.getDay()
      let add = (target - cur + 7) % 7
      if (add === 0) add = 7
      startsAt.setDate(startsAt.getDate() + add)
      title = title.replace(re, '').trim()
      break
    }
  }

  const timeMatch = lower.match(/\b(\d{1,2})(?::(\d{2})\s*(am|pm)?|\s*(am|pm))\b/)
  if (timeMatch) {
    let h = parseInt(timeMatch[1], 10)
    const m = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0
    const ap = timeMatch[3] || timeMatch[4]
    if (m > 59 || (ap ? h < 1 || h > 12 : h > 23)) return { title, startsAt, allDay }
    if (ap === 'pm' && h < 12) h += 12
    if (ap === 'am' && h === 12) h = 0
    startsAt.setHours(h, m, 0, 0)
    title = title.replace(timeMatch[0], '').trim()
  } else if (/\ball\s*day\b/i.test(lower)) {
    allDay = true
    title = title.replace(/\ball\s*day\b/i, '').trim()
    startsAt.setHours(0, 0, 0, 0)
  }

  title = title.replace(/\s{2,}/g, ' ').replace(/^[-–—]\s*/, '').trim() || text.trim()
  return { title, startsAt, allDay }
}
