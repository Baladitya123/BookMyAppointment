require('dotenv').config()
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const path = require('path')
const { connectDatabase } = require('./config/database')
const Appointment = require('./models/Appointment')
const routes = require('./routes')
const { notFound, errorHandler } = require('./middleware/errorHandler')

async function start() {
  const production = process.env.NODE_ENV === 'production'
  const databaseConnected = await connectDatabase()
  if (production && !process.env.JWT_SECRET) throw new Error('JWT_SECRET must be configured in production.')
  if (production && !databaseConnected) throw new Error('A reachable MONGODB_URI is required in production.')
  if (databaseConnected) await Appointment.init()
  if (process.env.OLLAMA_AUTO_EMBED === 'true') {
    try {
      const count = await require('./ai/symptomRag').ensureSymptomEmbeddings()
      if (count) console.log(`Ollama symptom embeddings ready: ${count} CSV rows indexed.`)
    } catch (error) {
      console.warn(`Ollama symptom embeddings are unavailable; keyword fallback will be used: ${error.message}`)
    }
  }
  const app = express()
  app.disable('x-powered-by')
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: false }))
  app.use(cors({ origin: process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',').map(value => value.trim()) : ['http://localhost:5173'], credentials: false }))
  app.use(express.json({ limit: '1mb' }))
  app.use(express.urlencoded({ extended: false, limit: '1mb' }))
  const clientBuild = path.resolve(__dirname, '../../client/dist')
  if (production) app.use(express.static(clientBuild))
  app.get('/', (_req, res) => res.json({ name: 'BookMyAppointment AI', docs: '/api/health' }))
  app.use('/api', routes)
  if (production) {
    app.get(/^\/(?!api(?:\/|$)).*/, (_req, res, next) => {
      res.sendFile(path.join(clientBuild, 'index.html'), error => { if (error) next(error) })
    })
  }
  app.use(notFound)
  app.use(errorHandler)
  const port = Number(process.env.PORT || 5000)
  app.listen(port, () => console.log(`BookMyAppointment AI API listening on http://localhost:${port}`))
}

start().catch(error => { console.error('Could not start server:', error); process.exitCode = 1 })
