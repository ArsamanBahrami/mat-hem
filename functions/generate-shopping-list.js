const SYSTEM_PROMPT =
  'Du är en handelsassistent. Kombinera dessa ingredienser från flera recept, skalade till angivet antal portioner. ' +
  'Slå ihop dubbletter (t.ex. 200g kyckling + 300g kyckling = 500g kyckling). Avrunda till rimliga mängder. ' +
  'Gruppera i dessa kategorier: grönsaker, kött & fisk, mejeri & ägg, torrvaror & konserver, övrigt. ' +
  'Svara ENDAST med giltig JSON: [{"id": "placeholder", "name": string, "quantity": number|null, "unit": string, "category": string, "checked": false}]. ' +
  'Svara på svenska.'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' }
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY saknas' }) }
  }

  let body
  try {
    body = JSON.parse(event.body ?? '{}')
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Ogiltig JSON' }) }
  }

  const { recipes = [] } = body
  if (!recipes.length) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Inga recept angivna' }) }
  }

  // Format recipe list with scaled quantities
  const recipeText = recipes.map(r => {
    const scale = r.original_servings > 0 ? r.desired_servings / r.original_servings : 1
    const lines = (r.ingredients ?? [])
      .filter(i => i.name?.trim())
      .map(i => {
        const qty = i.quantity ? Math.round(i.quantity * scale * 10) / 10 : null
        return `  - ${qty != null ? qty : ''}${i.unit ? ' ' + i.unit : ''} ${i.name}`.trim()
      })
    return `${r.title} (${r.desired_servings} portioner):\n${lines.join('\n') || '  (inga ingredienser)'}`
  }).join('\n\n')

  const userMessage = `Skapa en kombinerad inköpslista av följande recept:\n\n${recipeText}`

  let aiResponse
  try {
    aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })
  } catch (err) {
    return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: `Nätverksfel: ${err.message}` }) }
  }

  if (!aiResponse.ok) {
    const errText = await aiResponse.text()
    return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: `Anthropic-fel (${aiResponse.status}): ${errText}` }) }
  }

  const aiData = await aiResponse.json()
  const rawText = aiData.content?.[0]?.text ?? ''

  console.log('[generate-shopping-list] raw:', rawText)

  // Clean markdown fences and extract JSON array
  let cleaned = rawText.replace(/^\uFEFF/, '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  const arrStart = cleaned.indexOf('[')
  const arrEnd   = cleaned.lastIndexOf(']')
  if (arrStart !== -1 && arrEnd > arrStart) cleaned = cleaned.slice(arrStart, arrEnd + 1)

  let parsed
  try {
    parsed = JSON.parse(cleaned)
  } catch (err) {
    console.error('[generate-shopping-list] parse error:', err.message, 'raw:', rawText)
    return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: 'Kunde inte tolka AI-svaret', raw: rawText }) }
  }

  // Replace placeholder ids with real UUIDs
  const items = parsed.map(item => ({
    ...item,
    id: crypto.randomUUID(),
    checked: false,
    quantity: item.quantity ?? null,
    unit: item.unit ?? '',
    category: item.category ?? 'övrigt',
  }))

  return {
    statusCode: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify(items),
  }
}
