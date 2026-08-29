export function parseQuestionsFromMessage(content) {
  if (!content || typeof content !== 'string') return []

  const lines = content.split('\n')
  const questions = []

  for (const line of lines) {
    const match = line.match(/^\s*(\d+)[.)]\s*(.+)/)
    if (match) {
      const num = match[1]
      const text = match[2].trim()
      if (text.includes('?') || /(purpose|audience|feature|style|authentication|stack|need|want)/i.test(text)) {
        const egMatch = text.match(/\((?:e\.g\.|such as|like)\s*([^)]+)\)/i)
        let recommended = ''
        let alternative = ''

        if (egMatch) {
          const parts = egMatch[1].split(/,|or/).map((p) => p.trim()).filter((p) => p && !p.startsWith('etc'))
          if (parts.length >= 1) recommended = parts[0]
          if (parts.length >= 2) alternative = parts[1]
        }

        if (!recommended) {
          if (/purpose|functionality|goal/i.test(text)) {
            recommended = 'Interactive fullstack web application'
            alternative = 'Minimal single-page landing showcase'
          } else if (/audience|who is/i.test(text)) {
            recommended = 'Personal portfolio / developer showcase'
            alternative = 'Small business / client demo'
          } else if (/auth|login|account/i.test(text)) {
            recommended = 'Yes, include authentication & user profiles'
            alternative = 'No authentication needed (public site)'
          } else if (/style|color|theme|dark/i.test(text)) {
            recommended = 'Clean monochrome with dark mode'
            alternative = 'Modern minimalist light theme'
          } else {
            recommended = 'Yes, implement recommended defaults'
            alternative = 'Keep it minimal and simple'
          }
        }

        questions.push({
          id: `q-${num}`,
          num,
          text,
          recommended: recommended.charAt(0).toUpperCase() + recommended.slice(1),
          alternative: alternative.charAt(0).toUpperCase() + alternative.slice(1),
        })
      }
    }
  }

  return questions
}
