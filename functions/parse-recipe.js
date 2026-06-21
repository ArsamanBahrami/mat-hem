const SYSTEM_PROMPT =
  'Du är en receptassistent. Extrahera receptet från bilden och svara ENDAST med giltig JSON utan markdown-formatering eller förklaringar. ' +
  'Format: { "title": string, "description": string, "servings": number, "prep_time_min": number, "cook_time_min": number, ' +
  '"ingredients": [{"name": string, "quantity": number, "unit": string}], "instructions": [{"step": number, "text": string}], "suggested_tags": string[] }. ' +
  'Svara på svenska. Tillgängliga taggar: kyckling, nötkött, fläsk, fisk, vegetarisk, vegan, enkel, medel, avancerad, budget, vardag, festlig, frukost, lunch, middag. ' +
  'Om du inte kan extrahera ett recept från bilden, svara med { "error": "Inget recept hittades i bilden" }.'

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
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY saknas på servern' }) }
  }

  let body
  try {
    body = JSON.parse(event.body ?? '{}')
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Ogiltig JSON i request body' }) }
  }

  const { imageBase64, mediaType } = body
  if (!imageBase64 || !mediaType) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'imageBase64 och mediaType krävs' }) }
  }

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
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mediaType, data: imageBase64 },
              },
              { type: 'text', text: 'Extrahera receptet från denna bild.' },
            ],
          },
        ],
      }),
    })
  } catch (err) {
    return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: `Nätverksfel mot Anthropic: ${err.message}` }) }
  }

  if (!aiResponse.ok) {
    const errText = await aiResponse.text()
    return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: `Anthropic API-fel (${aiResponse.status}): ${errText}` }) }
  }

  const aiData = await aiResponse.json()
  const text = aiData.content?.[0]?.text ?? ''

  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: 'Kunde inte tolka AI-svaret som JSON' }) }
  }

  return {
    statusCode: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify(parsed),
  }
}
