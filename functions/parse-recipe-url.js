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

// ── Helpers ───────────────────────────────────────────────────────────────────

function log(tag, msg, extra) {
  const line = `[parse-recipe-url] [${tag}] ${msg}`
  if (extra !== undefined) console.log(line, extra)
  else console.log(line)
}

function instagramHeaders() {
  return {
    'User-Agent':      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
    'Referer':         'https://www.instagram.com/',
  }
}

function genericHeaders() {
  return {
    'User-Agent':      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
  }
}

// Fetch with one automatic retry after 2s if content is too short or fails
async function fetchPage(href, isInstagram, reqId) {
  const headers = isInstagram ? instagramHeaders() : genericHeaders()
  const opts    = { headers, redirect: 'follow', signal: AbortSignal.timeout(15000) }

  for (let attempt = 1; attempt <= 2; attempt++) {
    if (attempt === 2) {
      log(reqId, `retrying after 2s delay (attempt ${attempt})`)
      await new Promise(r => setTimeout(r, 2000))
    }
    try {
      const res  = await fetch(href, opts)
      const html = await res.text()
      log(reqId, `attempt ${attempt}: HTTP ${res.status}, HTML ${html.length} chars`)
      if (!res.ok) {
        if (attempt === 2) return { error: `HTTP ${res.status} från sidan` }
        continue
      }
      if (html.length < 500) {
        log(reqId, `attempt ${attempt}: HTML for short (${html.length} chars), will retry`)
        if (attempt === 2) return { error: 'För lite innehåll hämtades från sidan' }
        continue
      }
      return { html, status: res.status }
    } catch (err) {
      log(reqId, `attempt ${attempt}: fetch error: ${err.message}`)
      if (attempt === 2) return { error: `Nätverksfel: ${err.message}` }
    }
  }
  return { error: 'Okänt fel vid hämtning' }
}

// Extract Recipe-type JSON-LD objects — gives Claude the cleanest possible signal
function extractJsonLd(html) {
  const blocks = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) ?? []
  const recipes = []
  for (const block of blocks) {
    const raw = block.replace(/<[^>]+>/g, '')
    try {
      const data = JSON.parse(raw)
      const objs = Array.isArray(data) ? data : [data]
      for (const obj of objs) {
        const type = Array.isArray(obj['@type']) ? obj['@type'] : [obj['@type']]
        if (type.includes('Recipe') || obj.recipeIngredient || obj.recipeInstructions) {
          recipes.push(obj)
        }
      }
    } catch {}
  }
  return recipes.length > 0 ? JSON.stringify(recipes, null, 2) : null
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
  for (const p of patterns) {
    const m = html.match(p)
    if (m?.[1]?.startsWith('http')) return m[1]
  }
  // JSON-LD fallback
  const ldBlocks = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) ?? []
  for (const block of ldBlocks) {
    try {
      const data = JSON.parse(block.replace(/<[^>]+>/g, ''))
      const objs = Array.isArray(data) ? data : [data]
      for (const obj of objs) {
        const raw = obj.image ?? obj.thumbnailUrl
        if (!raw) continue
        const candidate = Array.isArray(raw) ? raw[0] : raw
        const url = typeof candidate === 'string' ? candidate : candidate?.url
        if (url?.startsWith('http')) return url
      }
    } catch {}
  }
  return null
}

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
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
        .replace(/&#10;/g, '\n').replace(/&#13;/g, '')
    }
  }
  return null
}

function extractAllMetaTags(html) {
  const head = html.match(/<head[\s\S]*?<\/head>/i)?.[0] ?? html.slice(0, 4000)
  return [...head.matchAll(/<meta[^>]+>/gi)].map(m => m[0]).slice(0, 20)
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, ' ').trim()
}

async function callClaude(apiKey, prompt) {
  return fetch('https://api.anthropic.com/v1/messages', {
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
      messages: [{ role: 'user', content: prompt }],
    }),
  })
}

async function askClaude(apiKey, prompt, reqId, label) {
  log(reqId, `calling Claude (${label}), prompt length: ${prompt.length}`)
  let res
  try {
    res = await callClaude(apiKey, prompt)
  } catch (err) {
    log(reqId, `Claude network error (${label}): ${err.message}`)
    return { error: `Nätverksfel mot Anthropic: ${err.message}` }
  }
  if (!res.ok) {
    const t = await res.text()
    log(reqId, `Claude API error (${label}) ${res.status}: ${t.slice(0, 200)}`)
    return { error: `Anthropic API-fel (${res.status})` }
  }
  const data    = await res.json()
  const rawText = data.content?.[0]?.text ?? ''
  log(reqId, `Claude raw response (${label}):`, rawText.slice(0, 600))
  try {
    return { parsed: JSON.parse(rawText), rawText }
  } catch {
    log(reqId, `JSON parse failed (${label}), raw: ${rawText.slice(0, 300)}`)
    return { error: `Kunde inte tolka AI-svaret som JSON: ${rawText.slice(0, 150)}` }
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST')    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY saknas på servern' }) }

  let body
  try { body = JSON.parse(event.body ?? '{}') }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Ogiltig JSON i request body' }) } }

  const { url } = body
  if (!url) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'url krävs' }) }

  let parsedUrl
  try {
    parsedUrl = new URL(url)
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error()
  } catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Ogiltig URL' }) } }

  const reqId       = Math.random().toString(36).slice(2, 7)
  const isInstagram = parsedUrl.hostname.includes('instagram.com')

  log(reqId, `START url=${parsedUrl.href} instagram=${isInstagram}`)

  // ── 1. Fetch page ──
  const fetchResult = await fetchPage(parsedUrl.href, isInstagram, reqId)
  if (fetchResult.error) {
    const userMsg = isInstagram && fetchResult.error.includes('HTTP')
      ? 'Instagram blockerade hämtningen — försök igen om några sekunder eller använd bildimport istället'
      : fetchResult.error
    log(reqId, `FAIL fetch: ${fetchResult.error}`)
    return { statusCode: 422, headers: CORS, body: JSON.stringify({ error: userMsg }) }
  }

  const { html } = fetchResult
  const ogImage  = extractOgImage(html)
  const caption  = extractCaption(html)
  const jsonLd   = extractJsonLd(html)
  const allMeta  = extractAllMetaTags(html)

  log(reqId, `html=${html.length}c, ogImage=${ogImage ? 'yes' : 'no'}, caption=${caption ? caption.length + 'c' : 'no'}, jsonLd=${jsonLd ? 'yes' : 'no'}`)
  log(reqId, `meta tags found:`, allMeta)

  // ── 2. Build prompt — JSON-LD first, then caption, then plain text ──
  let prompt
  if (jsonLd) {
    prompt =
      `Extrahera receptet från dessa JSON-LD strukturerade data:\n\n${jsonLd}` +
      (caption ? `\n\nBILDTEXT/CAPTION:\n${caption}` : '')
  } else if (caption && (isInstagram || caption.length > 200)) {
    prompt =
      `Extrahera receptet. Bildtexten innehåller troligen hela receptet:\n\nBILDTEXT/CAPTION:\n${caption}\n\nÖVRIG SIDTEXT:\n${stripHtml(html).slice(0, 8000)}`
  } else {
    prompt = `Extrahera receptet från denna webbsida:\n\n${stripHtml(html).slice(0, 15000)}`
  }

  // ── 3. Ask Claude ──
  const result = await askClaude(apiKey, prompt, reqId, jsonLd ? 'json-ld' : caption ? 'caption' : 'html')

  if (result.error) {
    return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: result.error }) }
  }

  let parsed = result.parsed

  // ── 4. Retry with caption only if first attempt failed and we haven't used caption yet ──
  if (parsed.error && caption && !jsonLd) {
    log(reqId, `first attempt failed: "${parsed.error}" — retrying with caption only`)
    const retry = await askClaude(apiKey, `Extrahera receptet från denna bildtext:\n\n${caption}`, reqId, 'caption-retry')
    if (!retry.error && !retry.parsed.error) {
      parsed = retry.parsed
      log(reqId, 'caption retry succeeded')
    } else {
      log(reqId, `caption retry also failed: ${retry.error ?? retry.parsed.error}`)
    }
  }

  if (parsed.error) {
    log(reqId, `FAIL final: ${parsed.error}`)
    // Give a specific user-facing message for Instagram
    const userMsg = isInstagram && parsed.error
      ? `Hittade inget recept i inlägget — ${parsed.error}`
      : parsed.error
    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: userMsg }),
    }
  }

  log(reqId, `SUCCESS title="${parsed.title}"`)
  return {
    statusCode: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify(ogImage ? { ...parsed, image_url: ogImage } : parsed),
  }
}
