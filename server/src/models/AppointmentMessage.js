const mongoose = require('mongoose')

const appointmentMessageSchema = new mongoose.Schema({
  appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true, index: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  senderRole: { type: String, enum: ['PATIENT', 'DOCTOR'], required: true },
  text: { type: String, trim: true, maxlength: 4000, default: '' },
  reportId: { type: mongoose.Schema.Types.ObjectId, ref: 'MedicalReport' },
}, { timestamps: true })

appointmentMessageSchema.index({ appointmentId: 1, createdAt: 1 })

module.exports = mongoose.models.AppointmentMessage || mongoose.model('AppointmentMessage', appointmentMessageSchema)
