require('dotenv').config()
const mongoose = require('mongoose')
const { connectDatabase } = require('../config/database')
const { seedDatabase, isDatabaseReady } = require('../services/repository')

async function run() {
  if (process.env.ENABLE_DEMO_SEED !== 'true') {
    console.log('Demo catalog seeding is disabled. Set ENABLE_DEMO_SEED=true only for an isolated demo database.')
    return
  }
  const connected = await connectDatabase()
  if (!connected) throw new Error('Could not connect to MongoDB; demo records were not written.')
  await seedDatabase()
  if (isDatabaseReady()) {
    console.log('MongoDB catalog seed complete.')
    await mongoose.disconnect()
  }
}

run().catch(error => { console.error('Seed failed:', error); process.exitCode = 1 })
