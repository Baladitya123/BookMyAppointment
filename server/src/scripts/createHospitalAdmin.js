require('dotenv').config()
const readline = require('readline')
const bcrypt = require('bcryptjs')
const { connectDatabase } = require('../config/database')
const User = require('../models/User')

function readSecret(prompt) {
  const input = process.stdin
  if (!input.isTTY || typeof input.setRawMode !== 'function') {
    return Promise.reject(new Error('Run this command in an interactive terminal so the password can be entered privately.'))
  }

  return new Promise((resolve, reject) => {
    let value = ''
    const finish = result => {
      input.removeListener('data', onData)
      input.setRawMode(false)
      input.pause()
      process.stdout.write('\n')
      resolve(result)
    }
    const onData = chunk => {
      for (const character of String(chunk)) {
        if (character === '\u0003') {
          input.removeListener('data', onData)
          input.setRawMode(false)
          input.pause()
          process.stdout.write('\n')
          reject(new Error('Admin setup cancelled.'))
          return
        }
        if (character === '\r' || character === '\n') return finish(value)
        if (character === '\u007f' || character === '\b') value = value.slice(0, -1)
        else if (character >= ' ') value += character
      }
    }
    process.stdout.write(prompt)
    input.setEncoding('utf8')
    input.setRawMode(true)
    input.resume()
    input.on('data', onData)
  })
}

async function run() {
  const prompt = readline.createInterface({ input: process.stdin, output: process.stdout })
  const name = (await prompt.question('Hospital admin name: ')).trim()
  const email = (await prompt.question('Hospital admin email: ')).trim().toLowerCase()
  prompt.close()
  const password = await readSecret('Password (hidden): ')

  if (!name || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) {
    throw new Error('Enter a name, valid email, and password with at least 8 characters.')
  }
  if (!await connectDatabase()) throw new Error('Could not connect to MongoDB. Check MONGODB_URI in server/.env.')
  if (await User.exists({ email })) throw new Error('That email already has an account. Use a different email or ask the existing admin to manage access.')

  await User.create({ name, email, password: await bcrypt.hash(password, 12), role: 'HOSPITAL_ADMIN', globalAdmin: true })
  console.log(`Created global hospital admin ${email}. Sign in through the app with this email and the password you entered.`)
}

run().catch(error => {
  console.error(`Could not create hospital admin: ${error.message}`)
  process.exitCode = 1
})
