const fs = require('fs/promises')
const path = require('path')

const PROJECT_ROOT = path.resolve(__dirname, '../../..')
const SOURCE_CSV = path.join(PROJECT_ROOT, 'symptom-knowledge.csv')
const EMBEDDED_CSV = path.join(PROJECT_ROOT, 'symptom-knowledge-embedded.csv')
const CSV_HEADER = ['id', 'specialty', 'title', 'content', 'symptom_examples', 'embedding', 'embedding_model']

function ollamaBaseUrl() {
  return (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/+$/, '')
}

function embeddingModel() {
  return process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text:latest'
}

function chatModel() {
  return process.env.OLLAMA_CHAT_MODEL || 'llama3.2:3b'
}

async function ollamaPost(endpoint, body) {
  const timeout = Math.max(1000, Number(process.env.OLLAMA_REQUEST_TIMEOUT_MS) || 120000)
  const response = await fetch(`${ollamaBaseUrl()}/api/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Ollama ${endpoint} request failed (${response.status})${detail ? `: ${detail.slice(0, 400)}` : ''}`)
  }
  return response.json()
}

function parseCsv(source) {
  const records = []
  let row = []; let value = ''; let quoted = false
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i]
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { value += '"'; i += 1 }
      else if (char === '"') quoted = false
      else value += char
    } else if (char === '"') quoted = true
    else if (char === ',') { row.push(value); value = '' }
    else if (char === '\n') { row.push(value.replace(/\r$/, '')); records.push(row); row = []; value = '' }
    else value += char
  }
  if (value || row.length) { row.push(value.replace(/\r$/, '')); records.push(row) }
  if (!records.length) return []
  const headers = records.shift()
  return records.filter(record => record.some(cell => cell !== '')).map(record => Object.fromEntries(headers.map((header, index) => [header, record[index] || ''])))
}

function csvCell(value) {
  const text = String(value ?? '')
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function toCsv(rows) {
  return [CSV_HEADER.join(','), ...rows.map(row => CSV_HEADER.map(key => csvCell(row[key])).join(','))].join('\n') + '\n'
}

function embeddingText(row) {
  return `${row.specialty}. ${row.title}. ${row.content} Common symptom descriptions: ${row.symptom_examples}.`
}

function readEmbedding(row) {
  if (row.embedding_model !== embeddingModel()) return null
  try {
    const value = JSON.parse(row.embedding || 'null')
    return Array.isArray(value) && value.length && value.every(Number.isFinite) ? value : null
  } catch { return null }
}

async function readCsv(filePath) {
  try { return parseCsv(await fs.readFile(filePath, 'utf8')) }
  catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
}

async function readKnowledge() {
  const sourceRows = await readCsv(SOURCE_CSV)
  const embeddedRows = await readCsv(EMBEDDED_CSV)
  const embeddingsById = new Map(embeddedRows.map(row => [row.id, row]))
  return sourceRows.map(row => ({
    ...row,
    embedding: embeddingsById.get(row.id)?.embedding || '',
    embedding_model: embeddingsById.get(row.id)?.embedding_model || '',
  }))
}

async function ensureSymptomEmbeddings({ force = false } = {}) {
  const rows = await readCsv(SOURCE_CSV)
  if (!rows.length) throw new Error(`No symptom knowledge rows found in ${SOURCE_CSV}`)
  const existing = new Map((await readCsv(EMBEDDED_CSV)).map(row => [row.id, row]))
  for (const row of rows) {
    row.embedding = existing.get(row.id)?.embedding || ''
    row.embedding_model = existing.get(row.id)?.embedding_model || ''
  }
  const model = embeddingModel()
  const pending = rows.filter(row => force || !readEmbedding(row))
  if (!pending.length) return 0
  for (let start = 0; start < pending.length; start += 32) {
    const batch = pending.slice(start, start + 32)
    const response = await ollamaPost('embed', { model, input: batch.map(embeddingText) })
    if (!Array.isArray(response.embeddings) || response.embeddings.length !== batch.length) throw new Error('Ollama returned an unexpected embedding response.')
    for (let index = 0; index < batch.length; index += 1) {
      batch[index].embedding = JSON.stringify(response.embeddings[index])
      batch[index].embedding_model = model
    }
  }
  await fs.writeFile(EMBEDDED_CSV, toCsv(rows), 'utf8')
  return pending.length
}

function terms(text) {
  return new Set(String(text || '').toLowerCase().match(/[a-z0-9]+/g)?.filter(word => word.length > 2) || [])
}

function lexicalScore(query, document) {
  const left = terms(query); const right = terms(document)
  if (!left.size || !right.size) return 0
  let shared = 0
  for (const term of left) if (right.has(term)) shared += 1
  return shared / Math.sqrt(left.size * right.size)
}

function cosine(left, right) {
  if (!left?.length || left.length !== right?.length) return 0
  let dot = 0; let leftLength = 0; let rightLength = 0
  for (let i = 0; i < left.length; i += 1) {
    dot += left[i] * right[i]
    leftLength += left[i] ** 2
    rightLength += right[i] ** 2
  }
  return leftLength && rightLength ? dot / Math.sqrt(leftLength * rightLength) : 0
}

async function searchSymptoms(query, limit = 5) {
  const rows = await readKnowledge()
  let queryVector = null
  try {
    const response = await ollamaPost('embed', { model: embeddingModel(), input: query })
    queryVector = response.embeddings?.[0] || null
  } catch (error) {
    console.warn(`Local Ollama embedding unavailable; using CSV keyword search: ${error.message}`)
  }
  const usedSemantic = Boolean(queryVector && rows.some(row => readEmbedding(row)))
  const results = rows.map(row => {
    const vector = readEmbedding(row)
    const text = `${row.title} ${row.specialty} ${row.content} ${row.symptom_examples}`
    const score = queryVector && vector ? cosine(queryVector, vector) : lexicalScore(query, text)
    return { ...row, score }
  }).sort((a, b) => b.score - a.score).slice(0, limit).filter(row => row.score > 0)
  return { results, retrievalMode: usedSemantic ? 'semantic' : 'keyword-fallback' }
}

function parseModelJson(text) {
  return JSON.parse(String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''))
}

async function chooseSpecialties(symptoms, retrieved) {
  const candidates = [...new Set(retrieved.map(row => row.specialty))]
  if (!candidates.length) return { specialties: ['General Physician'], explanation: 'A general physician can be a starting point when the symptom description does not clearly match a specialty.' }
  try {
    const response = await ollamaPost('chat', {
      model: chatModel(),
      stream: false,
      format: 'json',
      options: { temperature: 0.1 },
      messages: [
        { role: 'system', content: 'You are a care-navigation assistant, not a medical diagnostician. Use only the supplied candidate specialties and retrieved descriptions. Choose one or at most two specialties that best fit the symptoms. If symptoms are vague or do not match, choose General Physician if it is a candidate; otherwise choose the closest candidate. Do not diagnose, prescribe, or claim certainty. Return a JSON object with specialties (array of exact candidate names) and a short explanation.' },
        { role: 'user', content: JSON.stringify({ symptoms, candidateSpecialties: candidates, retrievedGuide: retrieved.map(({ specialty, title, content, symptom_examples }) => ({ specialty, title, content, symptom_examples })) }) },
      ],
    })
    const parsed = parseModelJson(response.message?.content)
    const valid = new Set(candidates)
    const specialties = [...new Set((Array.isArray(parsed.specialties) ? parsed.specialties : []).filter(value => valid.has(value)))].slice(0, 2)
    return {
      specialties: specialties.length ? specialties : [candidates[0]],
      explanation: String(parsed.explanation || `The retrieved symptom guide points to ${candidates[0]}.`).slice(0, 500),
    }
  } catch (error) {
    console.warn(`Local Ollama chat unavailable; using the top retrieved specialty: ${error.message}`)
    return { specialties: [candidates[0]], explanation: `The closest matching information in the symptom guide points to ${candidates[0]}.` }
  }
}

async function recommendFromSymptoms(symptoms) {
  const { results: retrieved, retrievalMode } = await searchSymptoms(symptoms)
  const recommendation = await chooseSpecialties(symptoms, retrieved)
  return {
    ...recommendation,
    retrievalMode,
    retrievedKnowledge: retrieved.map(({ specialty, title, score }) => ({ specialty, title, score: Number(score.toFixed(4)) })),
  }
}

module.exports = { ensureSymptomEmbeddings, recommendFromSymptoms }
