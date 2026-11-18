const { all, create } = require('../../services/repository')
function tokens(text) { return new Set((text || '').toLowerCase().match(/[a-z0-9%]+/g) || []) }
function lexicalScore(query, text) {
  const q = tokens(query); const d = tokens(text)
  if (!q.size || !d.size) return 0
  let common = 0; for (const term of q) if (d.has(term)) common += 1
  return common / Math.sqrt(q.size * d.size)
}
function chunkText(text, size = 800, overlap = 120) {
  const clean = String(text || '').trim()
  if (!clean) return []
  const chunks = []
  let start = 0
  while (start < clean.length) {
    let end = Math.min(clean.length, start + size)
    if (end < clean.length) {
      const boundary = clean.lastIndexOf(' ', end)
      if (boundary > start + Math.floor(size * 0.6)) end = boundary
    }
    chunks.push(clean.slice(start, end).trim())
    if (end >= clean.length) break
    start = Math.max(start + 1, end - overlap)
  }
  return chunks
}
async function embed(text) {
  return null
}

async function upsertKnowledge({ title, text, category, source }) {
  const chunks = chunkText(text)
  const stored = []
  for (let index = 0; index < chunks.length; index += 1) {
    stored.push(await create('knowledge', {
      title: chunks.length > 1 ? `${title} · ${index + 1}/${chunks.length}` : title,
      text: chunks[index], category, source: source || 'Curated educational content',
    }))
  }
  return stored
}

async function indexMissingKnowledge() {
  return 0
}

async function searchKnowledge(query, limit = 4) {
  const documents = await all('knowledge')
  const scored = documents.filter(doc => doc.active !== false).map(doc => ({
    ...doc,
    score: lexicalScore(query, `${doc.title} ${doc.category || ''} ${doc.text}`),
  })).sort((a, b) => b.score - a.score).slice(0, limit)
  return scored.filter(doc => doc.score > 0).map(({ _id, title, category, source, text, score }) => ({ _id, title, category, source, text, score }))
}

module.exports = { embed, upsertKnowledge, searchKnowledge, lexicalScore, indexMissingKnowledge, chunkText }
