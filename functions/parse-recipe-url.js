const SYSTEM_PROMPT =
  'Du är en receptassistent. Extrahera receptet från den givna texten och svara ENDAST med giltig JSON utan markdown-formatering eller förklaringar. ' +
  'Format: { "title": string, "description": string, "servings": number, "prep_time_min": number, "cook_time_min": number, ' +
  '"ingredients": [{"name": string, "quantity": number, "unit": string}], "instructions": [{"step": number, "text": string}], "suggested_tags": string[] }. ' +
  'Receptet kan vara vad som helst: mat, bakning, dessert, dryck, frukost, mellanmål etc. ' +
  'Svara på svenska. Tillgängliga taggar: kyckling, nötkött, fläsk, fisk, vegetarisk, vegan, enkel, medel, avancerad, budget, vardag, festlig, frukost, lunch, middag, bakning, dessert. ' +
  'Om du inte kan extrahera ett recept från texten, svara med { "error": "beskrivning av vad som saknas eller gick fel" }.'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function extractOgImage(html) {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+property=["']og:image:url["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image:url["']/i,
    /<meta[^>]+name=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']og:image["']/i,
    /<meta[^>]+itemprop=["']image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+itemprop=["']image["']/i,
    /<meta[^>]+(?:name|property)=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']twitter:image["']/i,
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

  const headMatch = html.match(/<head[\s\S]*?<\/head>/i)?.[0] ?? html.slice(0, 3000)
  const metaLines = [...headMatch.matchAll(/<meta[^>]*(image|og:|twitter:)[^>]*>/gi)].map(m => m[0])
  if (metaLines.length) {
    console.log('[parse-recipe-url] image-related meta tags found:', metaLines.slice(0, 5))
  } else {
    console.log('[parse-recipe-url] no image meta tags found in <head>')
  }
  return null
}

// Extracts og:description or meta description — Instagram puts the full caption here
function extractCaption(html) {
  const patterns = [
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']{20,})["']/i,
    /<meta[^>]+content=["']([^"']{20,})["'][^>]+property=["']og:description["']/i,
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']{20,})["']/i,
    /<meta[^>]+content=["']([^"']{20,})["'][^>]+name=["']description["']/i,
  ]
  for (const p of patterns) {
    const m = html.match(p)
    if (m?.[1]) {
      return m[1]
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#10;/g, '\n')
        .replace(/&#13;/g, '')
    }
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

async function callClaude(apiKey, textForClaude) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
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
      messages: [{ role: 'user', content: textForClaude }],
    }),
  })
  return res
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

  const pageText  = stripHtml(pageHtml).slice(0, 15000)
  const caption   = extractCaption(pageHtml)
  const isInstagram = parsedUrl.hostname.includes('instagram.com')

  console.log('[parse-recipe-url] url:', parsedUrl.href)
  console.log('[parse-recipe-url] pageText length:', pageText.length)
  console.log('[parse-recipe-url] caption found:', caption ? `yes (${caption.length} chars)` : 'no')

  // Build prompt — for Instagram or when caption is long, prioritise the caption
  let prompt
  if (caption && (isInstagram || caption.length > 200)) {
    prompt =
      `Extrahera receptet från denna text. Bildtexten/caption kan innehålla hela receptet:\n\n` +
      `BILDTEXT/CAPTION:\n${caption}\n\n` +
      `ÖVRIG SIDTEXT:\n${pageText.slice(0, 8000)}`
  } else {
    prompt = `Extrahera receptet från denna webbsida:\n\n${pageText}`
  }

  // Call Anthropic
  let aiResponse
  try {
    aiResponse = await callClaude(apiKey, prompt)
  } catch (err) {
    return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: `Nätverksfel mot Anthropic: ${err.message}` }) }
  }

  if (!aiResponse.ok) {
    const errText = await aiResponse.text()
    return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: `Anthropic API-fel (${aiResponse.status}): ${errText}` }) }
  }

  const aiData  = await aiResponse.json()
  const rawText = aiData.content?.[0]?.text ?? ''

  let parsed
  try {
    parsed = JSON.parse(rawText)
  } catch {
    console.error('[parse-recipe-url] JSON parse failed. Claude raw response:', rawText.slice(0, 500))
    return {
      statusCode: 502,
      headers: CORS,
      body: JSON.stringify({ error: `Kunde inte tolka AI-svaret som JSON. Svar från Claude: ${rawText.slice(0, 200)}` }),
    }
  }

  // If Claude found no recipe and we have a caption we haven't tried alone yet, retry with caption only
  if (parsed.error && caption && !isInstagram && caption.length > 100) {
    console.log('[parse-recipe-url] first attempt failed:', parsed.error, '— retrying with caption only')
    try {
      const retryRes = await callClaude(apiKey, `Extrahera receptet från denna bildtext/caption:\n\n${caption}`)
      if (retryRes.ok) {
        const retryData  = await retryRes.json()
        const retryText  = retryData.content?.[0]?.text ?? ''
        try {
          const retryParsed = JSON.parse(retryText)
          if (!retryParsed.error) parsed = retryParsed
          else console.log('[parse-recipe-url] caption retry also failed:', retryParsed.error)
        } catch {
          console.error('[parse-recipe-url] caption retry JSON parse failed:', retryText.slice(0, 200))
        }
      }
    } catch (err) {
      console.error('[parse-recipe-url] caption retry network error:', err.message)
    }
  }

  if (parsed.error) {
    console.log('[parse-recipe-url] Claude returned error:', parsed.error)
    console.log('[parse-recipe-url] Claude raw response was:', rawText.slice(0, 500))
  }

  return {
    statusCode: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify(ogImage ? { ...parsed, image_url: ogImage } : parsed),
  }
}
