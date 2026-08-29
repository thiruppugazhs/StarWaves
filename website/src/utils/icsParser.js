/**
 * Utility function to parse iCalendar (.ics) format text into event objects.
 * Handles standard VEVENT blocks, summary, dtstart, dtend, description, location, uid, etc.
 */

function parseIcsDate(value = '') {
  if (!value) return { dateStr: '', allDay: false }
  const clean = value.split(';')[0].split(':').pop().trim()
  
  // Date only: YYYYMMDD
  if (/^\d{8}$/.test(clean)) {
    const year = clean.substring(0, 4)
    const month = clean.substring(4, 6)
    const day = clean.substring(6, 8)
    return { dateStr: `${year}-${month}-${day}`, allDay: true }
  }

  // Date-Time: YYYYMMDDTHHMMSSZ or YYYYMMDDTHHMMSS
  if (/^\d{8}T\d{6}Z?$/.test(clean)) {
    const year = clean.substring(0, 4)
    const month = clean.substring(4, 6)
    const day = clean.substring(6, 8)
    const hour = clean.substring(9, 11)
    const minute = clean.substring(11, 13)
    const second = clean.substring(13, 15)
    const isUtc = clean.endsWith('Z')
    const isoString = `${year}-${month}-${day}T${hour}:${minute}:${second}${isUtc ? 'Z' : ''}`
    return { dateStr: isoString, allDay: false }
  }

  // Fallback to standard Date parsing
  const parsed = new Date(clean)
  if (!Number.isNaN(parsed.getTime())) {
    return { dateStr: parsed.toISOString(), allDay: false }
  }

  return { dateStr: clean, allDay: false }
}

function unescapeIcsText(text = '') {
  return text
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\n/gi, '\n')
    .replace(/\\\\/g, '\\')
}

export function parseIcsContent(icsData, calendarName = 'Imported Calendar', calendarId = `ics-${Date.now()}`) {
  // Unfold folded lines (lines starting with space or tab)
  const unfolded = icsData.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '')
  const lines = unfolded.split(/\r?\n/)
  
  const events = []
  let currentEvent = null

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    if (trimmed.toUpperCase() === 'BEGIN:VEVENT') {
      currentEvent = {
        id: '',
        calendarId,
        calendarName,
        calendarColor: '#71717a',
        title: '(Untitled event)',
        description: '',
        location: '',
        htmlLink: '',
        start: '',
        end: '',
        allDay: false,
      }
      continue
    }

    if (trimmed.toUpperCase() === 'END:VEVENT') {
      if (currentEvent && currentEvent.start) {
        if (!currentEvent.id) {
          currentEvent.id = `ics-event-${Math.random().toString(36).substring(2, 9)}`
        }
        if (!currentEvent.end) {
          currentEvent.end = currentEvent.start
        }
        events.push(currentEvent)
      }
      currentEvent = null
      continue
    }

    if (!currentEvent) continue

    const colonIndex = trimmed.indexOf(':')
    if (colonIndex === -1) continue

    const keyPart = trimmed.substring(0, colonIndex).toUpperCase()
    const value = unescapeIcsText(trimmed.substring(colonIndex + 1))

    if (keyPart.startsWith('SUMMARY')) {
      currentEvent.title = value || '(Untitled event)'
    } else if (keyPart.startsWith('DTSTART')) {
      const { dateStr, allDay } = parseIcsDate(trimmed)
      currentEvent.start = dateStr
      currentEvent.allDay = allDay
    } else if (keyPart.startsWith('DTEND')) {
      const { dateStr } = parseIcsDate(trimmed)
      currentEvent.end = dateStr
    } else if (keyPart.startsWith('DESCRIPTION')) {
      currentEvent.description = value
    } else if (keyPart.startsWith('LOCATION')) {
      currentEvent.location = value
    } else if (keyPart.startsWith('UID')) {
      currentEvent.id = `${calendarId}:${value}`
    }
  }

  return {
    calendar: {
      id: calendarId,
      name: calendarName,
      color: '#71717a',
      eventCount: events.length,
    },
    events,
  }
}
