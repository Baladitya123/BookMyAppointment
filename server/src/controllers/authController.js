const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const { all, create, findUserByEmail, update, isDatabaseReady } = require('../services/repository')
const { canonicalCity, uniqueCities, matchCity } = require('../services/cities')

const safeUser = ({ password, ...user }) => user
const tokenFor = user => jwt.sign({ sub: String(user._id), role: user.role }, process.env.JWT_SECRET || 'local-demo-secret-change-me', { expiresIn: process.env.JWT_EXPIRES_IN || '7d' })

async function register(req, res) {
  const { name, email, password } = req.body
  if (!name?.trim() || !/^\S+@\S+\.\S+$/.test(email || '') || typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ message: 'Enter your name, a valid email and a password with at least 8 characters.' })
  }
  if (await findUserByEmail(email)) return res.status(409).json({ message: 'An account with that email already exists.' })
  const user = await create('users', { name: name.trim(), email: email.trim().toLowerCase(), password: await bcrypt.hash(password, 12), role: 'PATIENT' })
  return res.status(201).json({ token: tokenFor(user), user: safeUser(user) })
}

async function registerFirstGlobalAdmin(req, res) {
  const { name, email, password, adminSignupKey } = req.body
  if (!name?.trim() || !/^\S+@\S+\.\S+$/.test(email || '') || typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ message: 'Enter your name, a valid email and a password with at least 8 characters.' })
  }
  if (!isDatabaseReady()) return res.status(503).json({ message: 'Connect MongoDB before creating the global admin account.' })
  const configuredKey = process.env.ADMIN_SIGNUP_KEY || ''
  const suppliedKey = typeof adminSignupKey === 'string' ? adminSignupKey : ''
  const configuredBuffer = Buffer.from(configuredKey)
  const suppliedBuffer = Buffer.from(suppliedKey)
  if (!configuredKey || configuredBuffer.length !== suppliedBuffer.length || !crypto.timingSafeEqual(configuredBuffer, suppliedBuffer)) {
    return res.status(403).json({ message: 'The admin setup key is incorrect or not configured in server/.env.' })
  }

  // Ensure the partial unique index is ready before checking and claiming the single global-admin slot.
  const User = require('../models/User')
  await User.init()
  const accounts = await all('users')
  if (accounts.some(account => account.role === 'HOSPITAL_ADMIN' && !account.hospitalId)) {
    return res.status(409).json({ message: 'A global admin account already exists. Sign in with that account.' })
  }
  if (await findUserByEmail(email)) return res.status(409).json({ message: 'An account with that email already exists.' })
  try {
    const user = await create('users', {
      name: name.trim(), email: email.trim().toLowerCase(), password: await bcrypt.hash(password, 12),
      role: 'HOSPITAL_ADMIN', globalAdmin: true,
    })
    return res.status(201).json({ token: tokenFor(user), user: safeUser(user) })
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ message: 'A global admin account already exists. Sign in with that account.' })
    throw error
  }
}

async function login(req, res) {
  const { email, password } = req.body
  if (typeof email !== 'string' || typeof password !== 'string') return res.status(400).json({ message: 'Email and password are required.' })
  const normalizedEmail = email.trim().toLowerCase()
  if (normalizedEmail.endsWith('@bookmyappointment.demo')) {
    return res.status(401).json({ message: 'Email or password is incorrect.' })
  }
  const user = await findUserByEmail(normalizedEmail, true)
  if (!user?.password || !await bcrypt.compare(password, user.password)) return res.status(401).json({ message: 'Email or password is incorrect.' })
  return res.json({ token: tokenFor(user), user: safeUser(user) })
}

async function profile(req, res) {
  const current = (await all('users')).find(user => String(user._id) === String(req.user._id))
  if (!current) return res.status(404).json({ message: 'Account not found.' })
  return res.json(safeUser(current))
}

async function updateProfile(req, res) {
  const allowed = ['name', 'phone', 'city', 'dateOfBirth', 'sex']
  const changes = Object.fromEntries(Object.entries(req.body || {}).filter(([key]) => allowed.includes(key)))
  if (changes.city !== undefined) {
    const hospitals = (await all('hospitals')).filter(hospital => hospital.isSampleData !== true && canonicalCity(hospital.city))
    const city = matchCity(changes.city, uniqueCities(hospitals))
    if (!city) return res.status(400).json({ message: 'Choose a city with a registered hospital.' })
    changes.city = city
  }
  if (changes.name && String(changes.name).trim().length > 100) return res.status(400).json({ message: 'Name must be 100 characters or fewer.' })
  if (changes.name) changes.name = String(changes.name).trim()
  const user = await update('users', req.user._id, changes)
  if (!user) return res.status(404).json({ message: 'Account not found.' })
  return res.json(safeUser(user))
}

module.exports = { register, registerFirstGlobalAdmin, login, profile, updateProfile }
