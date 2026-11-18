const { recommendFromSymptoms } = require('../ai/symptomRag')
const { all } = require('../services/repository')
const { canonicalCity, uniqueCities, matchCity } = require('../services/cities')

function specialtyGroup(value) {
  const name = String(value || '').toLowerCase().replace(/[^a-z]/g, '')
  if (/cardiolog/.test(name)) return 'cardiology'
  if (/endocrin|diabet/.test(name)) return 'endocrinology'
  if (/nephro|renal/.test(name)) return 'nephrology'
  if (/gastro|digestive/.test(name)) return 'gastroenterology'
  if (/dermat/.test(name)) return 'dermatology'
  if (/ophthalm|optomet|eye/.test(name)) return 'ophthalmology'
  if (/orthop|orthopaed|bone|joint/.test(name)) return 'orthopedics'
  if (/neurolog|neuro/.test(name)) return 'neurology'
  if (/general|family|primary/.test(name)) return 'generalmedicine'
  return name
}

async function recommend(req, res, next) {
  const text = String(req.body.symptoms || '').trim()
  if (!text || text.length > 1500) return res.status(400).json({ message: 'Describe symptoms in up to 1,500 characters.' })
  const city = String(req.body.city || req.user.city || '').trim()
  if (!city || city.length > 80) return res.status(400).json({ message: 'Choose a city to find doctors near you.' })
  try {
    const recommendation = await recommendFromSymptoms(text)
    const [allDoctors, hospitals] = await Promise.all([
      all('doctors').then(doctors => doctors.filter(doctor => doctor.isSampleData !== true)),
      all('hospitals').then(items => items.filter(hospital => hospital.isSampleData !== true && canonicalCity(hospital.city))),
    ])
    const selectedCity = matchCity(city, uniqueCities(hospitals))
    if (!selectedCity) return res.status(400).json({ message: 'Choose a city with a registered hospital to find doctors near you.' })
    const hospitalById = new Map(hospitals.map(hospital => [String(hospital._id), hospital]))
    const recommendedGroups = new Set(recommendation.specialties.map(specialtyGroup))
    const doctors = allDoctors
      .map(doctor => {
        const hospital = hospitalById.get(String(doctor.hospitalId))
        return { ...doctor, hospital: hospital?.name || '', city: canonicalCity(hospital?.city || doctor.city) || '', area: hospital?.area || '' }
      })
      .filter(doctor => canonicalCity(doctor.city)?.toLowerCase() === selectedCity.toLowerCase() && recommendedGroups.has(specialtyGroup(doctor.specialization)))
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .map(doctor => ({ ...doctor, fee: doctor.consultationFee, experience: `${doctor.experienceYears || 0} years` }))
    return res.json({
      ...recommendation,
      city: selectedCity,
      doctors,
      doctorMessage: doctors.length ? '' : `No doctors matching ${recommendation.specialties.join(' or ')} are listed in ${selectedCity}.`,
      disclaimer: 'This is an informational care-navigation suggestion, not a medical diagnosis. For urgent symptoms, contact local emergency services.',
      informationalOnly: true,
    })
  } catch (error) { return next(error) }
}

async function analyze(req, res) {
  const { explainReport } = require('../ai/rag/reportExplanation')
  const { parseParameters } = require('../ai/reportParser')
  const { extractedText, reportType = 'Medical report' } = req.body
  if (typeof extractedText !== 'string' || extractedText.length > 60000) return res.status(400).json({ message: 'Provide extracted report text up to 60,000 characters.' })
  const extractedParameters = await parseParameters(extractedText)
  const language = req.body.language === 'Telugu' ? 'Telugu' : 'English'
  const result = await explainReport({ reportType: String(reportType).slice(0, 100), extractedText, extractedParameters, language })
  return res.json({ ...result, extractedParameters })
}

async function healthTrends(req, res) {
  if (req.user.role === 'PATIENT' && String(req.user._id) !== String(req.params.patientId)) return res.status(403).json({ message: 'You can only view your own health trends.' })
  if (req.user.role !== 'PATIENT') return res.status(403).json({ message: 'Share report access before viewing patient trends.' })
  const reports = (await all('reports')).filter(r => String(r.patientId) === String(req.params.patientId)).sort((a, b) => String(a.uploadDate).localeCompare(String(b.uploadDate)))
  const series = {}
  for (const report of reports) for (const value of report.extractedParameters || []) {
    if (typeof value.value !== 'number') continue
    const key = value.name
    series[key] ||= []
    series[key].push({ date: report.uploadDate, value: value.value, unit: value.unit, reportId: report._id, reportType: report.reportType })
  }
  return res.json(series)
}

async function listRanges(req, res) { return res.json(await all('ranges')) }

async function updateRange(req, res) {
  const { lower, upper, unit, population, source } = req.body
  const range = (await all('ranges')).find(item => item.parameter.toLowerCase() === req.params.parameter.toLowerCase())
  const values = { unit, lower: lower === '' ? undefined : Number(lower), upper: upper === '' ? undefined : Number(upper), population, source, informationalOnly: true }
  if (!unit || !population || !source || values.lower != null && !Number.isFinite(values.lower) || values.upper != null && !Number.isFinite(values.upper) || values.lower != null && values.upper != null && values.lower > values.upper) return res.status(400).json({ message: 'Provide valid units, limits, population and source.' })
  if (range) {
    const { update } = require('../services/repository')
    return res.json(await update('ranges', range._id, values))
  }
  const { create } = require('../services/repository')
  return res.status(201).json(await create('ranges', { parameter: req.params.parameter, ...values }))
}

module.exports = { recommend, analyze, healthTrends, listRanges, updateRange }
