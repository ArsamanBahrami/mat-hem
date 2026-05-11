const SYSTEM_PROMPT =
  'Du är en receptassistent. Extrahera receptet från HTML-texten och svara ENDAST med giltig JSON utan markdown-formatering eller förklaringar. ' +
  'Format: { "title": string, "description": string, "servings": number, "prep_time_min": number, "cook_time_min": number, ' +
  '"ingredients": [{"name": string, "quantity": number, "unit": string}], "instructions": [{"step": number, "text": string}], "suggested_tags": string[] }. ' +
  'Svara på svenska. Tillgängliga taggar: kyckling, nötkött, fläsk, fisk, vegetarisk, vegan, enkel, medel, avancerad, budget, vardag, festlig, frukost, lunch, middag. ' +
  'Om du inte kan extrahera ett recept från texten, svara med { "error": "Inget recept hittades på sidan" }.'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function extractOgImage(html) {
  // Patterns ordered by priority. Each pair covers both attribute orders.
  const patterns = [
    // og:image (property)
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    // og:image:url (property)
    /<meta[^>]+property=["']og:image:url["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image:url["']/i,
    // og:image (name)
    /<meta[^>]+name=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']og:image["']/i,
    // itemprop="image"
    /<meta[^>]+itemprop=["']image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+itemprop=["']image["']/i,
    // twitter:image (name or property)
    /<meta[^>]+(?:name|property)=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']twitter:image["']/i,
    // <link rel="image_src">
    /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i,
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']image_src["']/i,
  ]

  for (const pattern of patterns) {
    const m = html.match(pattern)
    if (m?.[1] && m[1].startsWith('http')) {
      console.log('[parse-recipe-url] image found via meta pattern:', m[1])
      return m[1]
    }
  }

  // JSON-LD: look for Recipe or Article schema with image
  const ldBlocks = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) ?? []
  for (const block of ldBlocks) {
    const json = block.replace(/<[^>]+>/g, '')
    try {
      const data = JSON.parse(json)
      const objs = Array.isArray(data) ? data : [data]
      for (const obj of objs) {
        const raw = obj.image ?? obj.thumbnailUrl
        if (!raw) continue
        const candidate = Array.isArray(raw) ? raw[0] : raw
        const imgUrl = typeof candidate === 'string' ? candidate : candidate?.url
        if (imgUrl && typeof imgUrl === 'string' && imgUrl.startsWith('http')) {
          console.log('[parse-recipe-url] image found via JSON-LD:', imgUrl)
          return imgUrl
        }
      }
    } catch {}
  }

  // Debug: log the first image-related meta tags we actually found
  const headMatch = html.match(/<head[\s\S]*?<\/head>/i)?.[0] ?? html.slice(0, 3000)
  const metaLines = [...headMatch.matchAll(/<meta[^>]*(image|og:|twitter:)[^>]*>/gi)].map(m => m[0])
  if (metaLines.length) {
    console.log('[parse-recipe-url] image-related meta tags found:', metaLines.slice(0, 5))
  } else {
    console.log('[parse-recipe-url] no image meta tags found in <head>')
  }
  return null
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, ' ')
    .trim()
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

  const { url } = body
  if (!url) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'url krävs' }) }
  }

  let parsedUrl
  try {
    parsedUrl = new URL(url)
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error()
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Ogiltig URL' }) }
  }

  // Fetch the page HTML
  let pageHtml
  let ogImage = null
  try {
    const pageRes = await fetch(parsedUrl.href, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Matvis-bot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'sv,en;q=0.9',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    })
    if (!pageRes.ok) {
      return { statusCode: 422, headers: CORS, body: JSON.stringify({ error: `Kunde inte hämta sidan (HTTP ${pageRes.status})` }) }
    }
    pageHtml = await pageRes.text()
    ogImage = extractOgImage(pageHtml)
  } catch (err) {
    return { statusCode: 422, headers: CORS, body: JSON.stringify({ error: `Kunde inte nå sidan: ${err.message}` }) }
  }

  const pageText = stripHtml(pageHtml).slice(0, 15000)

  // Call Anthropic
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
        messages: [
          {
            role: 'user',
            content: `Extrahera receptet från denna webbsida:\n\n${pageText}`,
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
    body: JSON.stringify(ogImage ? { ...parsed, image_url: ogImage } : parsed),
  }
}
