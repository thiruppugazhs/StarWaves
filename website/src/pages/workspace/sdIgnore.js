import picomatch from 'picomatch'

const ALWAYS_IGNORED = ['.git', '.DS_Store', 'Thumbs.db']

export function parseSdIgnore(content) {
  if (!content) return []
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
}

export function createIgnoreMatcher(patterns) {
  const allPatterns = [...ALWAYS_IGNORED, ...patterns]
  const matchers = allPatterns.map((pattern) => {
    const cleaned = pattern.endsWith('/') ? pattern.slice(0, -1) : pattern
    return picomatch(cleaned, { dot: true })
  })

  return function isIgnored(filePath) {
    const segments = filePath.split('/')
    return segments.some((segment) =>
      matchers.some((matcher) => matcher(segment)),
    ) || matchers.some((matcher) => matcher(filePath))
  }
}
