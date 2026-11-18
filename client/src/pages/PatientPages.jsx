import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Calendar, CalendarCheck2, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Clock, FileCheck2, FileText, Filter, Heart, HeartPulse, MapPin, MessageCircle, Search, ShieldCheck, Sparkles, Star, Stethoscope, Upload, UserRound, Users, X } from 'lucide-react'
import Modal from '../components/Modal'
import api from '../services/api'

const dayLabel = (value) => new Date(`${value}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
const hyderabadToday = () => {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}
const nextHyderabadSlotTime = () => {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  const rounded = (Math.floor((Number(values.hour) * 60 + Number(values.minute)) / 30) + 1) * 30
  if (rounded > 23 * 60 + 30) return '23:59'
  return `${String(Math.floor(rounded / 60)).padStart(2, '0')}:${String(rounded % 60).padStart(2, '0')}`
}
const slotMinutes = value => {
  const match = String(value).match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match) return Number.MAX_SAFE_INTEGER
  const displayHour = Number(match[1]); const minute = Number(match[2])
  if (displayHour < 1 || displayHour > 12 || minute > 59) return Number.MAX_SAFE_INTEGER
  return (displayHour % 12 + (match[3].toUpperCase() === 'PM' ? 12 : 0)) * 60 + minute
}

function SectionHead({ label, title, action, to }) {
  return <div className="section-head"><div><div className="eyebrow">{label}</div><h2>{title}</h2></div>{action && <Link className="text-link" to={to}>{action}<ArrowRight size={15}/></Link>}</div>
}

function reportTrendData(reports) {
  const byDate = new Map()
  reports.forEach(report => (report.extractedParameters || []).forEach(parameter => {
    if (!['hba1c', 'hemoglobin'].includes(parameter.name.toLowerCase())) return
    const date = report.uploadDate
    if (!date) return
    const point = byDate.get(date) || { date: dayLabel(date).replace(/, \d{4}$/, '') }
    point[parameter.name.toLowerCase() === 'hba1c' ? 'HbA1c' : 'Hemoglobin'] = Number(parameter.value)
    byDate.set(date, point)
  }))
  return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, point]) => point)
}

export function DashboardPage({ appointments, reports, doctors, hospitals, role, city, sessionUser, onUpdateStatus, onUpdateNotes, onUpdateAvailability, onAddHospital, onAddDoctor, notify }) {
  const nextAppointment = appointments.find(a => a.status !== 'CANCELLED' && a.status !== 'COMPLETED')
  const completedReports = reports
  const latestReport = [...completedReports].sort((a, b) => (b.uploadDate || '').localeCompare(a.uploadDate || ''))[0]
  const trendData = reportTrendData(reports)
  const isPatient = role === 'PATIENT'
  const todayLabel = new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const firstName = sessionUser?.name?.trim().split(/\s+/)[0] || 'there'
  return <div className="page fade-in">
    <div className="welcome-row"><div><div className="eyebrow">{todayLabel} <span className="live-dot"/></div><h1>{isPatient ? `Welcome, ${firstName}` : role === 'DOCTOR' ? 'Welcome, Doctor' : 'Welcome, Admin'} <span className="wave">✳</span></h1><p className="welcome-sub">{isPatient ? 'A little clarity can make a big difference in your health journey.' : 'Here’s a snapshot of your care activity today.'}</p></div><Link to="/find-care" className="btn btn-primary"><CalendarCheck2 size={17}/> Book an appointment</Link></div>
    {role !== 'PATIENT' ? <ProviderDashboard appointments={appointments} reports={reports} doctors={doctors} hospitals={hospitals} role={role} sessionUser={sessionUser} onUpdateStatus={onUpdateStatus} onUpdateNotes={onUpdateNotes} onUpdateAvailability={onUpdateAvailability} onAddHospital={onAddHospital} onAddDoctor={onAddDoctor} notify={notify}/> : <>
      <div className="hero-grid">
        <section className="next-card">
          <div className="next-card-top"><div className="next-kicker"><span className="pulse-dot"/> YOUR NEXT VISIT</div>{nextAppointment && <span className="confirmed-tag"><Check size={12}/>{nextAppointment.status === 'CONFIRMED' ? 'Confirmed' : 'Booked'}</span>}</div>
          {nextAppointment ? <><div className="visit-date"><div className="date-block"><b>{new Date(`${nextAppointment.date}T12:00:00`).toLocaleDateString('en-IN', { day: '2-digit' })}</b><span>{new Date(`${nextAppointment.date}T12:00:00`).toLocaleDateString('en-IN', { month: 'short' }).toUpperCase()}</span></div><div><h2>{nextAppointment.doctor}</h2><p>{nextAppointment.specialization}</p></div></div><div className="visit-meta"><span><Clock size={15}/>{nextAppointment.startTime}</span><span><MapPin size={15}/>{nextAppointment.hospital}</span></div><Link to="/appointments" className="visit-footer">View appointment details <ArrowRight size={16}/></Link></> : <div className="empty-next"><p>No upcoming visits yet.</p><Link to="/find-care">Find a doctor <ArrowRight size={15}/></Link></div>}
          <div className="decor-orbit orbit-one"/><div className="decor-orbit orbit-two"/><div className="decor-cross">✳</div>
        </section>
        <section className="insight-card"><div className="insight-heading"><div className="insight-icon"><Sparkles size={18}/></div><span>YOUR REPORTS</span><span className="info-mark">i</span></div><div className="insight-content"><div className="insight-label">{latestReport ? 'Based on your recent report' : 'Your records'}</div><h2>{latestReport ? <>Review your<br/><em>{latestReport.reportType}.</em></> : <>Your health records<br/><em>will appear here.</em></>}</h2><p>{latestReport ? 'Your original report is stored securely and shared with the doctor you selected.' : 'Upload an original report and choose the doctor who should receive it.'}</p>{latestReport && <div className="insight-specialist"><div className="mini-doctor"><ShieldCheck size={15}/></div><span><small>ORIGINAL FILE</small><b>Shared with your doctor</b></span><Link to="/reports" aria-label="View my reports"><ArrowRight size={16}/></Link></div>}</div><div className="insight-orb"/></section>
      </div>
      <div className="quick-stats"><StatCard icon={CalendarCheck2} tint="tint-mint" label="Appointments" value={appointments.filter(a => a.status !== 'CANCELLED').length.toString().padStart(2, '0')} sub="Upcoming & past"/><StatCard icon={FileCheck2} tint="tint-blue" label="Health reports" value={completedReports.length.toString().padStart(2, '0')} sub="Original files uploaded"/><StatCard icon={HeartPulse} tint="tint-peach" label={`Doctors in ${city}`} value={doctors.length.toString().padStart(2, '0')} sub={city}/><StatCard icon={Activity} tint="tint-lilac" label={`Hospitals in ${city}`} value={hospitals.length.toString().padStart(2, '0')} sub={city}/></div>
      <div className="content-grid dashboard-content">
        <section className="panel trend-panel"><div className="panel-heading"><div><div className="eyebrow">ORIGINAL DOCUMENTS</div><h2>Sent to your doctor</h2></div><ShieldCheck size={18}/></div><p className="modal-copy">The app stores your uploaded file as provided. Your selected doctor can view the same original report from their account.</p><Link to="/reports" className="btn btn-secondary">View my reports <ArrowRight size={15}/></Link></section>
        <section className="panel reports-panel"><div className="panel-heading"><div><div className="eyebrow">YOUR RECORDS</div><h2>Recent reports</h2></div><Link to="/reports" className="panel-view-link">View all <ArrowRight size={14}/></Link></div><div className="report-list">{reports.slice(0, 3).map((report, i) => <div className="report-row" key={report._id}><div className={`file-icon file-${i % 3}`}><FileText size={18}/></div><div className="report-main"><b>{report.reportType}</b><span>{dayLabel(report.uploadDate)} · {report.sharedWith?.length ? 'Shared with doctor' : 'Private'}</span></div><span className={`report-status ${report.processingStatus === 'COMPLETED' ? 'status-done' : ''}`}><i/>Uploaded</span></div>)}</div><Link to="/reports" className="upload-inline"><span><Upload size={17}/></span><b>Upload a new report</b><ArrowRight size={16}/></Link></section>
      </div>
      {doctors.length > 0 && <section className="specialists-section"><SectionHead label="A LITTLE HELP GOES A LONG WAY" title="Care that fits your needs" action="Explore all doctors" to="/find-care"/><div className="specialist-cards">{doctors.slice(0, 3).map((doctor, i) => <DoctorCard key={doctor._id} doctor={doctor} compact tint={['mint', 'peach', 'blue'][i]} />)}</div></section>}
      <div className="safety-footer"><ShieldCheck size={15}/> Your health information is private and secure <span>·</span> Reports are shared only with the doctor you choose.</div>
    </>}
  </div>
}

function StatCard({ icon: Icon, tint, label, value, suffix, sub }) { return <div className="stat-card"><div className={`stat-icon ${tint}`}><Icon size={18}/></div><span className="stat-label">{label}</span><div className="stat-value">{value}<small>{suffix}</small></div><div className="stat-sub">{sub}</div></div> }

function ProviderDashboard({ appointments, reports, doctors, hospitals, role, sessionUser, onUpdateStatus, onUpdateNotes, onUpdateAvailability, onAddHospital, onAddDoctor, notify }) {
  const isDoctor = role === 'DOCTOR'
  const todayAppointments = appointments.filter(appointment => appointment.date === hyderabadToday() && ['BOOKED', 'CONFIRMED'].includes(appointment.status)).length
  const manageableDoctors = role === 'HOSPITAL_ADMIN' && !sessionUser?.hospitalId
    ? doctors
    : doctors.filter(doctor => String(doctor.hospitalId) === String(sessionUser?.hospitalId))
  return <>
    <div className="provider-banner"><div className="provider-banner-icon">{isDoctor ? <Stethoscope size={24}/> : <HeartPulse size={24}/>}</div><div><b>{isDoctor ? 'Your practice at a glance' : 'Hospital administration'}</b><span>{isDoctor ? 'Stay on top of your visits and patient care.' : 'Manage your hospitals and provider directory.'}</span></div><Link to="/appointments" className="btn btn-white">{isDoctor ? 'View schedule' : 'Manage appointments'} <ArrowRight size={15}/></Link></div>
    <div className="automatic-schedule-note"><Clock size={15}/><span>Appointment times are generated automatically every day: 9:00 AM–6:00 PM, 15-minute visits, with a 1:00–2:00 PM lunch break.</span></div>
    <div className="quick-stats"><StatCard icon={CalendarCheck2} tint="tint-mint" label="Today's appointments" value={todayAppointments.toString().padStart(2, '0')} sub="From scheduled visits"/><StatCard icon={Users} tint="tint-blue" label="Upcoming visits" value={appointments.length.toString().padStart(2, '0')} sub="Patient appointments"/><StatCard icon={FileCheck2} tint="tint-peach" label="Reports to review" value={reports.length.toString().padStart(2, '0')} sub="Patient records"/><StatCard icon={Activity} tint="tint-lilac" label={isDoctor ? 'My doctor profile' : 'Listed doctors'} value={isDoctor ? (sessionUser?.doctorId ? '1' : '0') : manageableDoctors.length.toString()} sub={isDoctor ? 'Linked account' : 'From MongoDB'}/></div>
    <AppointmentsPage appointments={appointments} provider onUpdateStatus={onUpdateStatus} onUpdateNotes={onUpdateNotes} role={role} notify={notify}/>
    <div className="provider-actions"><Link to="/reports" className="btn btn-secondary"><Upload size={15}/> {isDoctor ? 'Upload a patient report' : 'Upload a hospital report'}</Link><Link to="/find-care" className="btn btn-light"><Users size={15}/> {isDoctor ? 'View my profile' : 'View provider directory'}</Link></div>
    {role === 'HOSPITAL_ADMIN' && <><HospitalManager hospitals={hospitals} onAddHospital={onAddHospital}/><DoctorManager doctors={doctors} hospitals={hospitals} hospitalId={sessionUser?.hospitalId} onAddDoctor={onAddDoctor}/></>}
    <div className="safety-footer"><ShieldCheck size={15}/> Patient report access is limited to authorized care relationships.</div>
  </>
}

export function FindCarePage({ doctors, hospitals, city, onBook, notify, catalogLoading, catalogError }) {
  const [query, setQuery] = useState('')
  const [doctorSearch, setDoctorSearch] = useState('')
  const [specialist, setSpecialist] = useState('All specialties')
  const [booking, setBooking] = useState(null)
  const [result, setResult] = useState(null)
  const [recommending, setRecommending] = useState(false)
  useEffect(() => { setResult(null); setSpecialist('All specialties') }, [city])
  const cityHospitals = hospitals.filter(h => h.city?.toLowerCase() === city.toLowerCase())
  const cityDoctors = doctors.filter(d => {
    const hospital = hospitals.find(h => String(h._id) === String(d.hospitalId))
    const doctorCity = d.city || hospital?.city
    return doctorCity?.toLowerCase() === city.toLowerCase()
  })
  const specs = ['All specialties', ...new Set(cityDoctors.map(d => d.specialization))]
  const recommend = async (text) => {
    setQuery(text)
    setResult(null)
    setRecommending(true)
    try {
      const { data } = await api.post('/symptoms/recommend-specialist', { symptoms: text, city })
      setResult(data)
      setSpecialist('All specialties')
    } catch (error) {
      notify(error.response?.data?.message || 'The symptom recommendation service could not be reached.')
    } finally { setRecommending(false) }
  }
  const recommendedDoctorIds = new Set((result?.doctors || []).map(doctor => String(doctor._id)))
  const filtered = cityDoctors.filter(d => (!result || recommendedDoctorIds.has(String(d._id))) && (specialist === 'All specialties' || d.specialization === specialist || (specialist === 'Endocrinologist' && d.specialization === 'Diabetologist')) && `${d.name} ${d.specialization} ${d.hospital}`.toLowerCase().includes(doctorSearch.toLowerCase()))
  const noLocationCatalog = !catalogLoading && !catalogError && Boolean(city) && !cityDoctors.length && !cityHospitals.length
  const noCityCatalog = !catalogLoading && !catalogError && !city
  return <div className="page fade-in"><div className="page-title-row"><div><div className="eyebrow">CARE, CLOSER TO YOU</div><h1>Find the right care</h1><p>{city ? `Discover doctors and hospitals around ${city}.` : 'Provider cities will appear here when real doctor records are added.'}</p></div><span className="btn btn-secondary"><MapPin size={16}/>{city || 'No city available'}<ChevronDown size={15}/></span></div>
    {catalogLoading && <div className="empty-state" role="status"><h3>Loading care near {city}…</h3><p>Checking current doctors and hospitals.</p></div>}
    {catalogError && <div className="empty-state" role="alert"><h3>Care listings are unavailable</h3><p>{catalogError}</p></div>}
    {noCityCatalog && <div className="empty-state" role="status"><h3>No cities with provider records are available yet.</h3><p>Hospitals and doctors will appear here after real provider records are added.</p></div>}
    {noLocationCatalog && <div className="empty-state" role="status"><h3>No available doctors or hospitals are present at your location ({city}).</h3><p>Choose another location from the menu above to see available care.</p></div>}
    <section className="symptom-card"><div className="symptom-top"><div className="symptom-spark"><Sparkles size={18}/></div><div><div className="eyebrow">PERSONALIZED FOR YOU</div><h2>Not sure where to start?</h2><p>{city ? `Describe your symptoms and we’ll search the care guide for a suitable doctor type in ${city}.` : 'Symptom recommendations for local doctors are available after provider records are added.'}</p></div></div><form className="symptom-form" onSubmit={e => { e.preventDefault(); if (query.trim()) recommend(query) }}><MessageCircle size={18}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="e.g. I’ve had a persistent headache..." maxLength={1500}/><button className="btn btn-primary" type="submit" disabled={recommending || !query.trim() || !city}><Sparkles size={15}/> {recommending ? 'Searching…' : 'Get suggestion'}</button></form>{result && <div className="recommendation-box"><div className="rec-check"><Check size={16}/></div><div><b>Consider a {result.specialties.join(' or ')}</b><span>{result.explanation} {result.doctorMessage || `${result.doctors.length} matching doctor${result.doctors.length === 1 ? '' : 's'} found in ${result.city}.`}</span></div><button className="icon-button" onClick={() => { setResult(null); setSpecialist('All specialties') }} aria-label="Clear recommendation"><X size={16}/></button></div>}<div className="suggestion-row"><span>Try:</span>{['Skin concern', 'Joint pain', 'High blood sugar'].map(s => <button onClick={() => recommend(s)} key={s} disabled={!city || recommending}>{s}</button>)}</div></section>
    <div className="care-search-row"><div><div className="eyebrow">{result ? 'MATCHED TO YOUR SYMPTOMS' : 'SPECIALISTS NEAR YOU'}</div><h2>{result ? `Recommended doctors in ${city}` : `Doctors in ${city}`}</h2></div><div className="care-filters"><label className="select-filter"><Filter size={15}/><select value={specialist} onChange={e => setSpecialist(e.target.value)}>{specs.map(s => <option key={s}>{s}</option>)}</select><ChevronDown size={14}/></label><label className="search-filter"><Search size={16}/><input value={doctorSearch} onChange={e => setDoctorSearch(e.target.value)} placeholder="Search doctors"/></label></div></div>
    {!catalogLoading && !catalogError && Boolean(city) && !noLocationCatalog && <div className="doctor-results">{filtered.length ? filtered.map((doctor, i) => <DoctorCard key={doctor._id} doctor={doctor} tint={doctor.tint || ['mint', 'peach', 'blue'][i % 3]} onBook={() => setBooking(doctor)}/>) : <div className="empty-state"><h3>{cityDoctors.length ? 'No doctors match these filters' : `No doctors are available in ${city}.`}</h3><p>Change location or adjust your search to see other care options.</p></div>}</div>}
    {!catalogLoading && !catalogError && Boolean(city) && !noLocationCatalog && <><div className="nearby-head"><div><div className="eyebrow">CARE IN YOUR NEIGHBORHOOD</div><h2>Hospitals in {city}</h2></div></div>{cityHospitals.length ? <div className="hospital-grid">{cityHospitals.map(h => <div className="hospital-card" key={h._id}><div className={`hospital-art ${h.color || 'mint'}`}><div className="hospital-symbol"><HeartPulse size={24}/></div><span>{h.openSlots ?? 0} slots today</span></div><div className="hospital-info"><div className="hospital-name-row"><b>{h.name}</b><span className="rating"><Star size={13} fill="currentColor"/> {h.rating ?? 'Rating not listed'}</span></div><span className="hospital-location"><MapPin size={14}/>{h.area}, {h.city}</span><div className="dept-chips">{(h.departments || []).slice(0, 3).map(dep => <span key={dep}>{dep}</span>)}</div><button className="hospital-action" onClick={() => { setSpecialist('All specialties'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>View doctors <ArrowRight size={15}/></button></div></div>)}</div> : <div className="empty-state"><h3>No hospitals are available in {city}.</h3><p>Choose another location to see nearby care.</p></div>}</>}
    {booking && <BookingModal doctor={booking} hospitals={hospitals} onClose={() => setBooking(null)} onConfirm={onBook} />}
    <p className="medical-disclaimer">Specialist suggestions are informational only and do not establish a diagnosis. For urgent symptoms, contact local emergency services.</p>
  </div>
}

function DoctorCard({ doctor, compact = false, tint = 'mint', onBook }) {
  const experience = doctor.experience || (doctor.experienceYears != null ? `${doctor.experienceYears} years` : 'Experience not listed')
  const fee = doctor.fee ?? doctor.consultationFee
  const nextDate = doctor.nextAvailable?.date
    ? new Date(`${doctor.nextAvailable.date}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : ''
  const nextTimes = doctor.nextAvailable?.slots || []
  return <article className={`doctor-card ${compact ? 'doctor-compact' : ''}`}><div className="doctor-card-top"><div className={`doctor-avatar ${tint}`}>{doctor.initials || doctor.name?.split(' ').slice(-2).map(x => x[0]).join('')}</div><button className="icon-button favorite" aria-label="Save doctor"><Heart size={17}/></button></div><div className="doctor-name-line"><h3>{doctor.name}</h3>{doctor.verified && <span className="doctor-verified"><CheckCircle2 size={14}/></span>}</div><div className="doctor-specialty">{doctor.specialization}</div><div className="doctor-rating"><Star size={14} fill="currentColor"/> <b>{doctor.rating ?? 'Rating not listed'}</b><span>·</span>{experience} experience</div><div className="doctor-hospital"><MapPin size={14}/><span>{doctor.hospital || 'Hospital not listed'}</span></div>{!compact && <div className="doctor-next-availability"><Clock size={14}/>{nextTimes.length ? <>Next open {nextDate}: {nextTimes.slice(0, 3).join(', ')}{nextTimes.length > 3 ? ` +${nextTimes.length - 3} more` : ''}</> : 'No open times scheduled'}</div>}<div className="doctor-card-bottom"><span className="doctor-fee"><b>{fee == null ? 'Fee not listed' : `₹${fee}`}</b>{fee != null && <small> / visit</small>}</span>{onBook ? <button onClick={onBook} className="btn btn-primary btn-sm">Book visit</button> : <Link to="/find-care" className="btn btn-light btn-sm">View profile <ArrowRight size={14}/></Link>}</div></article>
}

function BookingModal({ doctor, hospitals, onClose, onConfirm }) {
  const today = hyderabadToday()
  const [date, setDate] = useState(today)
  const [availableSlots, setAvailableSlots] = useState([])
  const [time, setTime] = useState('')
  const [loadingSlots, setLoadingSlots] = useState(true)
  const [slotsError, setSlotsError] = useState('')
  const [refreshSlots, setRefreshSlots] = useState(0)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const hospital = hospitals.find(h => h._id === doctor.hospitalId)
  useEffect(() => {
    let active = true
    api.get(`/doctors/${doctor._id}/availability`).then(({ data }) => {
      if (!active) return
      const firstOpenDay = data.find(day => day.date >= today && day.slots?.length)
      if (firstOpenDay) setDate(firstOpenDay.date)
    }).catch(() => {})
    return () => { active = false }
  }, [doctor._id, today])
  useEffect(() => {
    let active = true
    const loadAvailability = () => api.get(`/doctors/${doctor._id}/availability`, { params: { date } }).then(({ data }) => {
      if (!active) return
      const current = data.find(day => day.date === date)?.slots || []
      setAvailableSlots(current)
      setTime(previous => current.includes(previous) ? previous : current[0] || '')
      setSlotsError('')
      setLoadingSlots(false)
    }).catch(() => {
      if (!active) return
      setAvailableSlots([])
      setTime('')
      setSlotsError('Could not check the live availability for this doctor.')
      setLoadingSlots(false)
    })
    setLoadingSlots(true)
    setSlotsError('')
    loadAvailability()
    const refreshTimer = window.setInterval(loadAvailability, 5000)
    return () => { active = false; window.clearInterval(refreshTimer) }
  }, [doctor._id, date, refreshSlots])
  const slots = availableSlots
  const submit = async (e) => { e.preventDefault(); setSaving(true); const saved = await onConfirm({ doctorId: doctor._id, hospitalId: doctor.hospitalId, date, startTime: time, reason }); setSaving(false); if (saved) onClose(); else setRefreshSlots(value => value + 1) }
  return <Modal title="Book your visit" eyebrow="APPOINTMENT BOOKING" onClose={onClose} wide><form onSubmit={submit} className="booking-form"><div className="booking-provider"><div className={`doctor-avatar ${doctor.tint || 'mint'}`}>{doctor.initials}</div><div><b>{doctor.name}</b><span>{doctor.specialization} · {hospital?.name || doctor.hospital}</span></div><span className="booking-fee">₹{doctor.fee || 600}</span></div><label className="form-label">Choose a date<input type="date" required min={today} value={date} onChange={e => { setDate(e.target.value); setTime('') }}/></label><div className="form-label">Available times{loadingSlots ? <span className="empty-slot-hint">Checking live availability…</span> : slotsError ? <span className="empty-slot-hint">{slotsError} <button type="button" className="text-link" onClick={() => setRefreshSlots(value => value + 1)}>Retry</button></span> : slots.length ? <div className="slot-grid">{[...slots].sort((a, b) => slotMinutes(a) - slotMinutes(b)).map(s => <button type="button" key={s} className={`time-slot ${time === s ? 'selected' : ''}`} onClick={() => setTime(s)}>{s}</button>)}</div> : <span className="empty-slot-hint">No open appointments on this date. Choose another date or ask the doctor or hospital admin to publish availability.</span>}</div><label className="form-label">What would you like the doctor to know? <span className="optional">Optional</span><textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Briefly share the reason for your visit" rows="2" maxLength="240"/></label><div className="booking-safety"><ShieldCheck size={15}/> Your appointment details are private and securely stored.</div><button className="btn btn-primary btn-full" disabled={saving || loadingSlots || !time}>{saving ? 'Confirming…' : 'Confirm appointment'} <ArrowRight size={16}/></button></form></Modal>
}

function AppointmentChatModal({ appointment, role, onClose, notify }) {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [chatError, setChatError] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)
  const fileRef = useRef(null)
  const readOnly = appointment.status === 'CANCELLED'
  useEffect(() => {
    let active = true
    const refresh = () => api.get(`/appointments/${appointment._id}/messages`).then(({ data }) => {
      if (!active) return
      setMessages(Array.isArray(data) ? data : [])
      setChatError('')
      setLoading(false)
    }).catch(error => {
      if (!active) return
      setLoading(false)
      setChatError(error.response?.data?.message || 'Could not load this appointment conversation.')
    })
    refresh()
    const timer = window.setInterval(refresh, 4000)
    return () => { active = false; window.clearInterval(timer) }
  }, [appointment._id])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [messages])

  const downloadAttachment = async attachment => {
    try {
      const { data } = await api.get(`/reports/${attachment._id}/file`, { responseType: 'blob' })
      const url = URL.createObjectURL(data)
      const anchor = document.createElement('a')
      anchor.href = url; anchor.download = attachment.fileName || 'appointment-report'; anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) { notify(error.response?.data?.message || 'The attachment could not be downloaded.') }
  }
  const send = async event => {
    event.preventDefault()
    if (readOnly || sending || (!text.trim() && !file)) return
    if (file && !['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) { notify('Attach a PDF, JPG, JPEG or PNG file.'); return }
    if (file && file.size > 10 * 1024 * 1024) { notify('Attachments must be smaller than 10 MB.'); return }
    setSending(true)
    try {
      let newMessage
      if (file) {
        const body = new FormData()
        body.append('report', file)
        body.append('appointmentId', appointment._id)
        body.append('message', text.trim())
        await api.post('/reports/upload', body)
        const { data } = await api.get(`/appointments/${appointment._id}/messages`)
        newMessage = data.at(-1)
      } else {
        const { data } = await api.post(`/appointments/${appointment._id}/messages`, { text })
        newMessage = data
      }
      setMessages(previous => previous.some(message => message._id === newMessage._id) ? previous : [...previous, newMessage])
      setText(''); setFile(null)
      if (fileRef.current) fileRef.current.value = ''
    } catch (error) { notify(error.response?.data?.message || 'Your message could not be sent.') }
    finally { setSending(false) }
  }

  return <Modal title="Appointment conversation" eyebrow={`${appointment.doctor || 'Doctor'} · ${dayLabel(appointment.date)}`} onClose={onClose} wide>
    <div className="appointment-chat-context"><b>{appointment.hospital || 'Care appointment'}</b><span>{appointment.specialization} · {appointment.startTime} · {appointment.status}</span></div>
    {readOnly && <div className="chat-readonly-note">This appointment was cancelled. The conversation remains available to read.</div>}
    {chatError && <div className="chat-readonly-note" role="alert">{chatError}</div>}
    <div className="appointment-chat-messages" aria-live="polite">
      {loading && !messages.length && <div className="empty-slot-hint">Loading conversation…</div>}
      {!loading && !messages.length && <div className="empty-slot-hint">No messages yet. Start a conversation with your care provider.</div>}
      {messages.map(message => <div key={message._id} className={`chat-message ${message.senderRole === role ? 'chat-message-own' : ''}`}><div className="chat-message-meta"><b>{message.senderName}</b><time>{new Date(message.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</time></div>{message.text && <p>{message.text}</p>}{message.attachment && <button type="button" className="chat-attachment" onClick={() => downloadAttachment(message.attachment)}><FileText size={17}/><span><b>{message.attachment.fileName || message.attachment.reportType || 'Medical report'}</b><small>{message.attachment.mimeType || 'Attachment'}{message.attachment.fileSize ? ` · ${(message.attachment.fileSize / 1048576).toFixed(1)} MB` : ''}</small></span><ArrowRight size={15}/></button>}</div>)}
      <div ref={bottomRef}/>
    </div>
    <form className="appointment-chat-compose" onSubmit={send}>
      {file && <div className="chat-selected-file"><FileText size={15}/>{file.name}<button type="button" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = '' }} aria-label="Remove attachment"><X size={14}/></button></div>}
      <textarea value={text} onChange={event => setText(event.target.value)} placeholder={readOnly ? 'Conversation is read-only' : 'Write a message to the doctor…'} maxLength={4000} rows="2" disabled={readOnly}/>
      <div className="appointment-chat-actions"><label className={`btn btn-light btn-sm ${readOnly ? 'disabled' : ''}`}><Upload size={14}/> Attach report<input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" disabled={readOnly} onChange={event => setFile(event.target.files?.[0] || null)}/></label><button className="btn btn-primary btn-sm" disabled={readOnly || sending || (!text.trim() && !file)}>{sending ? 'Sending…' : 'Send message'} <ArrowRight size={14}/></button></div>
    </form>
  </Modal>
}

export function AppointmentsPage({ appointments, onCancel, onUpdateStatus, onUpdateNotes, role = 'PATIENT', provider = false, notify = () => {} }) {
  const [filter, setFilter] = useState('All visits')
  const [confirmCancel, setConfirmCancel] = useState(null)
  const [chatAppointment, setChatAppointment] = useState(null)
  const [noteAppointment, setNoteAppointment] = useState(null)
  const [noteText, setNoteText] = useState('')
  const filtered = appointments.filter(a => filter === 'All visits' || (filter === 'Upcoming' && !['CANCELLED', 'COMPLETED'].includes(a.status)) || (filter === 'Past' && ['CANCELLED', 'COMPLETED'].includes(a.status)))
  return <div className={`page fade-in ${provider ? 'embedded-page' : ''}`}>{!provider && <div className="page-title-row"><div><div className="eyebrow">YOUR CARE, IN ONE PLACE</div><h1>My appointments</h1><p>Stay organized with your upcoming and past visits.</p></div><Link to="/find-care" className="btn btn-primary"><Calendar size={17}/> Book a visit</Link></div>}{!provider && <div className="tabs-row">{['All visits', 'Upcoming', 'Past'].map(f => <button key={f} className={`tab-button ${filter === f ? 'tab-active' : ''}`} onClick={() => setFilter(f)}>{f}{f === 'Upcoming' && <span>{appointments.filter(a => !['CANCELLED', 'COMPLETED'].includes(a.status)).length}</span>}</button>)}</div>}
    {filtered.length ? <div className="appointment-list">{filtered.map(a => <article className="appointment-card" key={a._id}><div className="appointment-calendar"><span>{new Date(`${a.date}T12:00:00`).toLocaleDateString('en-IN', { month: 'short' }).toUpperCase()}</span><b>{new Date(`${a.date}T12:00:00`).toLocaleDateString('en-IN', { day: '2-digit' })}</b><small>{new Date(`${a.date}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short' })}</small></div><div className="appointment-info"><span className="appointment-specialty">{a.specialization || 'Consultation'}</span><h3>{provider ? a.patientName || 'Patient' : a.doctor || a.doctorName || 'Care provider'}</h3><span>{a.hospital || 'Hospital visit'}</span>{provider && <small className="appointment-reason">Patient appointment with {a.doctor || 'the assigned doctor'}</small>}<p><Clock size={14}/>{a.startTime || a.time} <span>·</span> {dayLabel(a.date)}</p>{a.reason && <small className="appointment-reason">Reason: {a.reason}</small>}</div><div className="appointment-right"><span className={`appointment-status ${a.status?.toLowerCase()}`}>{a.status}</span>{['PATIENT', 'DOCTOR'].includes(role) && <button className="btn btn-light btn-sm" onClick={() => setChatAppointment(a)}><MessageCircle size={13}/> Conversation</button>}{provider && ['BOOKED', 'CONFIRMED'].includes(a.status) && <button className="btn btn-light btn-sm" onClick={() => onUpdateStatus?.(a._id, a.status === 'BOOKED' ? 'CONFIRMED' : 'COMPLETED')}>{a.status === 'BOOKED' ? 'Confirm visit' : 'Mark complete'}</button>}{provider && <button className="btn btn-light btn-sm" onClick={() => { setNoteAppointment(a); setNoteText(a.providerNotes || '') }}>{a.providerNotes ? 'Edit note' : 'Add note'}</button>}{!provider && !['CANCELLED', 'COMPLETED'].includes(a.status) && <button className="btn btn-light btn-sm" onClick={() => setConfirmCancel(a)}>Cancel visit</button>}</div></article>)}</div> : <div className="empty-state"><div className="empty-state-icon"><CalendarCheck2 size={24}/></div><h3>No visits found</h3><p>Your appointments will appear here once booked.</p><Link to="/find-care" className="btn btn-primary">Find a doctor</Link></div>}
    {confirmCancel && <Modal title="Cancel this appointment?" eyebrow="APPOINTMENT UPDATE" onClose={() => setConfirmCancel(null)}><p className="modal-copy">Your visit with <b>{confirmCancel.doctor || 'your doctor'}</b> on {dayLabel(confirmCancel.date)} at {confirmCancel.startTime || confirmCancel.time} will be cancelled.</p><div className="modal-actions"><button className="btn btn-light" onClick={() => setConfirmCancel(null)}>Keep appointment</button><button className="btn btn-danger" onClick={async () => { const cancelled = await onCancel(confirmCancel._id); if (cancelled !== false) setConfirmCancel(null) }}>Cancel visit</button></div></Modal>}
    {noteAppointment && <Modal title="Appointment note" eyebrow="PROVIDER NOTE" onClose={() => setNoteAppointment(null)}><p className="modal-copy">Add a note for the care team about {noteAppointment.patientName || 'this patient'}’s visit.</p><label className="form-label"><textarea rows="5" maxLength="1000" value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Write a brief visit note…"/></label><div className="modal-actions"><button className="btn btn-light" onClick={() => setNoteAppointment(null)}>Close</button><button className="btn btn-primary" onClick={() => { onUpdateNotes?.(noteAppointment._id, noteText); setNoteAppointment(null) }}>Save note</button></div></Modal>}
    {chatAppointment && <AppointmentChatModal appointment={chatAppointment} role={role} onClose={() => setChatAppointment(null)} notify={notify}/>}
  </div>
}

export function ReportsPage({ reports, onAddReport, notify, role = 'PATIENT', appointments = [], doctors = [] }) {
  const [uploading, setUploading] = useState(false)
  const [selected, setSelected] = useState(null)
  const [drag, setDrag] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState('')
  const [selectedDoctorUser, setSelectedDoctorUser] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const providerPatients = [...new Map(appointments.filter(a => a.patientId).map(a => [String(a.patientId), { id: String(a.patientId), name: a.patientName || 'Patient' }])).values()]
  const patientDoctors = doctors.filter(doctor => doctor.userId)
  const isProvider = role !== 'PATIENT'
  const handleFile = async (file) => {
    if (!file) return
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) { notify('Please choose a PDF, JPG, JPEG or PNG file.'); return }
    if (file.size > 10 * 1024 * 1024) { notify('Files must be smaller than 10 MB.'); return }
    const patientId = isProvider ? selectedPatient || providerPatients[0]?.id : ''
    if (isProvider && !patientId) { notify('A patient with an appointment is required before upload.'); return }
    const doctorUserId = isProvider ? '' : selectedDoctorUser || patientDoctors[0]?.userId
    if (!isProvider && !doctorUserId) { notify('No doctor account is available to receive this report.'); return }
    setUploading(true)
    try {
      const body = new FormData(); body.append('report', file)
      if (isProvider) body.append('patientId', patientId)
      else body.append('doctorUserId', doctorUserId)
      const { data } = await api.post('/reports/upload', body)
      onAddReport(data); notify(isProvider ? 'Original report uploaded.' : 'Original report uploaded and shared with the selected doctor.')
    } catch (error) {
      notify(error.response?.data?.message || 'The report could not be uploaded.')
    } finally { setUploading(false) }
  }
  useEffect(() => {
    let objectUrl = ''
    let active = true
    if (selected?.mimeType?.startsWith('image/')) {
      api.get(`/reports/${selected._id}/file`, { responseType: 'blob' }).then(({ data }) => {
        const nextUrl = URL.createObjectURL(data)
        if (active) { objectUrl = nextUrl; setPreviewUrl(nextUrl) }
        else URL.revokeObjectURL(nextUrl)
      }).catch(() => notify('The original image could not be opened.'))
    }
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); setPreviewUrl('') }
  }, [selected?._id])
  const downloadOriginal = async (report) => {
    try {
      const { data } = await api.get(`/reports/${report._id}/file`, { responseType: 'blob' })
      const url = URL.createObjectURL(data)
      const link = document.createElement('a')
      link.href = url
      link.download = report.fileName || `${report.reportType || 'medical-report'}`
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) { notify(error.response?.data?.message || 'The original report could not be downloaded.') }
  }
  return <div className="page fade-in"><div className="page-title-row"><div><div className="eyebrow">{isProvider ? 'AUTHORIZED PATIENT RECORDS' : 'YOUR HEALTH RECORDS'}</div><h1>Medical reports</h1><p>{isProvider ? 'View original reports patients have shared with you.' : 'Upload the original report and choose which doctor receives it.'}</p></div><div className="report-upload-actions">{isProvider ? <label className="form-label provider-patient-select">Patient<select value={selectedPatient || providerPatients[0]?.id || ''} onChange={e => setSelectedPatient(e.target.value)} required><option value="">Select patient</option>{providerPatients.map(patient => <option key={patient.id} value={patient.id}>{patient.name}</option>)}</select></label> : <label className="form-label provider-patient-select">Send to doctor<select value={selectedDoctorUser || patientDoctors[0]?.userId || ''} onChange={e => setSelectedDoctorUser(e.target.value)} required><option value="">Select doctor</option>{patientDoctors.map(doctor => <option key={doctor.userId} value={doctor.userId}>{doctor.name} · {doctor.specialization}</option>)}</select></label>}<label className={`btn btn-primary upload-cta ${uploading ? 'disabled' : ''}`}><Upload size={17}/> Upload report<input type="file" accept=".pdf,.jpg,.jpeg,.png" disabled={uploading} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; handleFile(file) }}/></label></div></div>
    <label className={`upload-dropzone ${drag ? 'drag-active' : ''}`} onDragOver={e => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)} onDrop={e => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files?.[0]) }}><div className="upload-drop-icon">{uploading ? <div className="spinner"/> : <Upload size={21}/>}</div><b>{uploading ? 'Uploading the original report…' : 'Drop a report here, or browse'}</b><span>PDF, JPG, JPEG or PNG · Up to 10 MB · Stored on this server</span><input type="file" accept=".pdf,.jpg,.jpeg,.png" disabled={uploading} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; handleFile(file) }}/></label>
    <div className="report-page-heading"><div><div className="eyebrow">YOUR LIBRARY</div><h2>All reports <span>{reports.length.toString().padStart(2, '0')}</span></h2></div><button className="filter-date" onClick={() => notify('Showing all reports')}><Calendar size={15}/> All dates <ChevronDown size={14}/></button></div>
    <div className="reports-table"><div className="table-header"><span>ORIGINAL REPORT</span><span>UPLOADED</span><span>FILE SIZE</span><span>SHARING</span><span/></div>{[...reports].sort((a, b) => String(b.uploadDate).localeCompare(String(a.uploadDate))).map((r, i) => <button key={r._id} className="table-report-row" onClick={() => setSelected(r)}><span className="table-report-name"><span className={`file-icon file-${i % 3}`}><FileText size={17}/></span><span><b>{r.reportType}</b><small>{r.fileName || 'Uploaded report'} · {r.mimeType || 'file'}</small></span></span><span className="table-date">{dayLabel(r.uploadDate)}</span><span className="table-values">{typeof r.fileSize === 'number' ? `${(r.fileSize / 1048576).toFixed(1)} MB` : '—'}</span><span><span className="report-status status-done"><i/>{isProvider ? 'Received' : r.sharedWith?.length ? 'Sent to doctor' : 'Private'}</span></span><span><ChevronRight size={17}/></span></button>)}</div>
    <div className="report-privacy"><ShieldCheck size={17}/><span><b>Your records stay yours.</b> Reports are only visible to you and care providers you authorize.</span><Link to="/settings">Privacy settings <ArrowRight size={14}/></Link></div>
    {selected && <Modal title={selected.reportType} eyebrow={`UPLOADED ${dayLabel(selected.uploadDate).toUpperCase()}`} onClose={() => setSelected(null)} wide><div className="analysis-summary"><span className="analysis-spark"><FileText size={18}/></span><div><b>Original uploaded file</b><p>{selected.fileName || selected.reportType}. This is the file provided by the patient, without OCR or automatic changes.</p></div></div>{selected.mimeType?.startsWith('image/') && previewUrl && <img src={previewUrl} alt={`Original ${selected.reportType}`} style={{ display: 'block', maxWidth: '100%', maxHeight: '65vh', margin: '16px auto', objectFit: 'contain', borderRadius: 8 }}/>}<button className="btn btn-primary btn-full" onClick={() => downloadOriginal(selected)}>Download original report <ArrowRight size={16}/></button>{role === 'PATIENT' && <div className="report-privacy"><ShieldCheck size={17}/><span>This report is visible to you and the doctor selected when it was uploaded.</span></div>}</Modal>}
  </div>
}

function ShareReport({ doctors, report, notify }) {
  const [doctorId, setDoctorId] = useState(doctors[0]?.userId || '')
  const [sharing, setSharing] = useState(false)
  const share = async () => {
    if (!doctorId) return
    setSharing(true)
    try {
      const { data } = await api.post(`/reports/${report._id}/share`, { userId: doctorId })
      notify(data.message || 'Report shared with your care provider.')
    } catch (error) { notify(error.response?.data?.message || 'Sign in to manage report sharing.') }
    finally { setSharing(false) }
  }
  return <div className="share-report"><ShieldCheck size={15}/><label>Share with a care provider<select value={doctorId} onChange={e => setDoctorId(e.target.value)}>{doctors.map(d => <option key={d.userId} value={d.userId}>{d.name} · {d.specialization}</option>)}</select></label><button className="btn btn-light btn-sm" disabled={sharing} onClick={share}>{sharing ? 'Sharing…' : 'Share report'}</button></div>
}

function AvailabilityPanel({ doctors, role, sessionUser, onSave }) {
  const manageable = role === 'DOCTOR'
    ? doctors.filter(doctor => String(doctor._id) === String(sessionUser?.doctorId))
    : sessionUser?.hospitalId
      ? doctors.filter(doctor => String(doctor.hospitalId) === String(sessionUser.hospitalId))
      : doctors
  const [doctorId, setDoctorId] = useState('')
  const doctor = manageable.find(item => String(item._id) === String(doctorId)) || manageable[0]
  const today = hyderabadToday()
  const [date, setDate] = useState(today)
  const [slots, setSlots] = useState([])
  const [bookedSlots, setBookedSlots] = useState([])
  const [newTime, setNewTime] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const existing = doctor?.availability?.find(day => day.date === date)?.slots || []
  useEffect(() => { setSlots(existing); setSaved(false) }, [doctor?._id, date])
  useEffect(() => {
    if (!doctor?._id) return
    let active = true
    const refreshBookedSlots = () => api.get(`/doctors/${doctor._id}/availability`, { params: { date } }).then(({ data }) => {
      if (active) setBookedSlots(data.find(day => day.date === date)?.bookedSlots || [])
    }).catch(() => { if (active) setBookedSlots([]) })
    refreshBookedSlots()
    const timer = window.setInterval(refreshBookedSlots, 5000)
    return () => { active = false; window.clearInterval(timer) }
  }, [doctor?._id, date])
  const slotChoices = [...new Set(slots)].sort((a, b) => slotMinutes(a) - slotMinutes(b))
  const addTime = () => {
    if (!newTime) return
    const [rawHour, minute] = newTime.split(':').map(Number)
    const hour = rawHour % 12 || 12
    const label = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${rawHour >= 12 ? 'PM' : 'AM'}`
    setSaved(false)
    setSlots(prev => [...new Set([...prev, label])].sort((a, b) => slotMinutes(a) - slotMinutes(b)))
    setNewTime('')
  }
  if (!manageable.length) return <div className="empty-provider-panel"><Stethoscope size={18}/><span>No linked doctor profile is available for this account.</span></div>
  const save = async () => {
    setSaving(true); setSaved(false)
    const ok = await onSave(doctor._id, date, slotChoices)
    setSaving(false); setSaved(Boolean(ok))
  }
  return <section className="panel availability-panel"><div className="panel-heading"><div><div className="eyebrow">SCHEDULE MANAGEMENT</div><h2>Doctor availability</h2></div><span className="availability-lock"><ShieldCheck size={14}/> 30-minute slots · India time</span></div><div className="availability-controls"><label className="form-label">Doctor{role === 'HOSPITAL_ADMIN' && <select value={doctor?._id || ''} onChange={e => { setDoctorId(e.target.value); setSlots([]); setSaved(false) }}>{manageable.map(item => <option key={item._id} value={item._id}>{item.name} · {item.specialization}</option>)}</select>}{role === 'DOCTOR' && <input value={`${doctor.name} · ${doctor.specialization}`} readOnly/>}</label><label className="form-label">Date<input type="date" min={today} value={date} onChange={e => { setDate(e.target.value); setSlots([]); setSaved(false) }}/></label></div><div className="availability-slot-list">{slotChoices.map(slot => { const isBooked = bookedSlots.includes(slot); return <label key={slot} className={`availability-slot ${isBooked ? 'slot-booked' : ''}`}><input type="checkbox" checked={slots.includes(slot)} disabled={isBooked} onChange={e => { setSaved(false); setSlots(prev => e.target.checked ? [...new Set([...prev, slot])] : prev.filter(value => value !== slot)) }}/>{slot}{isBooked && <small>Booked</small>}</label>})}{!slotChoices.length && <span className="empty-slot-hint">No slots yet. Add times in India time; appointments last 30 minutes.</span>}</div><div className="availability-footer"><div className="add-time"><input aria-label="Add appointment time" type="time" step="1800" min={date === today ? nextHyderabadSlotTime() : undefined} value={newTime} onChange={e => setNewTime(e.target.value)}/><button className="btn btn-light btn-sm" type="button" onClick={addTime} disabled={!newTime}>Add time</button></div><button className="btn btn-primary btn-sm" type="button" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save availability'}</button></div>{saved && <div className="empty-slot-hint" role="status">Availability saved for {date}. Patients can book these times now.</div>}</section>
}

function HospitalManager({ hospitals, onAddHospital }) {
  const [expanded, setExpanded] = useState(hospitals.length === 0)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [area, setArea] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [contact, setContact] = useState('')
  const [departments, setDepartments] = useState('')
  const submit = async event => {
    event.preventDefault()
    const created = await onAddHospital({
      name: name.trim(), address: address.trim(), area: area.trim(), city: city.trim(), state: state.trim(),
      contact: contact.trim(), departments: departments.split(',').map(value => value.trim()).filter(Boolean),
    })
    if (created) { setName(''); setAddress(''); setArea(''); setCity(''); setState(''); setContact(''); setDepartments('') }
  }
  return <section className="panel doctor-manager"><div className="panel-heading"><div><div className="eyebrow">REAL PROVIDER DIRECTORY</div><h2>Hospitals</h2><small>{hospitals.length} hospitals currently in MongoDB</small></div><button className="btn btn-light btn-sm" onClick={() => setExpanded(!expanded)}>{expanded ? 'Close form' : 'Add hospital'}</button></div>{hospitals.length > 0 && <div className="provider-doctor-list">{hospitals.map(hospital => <div key={hospital._id}><span className="doctor-avatar mint">{hospital.name?.slice(0, 2).toUpperCase()}</span><span><b>{hospital.name}</b><small>{hospital.area ? `${hospital.area}, ` : ''}{hospital.city}</small></span><span className="provider-fee">{hospital.city}</span></div>)}</div>}{expanded && <form className="doctor-add-form" onSubmit={submit}><label className="form-label">Hospital name<input required value={name} onChange={e => setName(e.target.value)}/></label><label className="form-label">Address<input required value={address} onChange={e => setAddress(e.target.value)}/></label><label className="form-label">Area<input value={area} onChange={e => setArea(e.target.value)}/></label><label className="form-label">City<input required value={city} onChange={e => setCity(e.target.value)} placeholder="Enter hospital city" maxLength={80}/></label><label className="form-label">State<input value={state} onChange={e => setState(e.target.value)}/></label><label className="form-label">Contact<input value={contact} onChange={e => setContact(e.target.value)}/></label><label className="form-label">Departments<input value={departments} onChange={e => setDepartments(e.target.value)} placeholder="Cardiology, Orthopedics"/></label><button className="btn btn-primary btn-sm">Save hospital</button></form>}</section>
}

function DoctorManager({ doctors, hospitals, hospitalId, onAddDoctor }) {
  const [expanded, setExpanded] = useState(true)
  const [selectedHospitalId, setSelectedHospitalId] = useState(hospitalId || '')
  const [name, setName] = useState('')
  const [specialization, setSpecialization] = useState('General Physician')
  const [experienceYears, setExperienceYears] = useState('')
  const [consultationFee, setConsultationFee] = useState('')
  const [loginEmail, setLoginEmail] = useState('')
  const [initialPassword, setInitialPassword] = useState('')
  const allowedHospitals = hospitalId ? hospitals.filter(hospital => String(hospital._id) === String(hospitalId)) : hospitals
  useEffect(() => {
    if (hospitalId) setSelectedHospitalId(String(hospitalId))
    else if (!allowedHospitals.some(hospital => String(hospital._id) === String(selectedHospitalId))) setSelectedHospitalId(String(allowedHospitals[0]?._id || ''))
  }, [hospitalId, allowedHospitals, selectedHospitalId])
  const team = doctors.filter(doctor => String(doctor.hospitalId) === String(selectedHospitalId))
  const submit = async event => {
    event.preventDefault()
    const created = await onAddDoctor({ name: name.trim(), specialization, hospitalId: selectedHospitalId, experienceYears: Number(experienceYears || 0), consultationFee: Number(consultationFee || 0), loginEmail: loginEmail.trim(), initialPassword })
    if (created) { setName(''); setExperienceYears(''); setConsultationFee(''); setLoginEmail(''); setInitialPassword('') }
  }
  return <section className="panel doctor-manager"><div className="panel-heading"><div><div className="eyebrow">DOCTOR ACCOUNTS</div><h2>Doctors & specialties</h2></div><button className="btn btn-light btn-sm" onClick={() => setExpanded(!expanded)}>{expanded ? 'Close form' : 'Add doctor'}</button></div><label className="form-label">Hospital<select value={selectedHospitalId} onChange={e => setSelectedHospitalId(e.target.value)} disabled={Boolean(hospitalId)} required><option value="">Select a hospital</option>{allowedHospitals.map(hospital => <option key={hospital._id} value={hospital._id}>{hospital.name} · {hospital.city}</option>)}</select></label><div className="provider-doctor-list">{team.map(doctor => <div key={doctor._id}><span className="doctor-avatar mint">{doctor.initials || 'DR'}</span><span><b>{doctor.name}</b><small>{doctor.specialization} · {doctor.experienceYears ?? 0} years · {doctor.loginEmail || 'Login linked'}</small></span><span className="provider-fee">₹{doctor.consultationFee ?? 0}</span></div>)}{!team.length && selectedHospitalId && <div className="empty-provider-panel"><Stethoscope size={18}/><span>No doctors are registered for this hospital yet.</span></div>}{!hospitals.length && <div className="empty-provider-panel"><MapPin size={18}/><span>Add a hospital first, then register its doctors.</span></div>}</div>{expanded && <form className="doctor-add-form" onSubmit={submit}><label className="form-label">Doctor name<input required value={name} onChange={e => setName(e.target.value)} placeholder="Doctor full name"/></label><label className="form-label">Specialty<select value={specialization} onChange={e => setSpecialization(e.target.value)}>{['General Physician', 'Cardiologist', 'Endocrinologist', 'Diabetologist', 'Dermatologist', 'Neurologist', 'Nephrologist', 'Orthopedist', 'Gastroenterologist', 'Ophthalmologist'].map(spec => <option key={spec}>{spec}</option>)}</select></label><label className="form-label">Doctor login email<input type="email" required value={loginEmail} onChange={e => setLoginEmail(e.target.value)}/></label><label className="form-label">Temporary password<input type="password" required minLength="8" value={initialPassword} onChange={e => setInitialPassword(e.target.value)}/></label><label className="form-label">Experience (years)<input type="number" min="0" max="60" value={experienceYears} onChange={e => setExperienceYears(e.target.value)}/></label><label className="form-label">Visit fee (₹)<input type="number" min="0" max="100000" value={consultationFee} onChange={e => setConsultationFee(e.target.value)}/></label><button className="btn btn-primary btn-sm" disabled={!selectedHospitalId}>Create doctor profile and login</button></form>}</section>
}

export function TrendsPage({ reports }) {
  const [metric, setMetric] = useState('HbA1c')
  const metricData = useMemo(() => {
    const found = reports.flatMap(r => (r.extractedParameters || []).filter(p => p.name.toLowerCase().includes(metric.toLowerCase())).map(p => ({ date: new Date(`${r.uploadDate}T12:00:00`).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }), uploadDate: r.uploadDate, value: Number(p.value), unit: p.unit }))).sort((a, b) => a.uploadDate.localeCompare(b.uploadDate))
    if (found.length) return found
    return []
  }, [reports, metric])
  const first = metricData[0]?.value; const last = metricData.at(-1)?.value
  const metricTileValue = (name) => {
    const term = name === 'Blood glucose' ? 'glucose' : name.toLowerCase()
    const matches = reports.flatMap(report => (report.extractedParameters || []).filter(p => p.name.toLowerCase().includes(term)).map(p => ({ date: report.uploadDate, value: p.value, unit: p.unit }))).sort((a, b) => a.date.localeCompare(b.date))
    return matches.length ? `${matches.at(-1).value} ${matches.at(-1).unit}` : 'No records yet'
  }
  const comparisonText = metricData.length > 1
    ? `The recorded value changed from ${first} to ${last} across the selected reports.`
    : metricData.length === 1 ? 'Only one recorded value is available, so there is not yet a comparison.' : 'Upload reports with this parameter to see recorded values over time.'
  return <div className="page fade-in">
    <div className="page-title-row"><div><div className="eyebrow">A CLEARER PICTURE OVER TIME</div><h1>Your health trends</h1><p>See how values in your reports change over time.</p></div><Link to="/reports" className="btn btn-secondary"><FileText size={16}/> View reports</Link></div>
    <section className="panel big-trend-panel">
      <div className="trend-toolbar"><div><div className="eyebrow">REPORTED VALUES</div><h2>{metric} <span className="metric-unit">{metricData.at(-1)?.unit}</span></h2></div><label className="select-filter"><Activity size={15}/><select value={metric} onChange={e => setMetric(e.target.value)}><option>HbA1c</option><option>Hemoglobin</option><option>Creatinine</option><option>Glucose</option></select><ChevronDown size={14}/></label></div>
      <div className="trend-big-value">{last ?? '—'} <small>{metricData.at(-1)?.unit}</small><span className="trend-change">{metricData.length > 1 ? `Recorded ${first === last ? 'at a similar level' : last > first ? 'higher' : 'lower'} than first selected report` : metricData.length === 1 ? 'One report recorded' : 'No values recorded yet'}</span></div>
      <div className="big-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={metricData} margin={{ top: 18, right: 12, left: -20, bottom: 0 }}><defs><linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#168b7e" stopOpacity={0.18}/><stop offset="100%" stopColor="#168b7e" stopOpacity={0.01}/></linearGradient></defs><CartesianGrid strokeDasharray="4 5" vertical={false} stroke="#e9efed"/><XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: '#95a29f', fontSize: 11 }}/><YAxis domain={metricData.length ? ['dataMin - 0.3', 'dataMax + 0.3'] : [0, 1]} tickLine={false} axisLine={false} tick={{ fill: '#95a29f', fontSize: 10 }}/><Tooltip contentStyle={{ border: '1px solid #e7efed', borderRadius: 12 }}/><Area type="monotone" dataKey="value" stroke="#168b7e" strokeWidth={2.5} fill="url(#trendFill)" activeDot={{ r: 5, strokeWidth: 3, fill: '#fff' }}/></AreaChart></ResponsiveContainer></div>
      <div className="trend-neutral-note"><Activity size={16}/><span>{comparisonText} This comparison does not indicate a diagnosis or disease progression.</span></div>
    </section>
    <div className="trend-tiles">{['Blood glucose', 'HbA1c', 'Hemoglobin', 'Cholesterol', 'Blood pressure', 'Creatinine'].map((name, i) => <button key={name} className={`trend-tile ${metric === (name === 'Blood glucose' ? 'Glucose' : name) ? 'selected' : ''}`} onClick={() => setMetric(name === 'Blood glucose' ? 'Glucose' : name)}><span className={`metric-tile-icon metric-${i}`}><Activity size={16}/></span><b>{name}</b><span>{metricTileValue(name)}</span><ChevronRight size={15}/></button>)}</div>
    <p className="medical-disclaimer">Values and comparisons are presented as recorded in uploaded reports. Reference intervals vary by laboratory and individual factors. Discuss results with your healthcare professional.</p>
  </div>
}

export function SettingsPage({ city, cities = [], setCity, notify, sessionUser }) {
  const initials = sessionUser?.name?.split(/\s+/).slice(0, 2).map(word => word[0]).join('') || 'U'
  return <div className="page fade-in"><div className="page-title-row"><div><div className="eyebrow">YOUR ACCOUNT</div><h1>Settings</h1><p>Manage your profile, location and privacy preferences.</p></div></div><div className="settings-grid"><section className="panel settings-panel"><div className="settings-heading"><div className="settings-avatar">{initials}</div><div><h2>{sessionUser?.name || 'Your account'}</h2><span>{sessionUser?.role === 'PATIENT' ? 'Patient account' : sessionUser?.role === 'DOCTOR' ? 'Doctor account' : sessionUser?.role === 'HOSPITAL_ADMIN' ? 'Hospital admin account' : 'Account'}</span></div><button className="btn btn-light btn-sm" onClick={() => notify('Profile editing is available in the connected API.')}>Edit profile</button></div><div className="settings-line"><div><b>Home location</b><span>Choose from cities with registered hospitals</span></div><label className="select-filter"><MapPin size={15}/><select value={city} onChange={e => setCity(e.target.value)} disabled={!cities.length}><option value="">{cities.length ? 'Choose city' : 'No provider cities'}</option>{cities.map(value => <option key={value} value={value}>{value}</option>)}</select><ChevronDown size={14}/></label></div><div className="settings-line"><div><b>Report sharing</b><span>Care providers need your permission to view reports</span></div><span className="privacy-on"><ShieldCheck size={15}/> Permission required</span></div><div className="settings-line"><div><b>Language preference</b><span>Report explanations and care guidance</span></div><select className="native-select"><option>English</option><option>తెలుగు (Telugu)</option></select></div></section><section className="settings-safety"><ShieldCheck size={20}/><b>Your data deserves care.</b><p>Medical reports are sensitive. Only share them with a doctor or hospital when you choose to.</p><Link to="/reports">Review my reports <ArrowRight size={15}/></Link></section></div></div>
}

export function AuthPage({ onLogin, notify }) {
  const navigate = useNavigate()
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [adminSignupKey, setAdminSignupKey] = useState('')
  const [busy, setBusy] = useState(false)
  const isRegister = mode !== 'login'
  const isAdminSignup = mode === 'admin'

  const submit = async e => {
    e.preventDefault(); setBusy(true)
    try {
      const path = mode === 'admin' ? '/auth/register-global-admin' : mode === 'patient' ? '/auth/register' : '/auth/login'
      const { data } = await api.post(path, { name, email, password, ...(isAdminSignup ? { adminSignupKey } : {}) })
      localStorage.setItem('bma_token', data.token); localStorage.setItem('bma_role', data.user.role); localStorage.setItem('bma_user', JSON.stringify(data.user)); onLogin(data.user.role, data.user); navigate('/'); notify(`Welcome${data.user.name ? ', ' + data.user.name.split(' ')[0] : ''}.`)
    } catch (error) { notify(error.response?.data?.message || 'Unable to reach the account service. Check the API connection and try again.'); }
    finally { setBusy(false) }
  }
  return <div className="auth-page">
    <div className="auth-top"><Link to="/" className="brand auth-brand"><div className="brand-mark"><HeartPulse size={22}/></div><div><b>BookMy</b><span>Appointment AI</span></div></Link><span>{isRegister ? 'Already have an account?' : 'Already registered?'} <button onClick={() => setMode('login')}>Sign in</button></span></div>
    <div className="auth-content">
      <div className="auth-form-side">
        <div className="eyebrow">A CALMER WAY TO MANAGE YOUR HEALTH</div>
        <h1>{isAdminSignup ? 'Set up hospital administration.' : isRegister ? 'Start with a little clarity.' : 'Welcome back.'}</h1>
        <p>{isAdminSignup ? 'Create the first global admin account for this MongoDB database.' : isRegister ? 'Create your secure patient account and bring your care together.' : 'Sign in to continue your health journey.'}</p>
        <form className="auth-form" onSubmit={submit}>
          {isRegister && <label className="form-label">Full name<input required value={name} onChange={e => setName(e.target.value)} placeholder="Your name"/></label>}
          {isAdminSignup && <label className="form-label">Admin setup key<input type="password" required value={adminSignupKey} onChange={e => setAdminSignupKey(e.target.value)} placeholder="From server/.env" autoComplete="off"/></label>}
          <label className="form-label">Email address<input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"/></label>
          <label className="form-label">Password<input type="password" required minLength="8" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters"/></label>
          <button className="btn btn-primary btn-full" disabled={busy}>{busy ? 'Please wait…' : isAdminSignup ? 'Create global admin' : isRegister ? 'Create patient account' : 'Sign in'} <ArrowRight size={16}/></button>
        </form>
        {mode === 'login' && <div className="auth-toggle">New to BookMyAppointment? <button onClick={() => setMode('patient')}>Create patient account</button><span> · </span><button onClick={() => setMode('admin')}>Set up first global admin</button></div>}
        {mode === 'patient' && <div className="auth-toggle">Need to set up the first global admin? <button onClick={() => setMode('admin')}>Admin signup</button></div>}
        {mode === 'admin' && <div className="auth-toggle">This setup works only once per database and requires the key from the server administrator.</div>}
        <p className="auth-safe"><ShieldCheck size={14}/> Your health information is protected.</p>
      </div>
      <div className="auth-visual"><div className="auth-visual-label"><span className="pulse-dot"/> CARE THAT FEELS A LITTLE CLOSER</div><div className="auth-quote"><span>“</span><h2>Understand your health.<br/><em>Find your next step.</em></h2><p>Clear information can help you feel more prepared for a conversation with your doctor.</p></div><div className="auth-feature-card"><div className="feature-mini-icon"><Sparkles size={16}/></div><div><b>Original report sharing</b><span>Send your file directly to your selected doctor</span></div><CheckCircle2 size={17}/></div><div className="auth-art-circle circle-a"/><div className="auth-art-circle circle-b"/><div className="auth-art-cross">✳</div></div>
    </div>
    <div className="auth-disclaimer">BookMyAppointment AI provides informational support and does not provide a medical diagnosis.</div>
  </div>
}
