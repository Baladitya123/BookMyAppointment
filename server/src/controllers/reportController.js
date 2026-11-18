const fs = require('fs/promises')
const path = require('path')
const { all, byId, create, remove } = require('../services/repository')

function idEquals(left, right) { return String(left) === String(right) }

function reportForClient(report) {
  const { filePath, cloudinaryPublicId, extractedText, extractedParameters, abnormalParameters, summary, explanation, riskCategory, recommendedSpecialist, processingError, ocrEngine, ...visible } = report
  return { ...visible, fileUrl: `/api/reports/${report._id}/file` }
}

async function hasAppointment(user, patientId) {
  const doctorId = user.doctorId
  const hospitalId = user.hospitalId
  const appointments = await all('appointments')
  return appointments.some(item => idEquals(item.patientId, patientId) && item.activeKey !== false && (
    user.role === 'DOCTOR' && idEquals(item.doctorId, doctorId) ||
    user.role === 'HOSPITAL_ADMIN' && idEquals(item.hospitalId, hospitalId)
  ))
}

async function canReadReport(user, report) {
  if (user.role === 'PATIENT') return idEquals(user._id, report.patientId)
  if (idEquals(user._id, report.uploadedBy)) return true
  return (report.sharedWith || []).some(shared => idEquals(shared, user._id))
}

async function visibleReports(user, patientId) {
  const reports = (await all('reports')).filter(report => Boolean(report.filePath))
  if (user.role === 'PATIENT') return reports.filter(r => idEquals(r.patientId, user._id))
  if (patientId && !await hasAppointment(user, patientId) && !reports.some(r => idEquals(r.patientId, patientId) && idEquals(r.uploadedBy, user._id))) return null
  return reports.filter(r => (!patientId || idEquals(r.patientId, patientId)) && (idEquals(r.uploadedBy, user._id) || (r.sharedWith || []).some(shared => idEquals(shared, user._id))))
}

async function listReports(req, res) {
  const reports = await visibleReports(req.user)
  return res.json(reports.sort((a, b) => String(b.uploadDate).localeCompare(String(a.uploadDate))).map(reportForClient))
}

async function listSharedReports(req, res) {
  const reports = (await all('reports')).filter(report => Boolean(report.filePath))
  const visible = reports.filter(report => (report.sharedWith || []).some(id => idEquals(id, req.user._id)))
  return res.json(visible.sort((a, b) => String(b.uploadDate).localeCompare(String(a.uploadDate))).map(reportForClient))
}

async function listPatientReports(req, res) {
  if (req.user.role === 'PATIENT' && !idEquals(req.user._id, req.params.userId)) return res.status(403).json({ message: 'You can only access your own reports.' })
  const reports = await visibleReports(req.user, req.params.userId)
  if (!reports) return res.status(403).json({ message: 'The patient must authorize access to their reports.' })
  return res.json(reports.sort((a, b) => String(b.uploadDate).localeCompare(String(a.uploadDate))).map(reportForClient))
}

async function getReport(req, res) {
  const report = await byId('reports', req.params.id)
  if (!report) return res.status(404).json({ message: 'Report not found.' })
  if (!await canReadReport(req.user, report)) return res.status(403).json({ message: 'The patient has not shared this report with you.' })
  return res.json(reportForClient(report))
}

async function uploadReport(req, res) {
  if (!req.file) return res.status(400).json({ message: 'Choose a report file to upload.' })
  let patientId = req.user._id
  let appointment = null
  let sharedWith = []
  const appointmentId = req.body.appointmentId
  if (req.user.role !== 'PATIENT') {
    if (appointmentId) {
      appointment = await byId('appointments', appointmentId)
      if (req.user.role !== 'DOCTOR' || !appointment || appointment.status === 'CANCELLED' || !idEquals(appointment.doctorId, req.user.doctorId)) {
        await fs.unlink(req.file.path).catch(() => {})
        return res.status(403).json({ message: 'Only the assigned doctor can attach a file to this appointment conversation.' })
      }
      patientId = appointment.patientId
      sharedWith = [patientId]
    } else {
      patientId = req.body.patientId
      if (!patientId) { await fs.unlink(req.file.path).catch(() => {}); return res.status(400).json({ message: 'Choose a patient for this report.' }) }
      if (!await hasAppointment(req.user, patientId)) { await fs.unlink(req.file.path).catch(() => {}); return res.status(403).json({ message: 'A current appointment relationship is required before uploading a report for this patient.' }) }
    }
  } else if (appointmentId) {
    appointment = await byId('appointments', appointmentId)
    const doctor = appointment && await byId('doctors', appointment.doctorId)
    const doctorUser = doctor?.userId && await byId('users', doctor.userId)
    if (!appointment || appointment.status === 'CANCELLED' || !idEquals(appointment.patientId, req.user._id) || doctorUser?.role !== 'DOCTOR') {
      await fs.unlink(req.file.path).catch(() => {})
      return res.status(403).json({ message: 'Choose an appointment that belongs to you and has an assigned doctor.' })
    }
    sharedWith = [doctorUser._id]
  } else {
    const doctorUser = await byId('users', req.body.doctorUserId)
    const linkedDoctor = doctorUser && (await all('doctors')).some(doctor => idEquals(doctor.userId, doctorUser._id))
    if (!doctorUser || doctorUser.role !== 'DOCTOR' || !linkedDoctor) {
      await fs.unlink(req.file.path).catch(() => {})
      return res.status(400).json({ message: 'Choose the doctor who should receive this report.' })
    }
    sharedWith = [doctorUser._id]
  }
  const cleanType = String(req.body.reportType || path.basename(req.file.originalname, path.extname(req.file.originalname))).replace(/[<>]/g, '').trim().slice(0, 100) || 'Medical report'
  let report
  try {
    report = await create('reports', {
    patientId, appointmentId: appointment?._id, uploadedBy: req.user._id, uploadedByRole: req.user.role, filePath: req.file.path,
    fileName: req.file.originalname.slice(0, 180), fileSize: req.file.size, mimeType: req.file.mimetype,
    reportType: cleanType, uploadDate: new Date().toISOString().slice(0, 10), sharedWith,
    })
    if (appointment) {
      await create('messages', {
        appointmentId: appointment._id, senderId: req.user._id, senderRole: req.user.role,
        text: String(req.body.message || '').trim().slice(0, 4000), reportId: report._id,
      })
    }
  } catch (error) {
    if (report?._id) await remove('reports', report._id).catch(() => {})
    await fs.unlink(req.file.path).catch(() => {})
    throw error
  }
  const result = await byId('reports', report._id)
  return res.status(201).json(reportForClient(result))
}

async function shareReport(req, res) {
  const report = await byId('reports', req.params.id)
  if (!report) return res.status(404).json({ message: 'Report not found.' })
  if (req.user.role !== 'PATIENT' || !idEquals(report.patientId, req.user._id)) return res.status(403).json({ message: 'Only the patient who owns this report can grant access.' })
  const providerUser = await byId('users', req.body.userId)
  if (!providerUser || !['DOCTOR', 'HOSPITAL_ADMIN'].includes(providerUser.role)) return res.status(400).json({ message: 'Choose a valid care provider account.' })
  const sharedWith = [...new Set([...(report.sharedWith || []).map(String), String(providerUser._id)])]
  const updated = await update('reports', report._id, { sharedWith })
  return res.json({ message: `Report shared with ${providerUser.name}.`, report: reportForClient(updated) })
}

async function revokeReportAccess(req, res) {
  const report = await byId('reports', req.params.id)
  if (!report) return res.status(404).json({ message: 'Report not found.' })
  if (req.user.role !== 'PATIENT' || !idEquals(report.patientId, req.user._id)) return res.status(403).json({ message: 'Only the patient who owns this report can change access.' })
  const sharedWith = (report.sharedWith || []).filter(id => !idEquals(id, req.params.userId))
  await update('reports', report._id, { sharedWith })
  return res.json({ message: 'Report access revoked.' })
}

async function readReportFile(req, res) {
  const report = await byId('reports', req.params.id)
  if (!report) return res.status(404).json({ message: 'Report not found.' })
  if (!await canReadReport(req.user, report)) return res.status(403).json({ message: 'The patient has not shared this report with you.' })
  if (!report.filePath) return res.status(404).json({ message: 'The source document is not available.' })
  res.setHeader('Content-Type', report.mimeType || 'application/octet-stream')
  res.setHeader('Content-Disposition', `inline; filename="${path.basename(report.fileName || 'report')}"`)
  return res.sendFile(path.resolve(report.filePath))
}

async function uploadForPatient(req, res) {
  return uploadReport(req, res)
}

module.exports = { listReports, listSharedReports, listPatientReports, getReport, uploadReport, uploadForPatient, shareReport, revokeReportAccess, readReportFile }
