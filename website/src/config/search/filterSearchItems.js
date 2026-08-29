export function filterSearchItems(items, query = '', selectedCategory = 'all') {
  const trimmed = query.trim().toLowerCase()
  const terms = trimmed.split(/\s+/).filter(Boolean)

  let filtered = items
  if (selectedCategory && selectedCategory !== 'all') {
    filtered = items.filter((item) => item.category === selectedCategory)
  }

  if (!terms.length) {
    return filtered
  }

  const scored = []

  for (const item of filtered) {
    const title = (item.title || '').toLowerCase()
    const subtitle = (item.subtitle || '').toLowerCase()
    const badge = (item.badge || '').toLowerCase()
    const keywords = (item.keywords || []).map((k) => String(k).toLowerCase())

    let score = 0
    let matchedAll = true

    for (const term of terms) {
      let termMatched = false
      if (title.startsWith(term)) {
        score += 100
        termMatched = true
      } else if (title.includes(term)) {
        score += 50
        termMatched = true
      }
      for (const kw of keywords) {
        if (kw === term) {
          score += 40
          termMatched = true
        } else if (kw.startsWith(term)) {
          score += 25
          termMatched = true
        } else if (kw.includes(term)) {
          score += 15
          termMatched = true
        }
      }
      if (badge.includes(term)) {
        score += 20
        termMatched = true
      }
      if (subtitle.includes(term)) {
        score += 10
        termMatched = true
      }
      if (!termMatched) {
        matchedAll = false
        break
      }
    }

    if (matchedAll && score > 0) {
      scored.push({ item, score })
    }
  }

  scored.sort((a, b) => b.score - a.score)
  return scored.map((s) => s.item)
}
