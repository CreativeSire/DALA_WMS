import { env } from '../config/env.js'

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function normalize(text) {
  return cleanText(text).toLowerCase()
}

function findQuantityNearMatch(documentText, anchor) {
  const escaped = anchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const patterns = [
    new RegExp(`${escaped}.{0,40}?(\\d+(?:[.,]\\d+)?)`, 'i'),
    new RegExp(`(\\d+(?:[.,]\\d+)?).{0,20}?${escaped}`, 'i'),
  ]

  for (const pattern of patterns) {
    const match = documentText.match(pattern)
    if (match?.[1]) {
      return Number(match[1].replace(',', '.'))
    }
  }

  return null
}

function buildFallbackSuggestions({ documentText, products, partners }) {
  const normalizedDocument = normalize(documentText)

  const partnerSuggestion = partners.find((partner) => normalizedDocument.includes(normalize(partner.name)))

  const lineSuggestions = products
    .map((product) => {
      const sku = normalize(product.sku_code)
      const name = normalize(product.name)
      const skuHit = sku && normalizedDocument.includes(sku)
      const nameHit = name && normalizedDocument.includes(name)
      if (!skuHit && !nameHit) return null

      const quantity = findQuantityNearMatch(documentText, skuHit ? product.sku_code : product.name) || 1
      return {
        productId: product.id,
        skuCode: product.sku_code,
        productName: product.name,
        quantity,
        confidence: skuHit ? 0.84 : 0.72,
        reason: skuHit ? 'Matched the SKU code in the document.' : 'Matched the product name in the document.',
      }
    })
    .filter(Boolean)
    .slice(0, 12)

  const notes = []
  if (!lineSuggestions.length) {
    notes.push('No exact SKU match was found. Paste clearer text or add the lines manually.')
  }
  if (partnerSuggestion) {
    notes.push(`${partnerSuggestion.name} looks like the likely supplier on this document.`)
  }

  return {
    provider: 'fallback',
    partnerId: partnerSuggestion?.id || '',
    partnerName: partnerSuggestion?.name || '',
    notes,
    lines: lineSuggestions,
  }
}

async function requestOpenAiSuggestions({ documentText, fileData, mimeType, fileName, products, partners }) {
  const prompt = `
You are helping a warehouse team draft a goods received note.
Read the delivery note or invoice and return only valid JSON.
Use the product and partner list below. If you are not sure, leave the field empty.

Partners:
${partners.map((partner) => `- ${partner.id} | ${partner.name}`).join('\n')}

Products:
${products.map((product) => `- ${product.id} | ${product.sku_code} | ${product.name}`).join('\n')}
  `.trim()

  const input = [{ role: 'system', content: [{ type: 'input_text', text: prompt }] }]

  if (documentText) {
    input.push({ role: 'user', content: [{ type: 'input_text', text: `Document text:\n${documentText}` }] })
  }

  if (fileData && mimeType) {
    if (mimeType.startsWith('image/')) {
      input.push({
        role: 'user',
        content: [
          { type: 'input_text', text: `Review this document image${fileName ? ` named ${fileName}` : ''}.` },
          { type: 'input_image', image_url: `data:${mimeType};base64,${fileData}` },
        ],
      })
    } else {
      input.push({
        role: 'user',
        content: [
          { type: 'input_text', text: `Review this uploaded document${fileName ? ` named ${fileName}` : ''}.` },
          { type: 'input_file', filename: fileName || 'document', file_data: `data:${mimeType};base64,${fileData}` },
        ],
      })
    }
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL,
      input,
      text: {
        format: {
          type: 'json_schema',
          name: 'grn_document_suggestions',
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              partnerId: { type: 'string' },
              partnerName: { type: 'string' },
              notes: { type: 'array', items: { type: 'string' } },
              lines: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    productId: { type: 'string' },
                    skuCode: { type: 'string' },
                    productName: { type: 'string' },
                    quantity: { type: 'number' },
                    confidence: { type: 'number' },
                    reason: { type: 'string' },
                  },
                  required: ['productId', 'skuCode', 'productName', 'quantity', 'confidence', 'reason'],
                },
              },
            },
            required: ['partnerId', 'partnerName', 'notes', 'lines'],
          },
        },
      },
    }),
  })

  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload?.error?.message || 'Document capture request failed.')
  }

  const jsonText = payload?.output_text || '{}'
  return {
    provider: 'openai',
    ...JSON.parse(jsonText),
  }
}

export async function suggestGrnFromDocument({ documentText = '', fileData = '', mimeType = '', fileName = '', products = [], partners = [] }) {
  if (env.OPENAI_API_KEY && process.env.NODE_ENV !== 'test') {
    try {
      return await requestOpenAiSuggestions({ documentText, fileData, mimeType, fileName, products, partners })
    } catch (_error) {
      // Fall through to the local parser so the user still gets a draft.
    }
  }

  return buildFallbackSuggestions({ documentText, products, partners })
}
