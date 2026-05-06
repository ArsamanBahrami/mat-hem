const SYSTEM_PROMPT =
  'Du är en familjekokerska som planerar veckomenyer. Du får en lista med recept och ska välja ut en varierad meny. ' +
  'Regler: 1) Variera proteinkällan — inte samma tagg två dagar i rad. 2) Blanda svårighetsgrader. ' +
  '3) Undvik recept som använts de senaste 2 veckorna. 4) Matcha budget-parametern. ' +
  '5) Om kock är angiven, ta hänsyn till svårighetsgrad. ' +
  'Svara ENDAST med giltig JSON: {"måndag": "recipe_uuid_eller_null", "tisdag": ..., osv}. ' +
  'Inkludera bara de dagar som efterfrågats. Använd null (inte strängen "null") för dagar utan lämpligt recept.'

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

  const { recipes = [], recent_recipe_ids = [], parameters = {} } = body
  const { days = [], budget = 'vardag', cook = 'båda', avoid = '' } = parameters

  if (!days.length) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Minst en dag krävs' }) }
  }

  const recipeList = recipes.map(r => {
    const time = (r.prep_time_min ?? 0) + (r.cook_time_min ?? 0)
    const tags = (r.tags ?? []).join(', ')
    return `- ${r.id}: ${r.title}${tags ? ` (${tags})` : ''}${time > 0 ? ` — ${time} min` : ''}`
  }).join('\n')

  const userMessage = [
    `Tillgängliga recept:\n${recipeList || '(inga recept)'}`,
    `Nyligen använda recept att undvika: ${recent_recipe_ids.join(', ') || 'inga'}`,
    `Parametrar:`,
    `- Dagar att planera: ${days.join(', ')}`,
    `- Budget/stil: ${budget}`,
    `- Vem lagar: ${cook}`,
    avoid ? `- Undvik: ${avoid}` : null,
  ].filter(Boolean).join('\n')

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
        max_tokens: 512,
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
  const text = aiData.content?.[0]?.text ?? ''

  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: 'Kunde inte tolka AI-svaret som JSON' }) }
  }

  // Normalize: replace string "null" or empty strings with actual null
  const normalized = {}
  for (const [day, id] of Object.entries(parsed)) {
    normalized[day] = (id === null || id === 'null' || id === '') ? null : id
  }

  return {
    statusCode: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify(normalized),
  }
}
