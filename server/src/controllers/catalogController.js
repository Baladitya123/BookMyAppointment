const { all, byId, create, update } = require('../services/repository')
const { findUserByEmail, remove } = require('../services/repository')
const bcrypt = require('bcryptjs')
const { todayInHyderabad, dateInHyderabad, isValidDateString, defaultSlotsForDate, isFutureSlot, timeToMinutes } = require('../services/localDate')
const { canonicalCity, uniqueCities, matchCity } = require('../services/cities')

function isActiveBooking(appointment) {
  return appointment.activeKey !== false && ['BOOKED', 'CONFIRMED'].includes(appointment.status)
}

function withHospital(doctor, hospitals) {
  const hospital = hospitals.find(h => String(h._id) === String(doctor.hospitalId))
  return { ...doctor, hospital: hospital?.name || '', city: canonicalCity(hospital?.city) || '', area: hospital?.area || '' }
}

async function listCities(req, res) {
  const hospitals = await all('hospitals')
  return res.json(uniqueCities(hospitals))
}

async function listHospitals(req, res) {
  const { city, q, specialty } = req.query
  const query = String(q || '').toLowerCase()
  let hospitals = (await all('hospitals')).filter(hospital => hospital.isSampleData !== true && canonicalCity(hospital.city))
  const selectedCity = city ? matchCity(city, uniqueCities(hospitals)) : null
  if (city && !selectedCity) return res.json([])
  if (selectedCity) hospitals = hospitals.filter(h => canonicalCity(h.city).toLowerCase() === selectedCity.toLowerCase())
  if (query) hospitals = hospitals.filter(h => `${h.name} ${h.area} ${h.city} ${h.address}`.toLowerCase().includes(query))
  if (specialty) hospitals = hospitals.filter(h => h.departments?.some(department => department.toLowerCase().includes(String(specialty).toLowerCase())))
  const doctors = await all('doctors'); const appointments = await all('appointments')
  const date = req.query.date || todayInHyderabad()
  if (!isValidDateString(date)) return res.status(400).json({ message: 'Choose a valid date.' })
  res.json(hospitals.map(h => ({ ...h, city: canonicalCity(h.city), departments: h.departments || [], openSlots: doctors.filter(d => d.isSampleData !== true && String(d.hospitalId) === String(h._id)).reduce((sum, doctor) => {
    const slots = defaultSlotsForDate(date)
    const booked = appointments.filter(appointment => String(appointment.doctorId) === String(doctor._id) && appointment.date === date && isActiveBooking(appointment)).map(appointment => appointment.startTime)
    return sum + slots.filter(slot => !booked.includes(slot) && isFutureSlot(date, slot)).length
  }, 0) })))
}

async function getHospital(req, res) {
  const hospital = await byId('hospitals', req.params.id)
  if (!hospital || hospital.isSampleData === true || !canonicalCity(hospital.city)) return res.status(404).json({ message: 'Hospital not found.' })
  const doctors = (await all('doctors')).filter(d => d.isSampleData !== true && String(d.hospitalId) === String(hospital._id))
  return res.json({ ...hospital, city: canonicalCity(hospital.city), doctors: doctors.map(({ availability, ...doctor }) => doctor) })
}

async function listDoctors(req, res) {
  const { city, hospitalId, specialty, q } = req.query
  const hospitals = (await all('hospitals')).filter(hospital => hospital.isSampleData !== true && canonicalCity(hospital.city))
  const realHospitalIds = new Set(hospitals.map(hospital => String(hospital._id)))
  let doctors = (await all('doctors')).filter(doctor => doctor.isSampleData !== true && realHospitalIds.has(String(doctor.hospitalId))).map(d => withHospital(d, hospitals))
  const selectedCity = city ? matchCity(city, uniqueCities(hospitals)) : null
  if (city && !selectedCity) return res.json([])
  if (selectedCity) doctors = doctors.filter(d => canonicalCity(d.city).toLowerCase() === selectedCity.toLowerCase())
  if (hospitalId) doctors = doctors.filter(d => String(d.hospitalId) === String(hospitalId))
  if (specialty) doctors = doctors.filter(d => d.specialization?.toLowerCase().includes(String(specialty).toLowerCase()))
  if (q) doctors = doctors.filter(d => `${d.name} ${d.specialization} ${d.hospital}`.toLowerCase().includes(String(q).toLowerCase()))
  const date = req.query.date || todayInHyderabad()
  if (!isValidDateString(date)) return res.status(400).json({ message: 'Choose a valid date.' })
  const appointments = await all('appointments')
  res.json(doctors.map(d => {
    const doctorBookings = appointments.filter(appointment => String(appointment.doctorId) === String(d._id) && isActiveBooking(appointment))
    const booked = doctorBookings.filter(appointment => appointment.date === date).map(appointment => appointment.startTime)
    const slots = defaultSlotsForDate(date)
    let nextAvailable = null
    for (let offset = 0; offset < 90 && !nextAvailable; offset += 1) {
      const scheduleDate = dateInHyderabad(offset)
      const occupied = doctorBookings.filter(appointment => appointment.date === scheduleDate).map(appointment => appointment.startTime)
      const openSlots = defaultSlotsForDate(scheduleDate).filter(slot => !occupied.includes(slot))
      if (openSlots.length) nextAvailable = { date: scheduleDate, slots: openSlots }
    }
    const { availability, ...doctorProfile } = d
    return { ...doctorProfile, fee: d.consultationFee, experience: `${d.experienceYears || 0} years`, initials: d.initials || d.name.split(' ').slice(-2).map(w => w[0]).join(''), slots: slots.filter(slot => !booked.includes(slot) && isFutureSlot(date, slot)), nextAvailable: nextAvailable || null }
  }))
}

async function getDoctor(req, res) {
  const doctor = await byId('doctors', req.params.id)
  if (!doctor || doctor.isSampleData === true) return res.status(404).json({ message: 'Doctor not found.' })
  const hospital = await byId('hospitals', doctor.hospitalId)
  if (!hospital || hospital.isSampleData === true || !canonicalCity(hospital.city)) return res.status(404).json({ message: 'Doctor not found.' })
  const { availability, ...doctorProfile } = doctor
  return res.json({ ...doctorProfile, hospital: hospital?.name || '', fee: doctor.consultationFee, experience: `${doctor.experienceYears || 0} years` })
}

async function availability(req, res) {
  const doctor = await byId('doctors', req.params.id)
  if (!doctor || doctor.isSampleData === true) return res.status(404).json({ message: 'Doctor not found.' })
  const hospital = await byId('hospitals', doctor.hospitalId)
  if (!hospital || hospital.isSampleData === true || !canonicalCity(hospital.city)) return res.status(404).json({ message: 'Doctor not found.' })
  const requested = req.query.date
  if (requested && !isValidDateString(requested)) return res.status(400).json({ message: 'Choose a valid date.' })
  const booked = (await all('appointments')).filter(a => String(a.doctorId) === String(doctor._id) && isActiveBooking(a))
  const dates = requested ? [requested] : Array.from({ length: 90 }, (_, index) => dateInHyderabad(index))
  const result = dates.map(date => {
    const dayBookings = booked.filter(appointment => appointment.date === date).map(appointment => appointment.startTime)
    const futureTimes = defaultSlotsForDate(date)
    return {
      date,
      slots: futureTimes.filter(time => !dayBookings.includes(time)),
      bookedSlots: futureTimes.filter(time => dayBookings.includes(time)),
    }
  }).filter(day => day.slots.length || day.bookedSlots.length || requested)
  return res.json(result)
}

async function createHospital(req, res) {
  const required = ['name', 'address', 'city']
  if (required.some(key => !String(req.body[key] || '').trim())) return res.status(400).json({ message: 'Hospital name, address and city are required.' })
  if (req.user.hospitalId) return res.status(403).json({ message: 'Only a global hospital admin can add a hospital.' })
  const city = canonicalCity(req.body.city)
  if (!city || city.length > 80) return res.status(400).json({ message: 'Enter a valid city name (up to 80 characters).' })
  const fields = ['name', 'address', 'city', 'area', 'state', 'pincode', 'location', 'departments', 'contact', 'rating']
  const hospitalData = Object.fromEntries(fields.filter(key => req.body[key] !== undefined).map(key => [key, req.body[key]]))
  res.status(201).json(await create('hospitals', { ...hospitalData, name: req.body.name.trim(), city, isSampleData: false }))
}

async function createDoctor(req, res) {
  const { name, specialization, hospitalId, loginEmail, initialPassword } = req.body
  if (req.user.hospitalId && String(req.user.hospitalId) !== String(hospitalId)) return res.status(403).json({ message: 'You can only add doctors to your hospital.' })
  const hospital = await byId('hospitals', hospitalId)
  if (!name?.trim() || !specialization?.trim() || !hospital || hospital.isSampleData === true) return res.status(400).json({ message: 'Enter a doctor name, specialty and valid hospital.' })
  const email = String(loginEmail || '').trim().toLowerCase()
  if (!/^\S+@\S+\.\S+$/.test(email) || typeof initialPassword !== 'string' || initialPassword.length < 8) {
    return res.status(400).json({ message: 'Provide the doctor’s login email and a temporary password with at least 8 characters.' })
  }
  if (await findUserByEmail(email)) return res.status(409).json({ message: 'An account with that doctor email already exists.' })

  const doctorFields = ['qualifications', 'experienceYears', 'consultationFee', 'rating', 'initials', 'verified']
  const doctorData = Object.fromEntries(doctorFields.filter(key => req.body[key] !== undefined).map(key => [key, req.body[key]]))
  const doctor = await create('doctors', { ...doctorData, name: name.trim(), specialization: specialization.trim(), hospitalId, isSampleData: false })
  let account
  try {
    account = await create('users', {
      name: name.trim(), email, password: await bcrypt.hash(initialPassword, 12), role: 'DOCTOR',
      city: hospital.city, hospitalId, doctorId: doctor._id,
    })
    await update('doctors', doctor._id, { userId: account._id })
  } catch (error) {
    if (account?._id) await remove('users', account._id)
    await remove('doctors', doctor._id)
    throw error
  }

  const savedDoctor = await byId('doctors', doctor._id)
  const hospitals = (await all('hospitals')).filter(item => item.isSampleData !== true)
  return res.status(201).json({ ...withHospital(savedDoctor, hospitals), loginEmail: email, accountCreated: true })
}

async function updateAvailability(req, res) {
  const doctor = await byId('doctors', req.params.id)
  if (!doctor) return res.status(404).json({ message: 'Doctor not found.' })
  if (doctor.isSampleData === true || (await byId('hospitals', doctor.hospitalId))?.isSampleData === true) return res.status(404).json({ message: 'Doctor not found.' })
  if (req.user.role === 'DOCTOR' && String(req.user.doctorId) !== String(doctor._id)) return res.status(403).json({ message: 'You can only manage your own availability.' })
  if (req.user.role === 'HOSPITAL_ADMIN' && req.user.hospitalId && String(req.user.hospitalId) !== String(doctor.hospitalId)) return res.status(403).json({ message: 'You can only manage availability at your hospital.' })
  const { date, slots } = req.body
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || date < todayInHyderabad() || !Array.isArray(slots) || slots.length > 30) return res.status(400).json({ message: 'Choose today or a future date and provide up to 30 valid time slots.' })
  const slotMinutes = slots.map(timeToMinutes)
  if (slotMinutes.some(minutes => minutes === null || minutes % 30 !== 0)) return res.status(400).json({ message: 'Use valid appointment times on 30-minute boundaries, such as 09:00 AM or 01:30 PM.' })
  const normalizedSlots = [...new Set(slots)].sort((a, b) => timeToMinutes(a) - timeToMinutes(b))
  const availability = [...(doctor.availability || []).filter(day => day.date !== date), { date, slots: normalizedSlots }].sort((a, b) => a.date.localeCompare(b.date))
  await update('doctors', doctor._id, { availability })
  res.json({ date, slots: availability.find(day => day.date === date).slots })
}

module.exports = { listCities, listHospitals, getHospital, listDoctors, getDoctor, availability, createHospital, createDoctor, updateAvailability }
