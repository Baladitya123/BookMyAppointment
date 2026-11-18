const mongoose = require('mongoose')

const reportSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', index: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  uploadedByRole: { type: String, enum: ['PATIENT', 'DOCTOR', 'HOSPITAL_ADMIN'], required: true },
  sharedWith: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  filePath: String,
  fileName: String,
  fileSize: Number,
  mimeType: String,
  reportType: { type: String, default: 'Medical report' },
  uploadDate: { type: String, default: () => new Date().toISOString().slice(0, 10) },
}, { timestamps: true })

module.exports = mongoose.models.MedicalReport || mongoose.model('MedicalReport', reportSchema)
