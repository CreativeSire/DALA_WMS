export function getUnitsPerPack(product) {
  const value = Number(product?.units_per_pack || 1)
  return Number.isFinite(value) && value > 0 ? value : 1
}

export function getProductUnitOptions(product) {
  const base = product?.base_uom_label || 'ctn'
  const alt = product?.alt_uom_label || ''
  const unitsPerPack = getUnitsPerPack(product)

  const options = [
    { value: '1', label: `${capitalize(base)} (${formatNumber(1)})`, code: 'base' },
  ]

  if (alt && unitsPerPack > 1) {
    options.push({
      value: String(1 / unitsPerPack),
      label: `${capitalize(alt)} (1 / ${formatNumber(unitsPerPack)} ${base})`,
      code: 'alt',
    })
  }

  if (unitsPerPack >= 2) {
    options.push({
      value: '0.5',
      label: `Half ${capitalize(base)} (${formatNumber(0.5)})`,
      code: 'half',
    })
  }

  if (unitsPerPack >= 4) {
    options.push({
      value: '0.25',
      label: `Quarter ${capitalize(base)} (${formatNumber(0.25)})`,
      code: 'quarter',
    })
  }

  return dedupeOptions(options)
}

export function describePackRule(product) {
  const base = product?.base_uom_label || 'ctn'
  const alt = product?.alt_uom_label || ''
  const unitsPerPack = getUnitsPerPack(product)
  return alt && unitsPerPack > 1 ? `1 ${base} = ${formatNumber(unitsPerPack)} ${alt}` : `1 ${base}`
}

function dedupeOptions(options) {
  const seen = new Set()
  return options.filter((option) => {
    const key = `${option.value}:${option.label}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function capitalize(value) {
  const text = String(value || '')
  return text ? `${text[0].toUpperCase()}${text.slice(1)}` : ''
}

function formatNumber(value) {
  return Number(value).toString().replace(/\.0+$/, '')
}
