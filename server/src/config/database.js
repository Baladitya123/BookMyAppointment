const mongoose = require('mongoose')

async function connectDatabase() {
  if (!process.env.MONGODB_URI) {
    console.log('MONGODB_URI is not set — running with empty temporary storage; provider listings are unavailable.')
    return false
  }
  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 })
    console.log('Connected to MongoDB.')
    return true
  } catch (error) {
    console.warn(`MongoDB unavailable (${error.message}). Continuing with empty temporary storage; provider listings are unavailable.`)
    return false
  }
}

function databaseReady() { return mongoose.connection.readyState === 1 }

module.exports = { connectDatabase, databaseReady }
