// Vercel Serverless Function — /api/verify-aadhar
// Safely proxies Aadhar card verification to Anthropic/Claude API
// so the API key stays server-side (not in the app bundle).
//
// Usage: POST /api/verify-aadhar
// Body: { pageText, pageUrl, pageTitle }
// Returns: { isValid, name, number }

// Enhanced keyword matching fallback (when no API key is configured)
function keywordVerify(text) {
  const hasAadhar =
    /aadhaar|aadhar|uid|unique\s*identification|government\s*of\s*india|enrolment|eid\s*\d{4}/i.test(text)

  let name = ''
  let number = ''

  if (hasAadhar) {
    // Try to extract name — look for common Aadhar name patterns
    const nameMatch = text.match(
      /(?:name|नाम)[:\s]+([A-Z][a-z]+(?:\s[A-Z][a-z]+){1,3})/i
    )
    name = nameMatch ? nameMatch[1].trim() : ''

    // Try to extract last 4 digits of Aadhar number
    const numberMatch = text.match(
      /(?:aadhaar|aadhar|आधार)[:\s]*\d{4}\s*\d{4}\s*(\d{4})/i
    )
    if (numberMatch) {
      number = numberMatch[1]
    } else {
      // Fallback: grab any 4-digit sequence near Aadhar-related keywords
      const fallbackNum = text.match(
        /(?:x{4}|•{4}|\*{4})\s*(\d{4})/i
      )
      if (fallbackNum) number = fallbackNum[1]
    }
  }

  return {
    isValid: hasAadhar,
    name: name || (hasAadhar ? 'Verified' : ''),
    number,
  }
}

module.exports = async function handler(req, res) {
  // ── CORS headers (so the RN app can call from any origin) ──
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { pageText, pageUrl, pageTitle } = req.body || {}

  if (!pageText) {
    return res.status(400).json({ error: 'pageText is required' })
  }

  // ── Try Anthropic API first (key stays server-side) ──
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (apiKey) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 200,
          messages: [
            {
              role: 'user',
              content: `You are verifying an Indian Aadhar card displayed inside DigiLocker.

Page URL: ${pageUrl || 'unknown'}
Page Title: ${pageTitle || 'unknown'}

Page text content:
${pageText}

Does this page contain an Aadhar card? If yes:
1. Extract the person's FULL name
2. Extract the LAST 4 DIGITS of the Aadhar number
3. If the name is not clearly visible, check if the page URL or title indicates an Aadhar card

Reply ONLY with this JSON (no markdown):
{"isValid": true/false, "name": "full name or empty", "number": "last 4 digits or empty"}`,
            },
          ],
        }),
      })

      const data = await response.json()
      const text = data?.content?.[0]?.text?.trim()
      if (text) {
        const clean = text.replace(/```json|```|```/g, '').trim()
        const result = JSON.parse(clean)
        return res.json(result)
      }
    } catch (e) {
      console.error('Anthropic API error:', e?.message || e)
      // Fall through to keyword matching
    }
  }

  // ── Fallback: enhanced keyword matching ──
  const result = keywordVerify(pageText)
  return res.json(result)
}
