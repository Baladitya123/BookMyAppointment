const fs = require('fs')
const path = require('path')
const { ensureSymptomEmbeddings } = require('../ai/symptomRag')

const envPath = path.resolve(__dirname, '../../.env')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (match && process.env[match[1]] == null) process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2')
  }
}

ensureSymptomEmbeddings({ force: process.argv.includes('--force') })
  .then(count => console.log(count ? `Created embeddings for ${count} symptom knowledge rows.` : 'Symptom knowledge CSV already has embeddings.'))
  .catch(error => { console.error(`Could not create symptom embeddings: ${error.message}`); process.exitCode = 1 })
