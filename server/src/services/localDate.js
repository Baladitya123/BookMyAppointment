function todayInHyderabad() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function dateInHyderabad(daysFromToday = 0) {
  const [year, month, day] = todayInHyderabad().split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + daysFromToday, 12))
  return date.toISOString().slice(0, 10)
}

function isValidDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false
  const date = new Date(`${value}T12:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function minutesNowInHyderabad() {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return Number(values.hour) * 60 + Number(values.minute)
}

function timeToMinutes(value) {
  const match = String(value).match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match) return null
  const displayHour = Number(match[1])
  const minute = Number(match[2])
  if (displayHour < 1 || displayHour > 12 || minute > 59) return null
  const hour = displayHour % 12 + (match[3].toUpperCase() === 'PM' ? 12 : 0)
  return hour * 60 + minute
}

function parseClock(value, fallback) {
  const match = String(value || '').match(/^(\d{2}):(\d{2})$/)
  if (!match) return fallback
  const hour = Number(match[1]); const minute = Number(match[2])
  return hour <= 23 && minute <= 59 ? hour * 60 + minute : fallback
}

function formatClock(minutes) {
  const hour24 = Math.floor(minutes / 60)
  const minute = minutes % 60
  const suffix = hour24 >= 12 ? 'PM' : 'AM'
  const hour12 = hour24 % 12 || 12
  return `${String(hour12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${suffix}`
}

function appointmentSchedule() {
  const slotMinutes = Number.parseInt(process.env.APPOINTMENT_SLOT_MINUTES || '15', 10)
  return {
    start: parseClock(process.env.APPOINTMENT_START_TIME, 9 * 60),
    end: parseClock(process.env.APPOINTMENT_END_TIME, 18 * 60),
    lunchStart: parseClock(process.env.APPOINTMENT_LUNCH_START, 13 * 60),
    lunchEnd: parseClock(process.env.APPOINTMENT_LUNCH_END, 14 * 60),
    slotMinutes: Number.isInteger(slotMinutes) && slotMinutes > 0 && slotMinutes <= 60 ? slotMinutes : 15,
  }
}

function defaultSlotsForDate(date) {
  const { start, end, lunchStart, lunchEnd, slotMinutes } = appointmentSchedule()
  const today = todayInHyderabad()
  if (date < today) return []
  const sameDay = date === today
  const currentMinutes = sameDay ? minutesNowInHyderabad() : -1
  const result = []
  for (let minutes = start; minutes + slotMinutes <= end; minutes += slotMinutes) {
    if (minutes < lunchEnd && minutes + slotMinutes > lunchStart) continue
    const label = formatClock(minutes)
    if (!sameDay || minutes > currentMinutes) result.push(label)
  }
  return result
}

function isFutureSlot(date, time) {
  const today = todayInHyderabad()
  if (date !== today) return date > today
  const minutes = timeToMinutes(time)
  return minutes !== null && minutes > minutesNowInHyderabad()
}

module.exports = { todayInHyderabad, dateInHyderabad, isValidDateString, minutesNowInHyderabad, timeToMinutes, appointmentSchedule, defaultSlotsForDate, isFutureSlot }
