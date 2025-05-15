const mongoose = require('mongoose');

const Schema = mongoose.Schema;

// User schema for patients and healthcare providers
const UserSchema = new Schema({
  username: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['patient', 'provider'], required: true },
  email: { type: String, required: true, unique: true },
  fullName: { type: String },
  language: { type: String, default: 'en' },
  createdAt: { type: Date, default: Date.now }
});

// Medical record schema
const MedicalRecordSchema = new Schema({
  patient: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  provider: { type: Schema.Types.ObjectId, ref: 'User' },
  recordType: { type: String, enum: ['pdf', 'image', 'text'], required: true },
  dataUrl: { type: String, required: true }, // URL or base64 encoded data
  classification: { type: String, enum: ['Critical', 'Moderate', 'Non-Critical'], default: 'Non-Critical' },
  uploadedAt: { type: Date, default: Date.now }
});

// Alert schema for critical cases
const AlertSchema = new Schema({
  provider: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  patient: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true },
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const MedicalRecord = mongoose.model('MedicalRecord', MedicalRecordSchema);
const Alert = mongoose.model('Alert', AlertSchema);

module.exports = {
  User,
  MedicalRecord,
  Alert
};
