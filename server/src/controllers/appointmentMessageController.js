const { all, byId, create } = require('../services/repository')

const same = (left, right) => String(left) === String(right)

function isThreadMember(user, appointment) {
  return user.role === 'PATIENT' && same(user._id, appointment.patientId) ||
    user.role === 'DOCTOR' && same(user.doctorId, appointment.doctorId)
}

async function threadFor(req, res) {
  const appointment = await byId('appointments', req.params.id)
  if (!appointment) {
    res.status(404).json({ message: 'Appointment not found.' })
    return null
  }
  if (!isThreadMember(req.user, appointment)) {
    res.status(403).json({ message: 'Only this appointment’s patient and assigned doctor can access its conversation.' })
    return null
  }
  return appointment
}

async function messageForClient(message) {
  const [sender, report] = await Promise.all([
    byId('users', message.senderId),
    message.reportId ? byId('reports', message.reportId) : null,
  ])
  return {
    _id: message._id,
    appointmentId: message.appointmentId,
    senderId: message.senderId,
    senderRole: message.senderRole,
    senderName: sender?.name || 'Care team member',
    text: message.text || '',
    createdAt: message.createdAt,
    attachment: report ? {
      _id: report._id,
      fileName: report.fileName,
      fileSize: report.fileSize,
      mimeType: report.mimeType,
      reportType: report.reportType,
    } : null,
  }
}

async function listMessages(req, res) {
  const appointment = await threadFor(req, res)
  if (!appointment) return
  const messages = (await all('messages'))
    .filter(message => same(message.appointmentId, appointment._id))
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
  return res.json(await Promise.all(messages.map(messageForClient)))
}

async function sendMessage(req, res) {
  const appointment = await threadFor(req, res)
  if (!appointment) return
  if (appointment.status === 'CANCELLED') return res.status(409).json({ message: 'This appointment was cancelled. Its conversation is now read-only.' })
  const text = String(req.body?.text || '').trim()
  if (!text || text.length > 4000) return res.status(400).json({ message: 'Write a message of up to 4,000 characters.' })
  const message = await create('messages', {
    appointmentId: appointment._id,
    senderId: req.user._id,
    senderRole: req.user.role,
    text,
  })
  return res.status(201).json(await messageForClient(message))
}

module.exports = { listMessages, sendMessage }
