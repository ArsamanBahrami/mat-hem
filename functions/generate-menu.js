const SYSTEM_PROMPT =
  'Du är en familjekokerska som planerar veckomenyer. Du får en lista med recept och ska välja ut en varierad meny. ' +
  'Regler: 1) Variera proteinkällan — inte samma tagg två dagar i rad. 2) Blanda svårighetsgrader. ' +
  '3) Undvik recept som använts de senaste 2 veckorna. 4) Matcha budget-parametern. ' +
  '5) Följ kockfördelningen exakt om den anges. ' +
  'Svara ENDAST med giltig JSON: {"måndag": {"recipe_id": "uuid_eller_null", "cook": "Arsi"}, "tisdag": ..., osv}. ' +
  'Inkludera bara de dagar som efterfrågats. Använd null (inte strängen "null") för recipe_id om inget lämpligt recept finns.'

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
  const { days = [], budget = 'vardag', cook = 'båda', avoid = '', nikkiDays = 1 } = parameters

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
    cook === 'Nikki'
      ? `- Kockfördelning: Nikki lagar ${nikkiDays} ${nikkiDays === 1 ? 'dag' : 'dagar'} — dessa dagar MÅSTE ha taggen 'enkel'. Arsi lagar resten och klarar alla svårighetsgrader. Tilldela "cook": "Nikki" för Nikkis dagar och "cook": "Arsi" för Arsis dagar.`
      : `- Vem lagar: ${cook === 'Arsi' ? 'Arsi lagar alla dagar. Tilldela "cook": "Arsi" för alla dagar.' : 'Arsi och Nikki lagar tillsammans — fördelning valfri.'}`,
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

  // Normalize to {recipe_id, cook} format, handling both old (string) and new (object) AI responses
  const normalized = {}
  for (const [day, val] of Object.entries(parsed)) {
    if (val === null || typeof val === 'string') {
      const id = (val === null || val === 'null' || val === '') ? null : val
      normalized[day] = { recipe_id: id, cook: cook === 'Arsi' ? 'Arsi' : null }
    } else {
      const id = (val.recipe_id === null || val.recipe_id === 'null' || val.recipe_id === '') ? null : val.recipe_id
      normalized[day] = { recipe_id: id, cook: val.cook ?? null }
    }
  }

  return {
    statusCode: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify(normalized),
  }
}
