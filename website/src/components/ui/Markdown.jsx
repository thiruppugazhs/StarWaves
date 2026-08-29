import { useMemo } from 'react'

const INLINE_REGEX =
  /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|~~[^~]+~~|~[^~]+~|_[^_]+_|\[[^\]]+\]\([^)]+\)|https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g

function sanitizeHref(href) {
  const trimmed = (href || '').trim()
  if (/^(https?:|mailto:)/i.test(trimmed)) return trimmed
  return null
}

function renderInline(text, keyPrefix = '') {
  return text.split(INLINE_REGEX).map((part, index) => {
    if (!part) return null
    const key = `${keyPrefix}-${index}`
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={key}>{part.slice(1, -1)}</code>
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={key}>{renderInline(part.slice(2, -2), key)}</strong>
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={key}>{renderInline(part.slice(1, -1), key)}</em>
    }
    if (part.startsWith('_') && part.endsWith('_')) {
      return <em key={key}>{renderInline(part.slice(1, -1), key)}</em>
    }
    if (part.startsWith('~~') && part.endsWith('~~')) {
      return <del key={key}>{renderInline(part.slice(2, -2), key)}</del>
    }
    if (part.startsWith('~') && part.endsWith('~')) {
      return <del key={key}>{renderInline(part.slice(1, -1), key)}</del>
    }
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (linkMatch) {
      const href = sanitizeHref(linkMatch[2])
      if (href) {
        return (
          <a key={key} href={href} target="_blank" rel="noopener noreferrer">
            {renderInline(linkMatch[1], key)}
          </a>
        )
      }
      return <span key={key}>{part}</span>
    }
    if (/^https?:\/\//i.test(part)) {
      const href = sanitizeHref(part)
      if (href) {
        return (
          <a key={key} href={href} target="_blank" rel="noopener noreferrer">
            {part}
          </a>
        )
      }
    }
    return part
  })
}

function renderBlocks(content) {
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  const blocks = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]

    const fenceMatch = line.match(/^```(\w*)\s*$/)
    if (fenceMatch) {
      const codeLines = []
      index++
      while (index < lines.length && !/^```\s*$/.test(lines[index])) {
        codeLines.push(lines[index])
        index++
      }
      index++
      blocks.push(
        <pre key={blocks.length} className="md-code-block">
          <code>{codeLines.join('\n')}</code>
        </pre>,
      )
      continue
    }

    if (!line.trim()) {
      index++
      continue
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/)
    if (headingMatch) {
      const HeadingTag = `h${headingMatch[1].length}`
      blocks.push(
        <HeadingTag key={blocks.length} className="md-heading">
          {renderInline(headingMatch[2], `h${blocks.length}`)}
        </HeadingTag>,
      )
      index++
      continue
    }

    if (/^\s*([-*_])\s*\1\s*\1\s*$/.test(line)) {
      blocks.push(<hr key={blocks.length} className="md-hr" />)
      index++
      continue
    }

    if (/^>\s?/.test(line)) {
      const quoteLines = []
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^>\s?/, ''))
        index++
      }
      blocks.push(
        <blockquote key={blocks.length} className="md-quote">
          {quoteLines.map((qLine, qIdx) => (
            <span key={qIdx}>
              {qIdx > 0 && <br />}
              {renderInline(qLine, `q${blocks.length}-${qIdx}`)}
            </span>
          ))}
        </blockquote>,
      )
      continue
    }

    if (/^[-*+]\s+/.test(line)) {
      const items = []
      while (index < lines.length && /^[-*+]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^[-*+]\s+/, ''))
        index++
      }
      blocks.push(
        <ul key={blocks.length} className="md-list">
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInline(item, `ul${blocks.length}-${itemIndex}`)}</li>
          ))}
        </ul>,
      )
      continue
    }

    if (/^\d+\.\s+/.test(line)) {
      const items = []
      while (index < lines.length && /^\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\d+\.\s+/, ''))
        index++
      }
      blocks.push(
        <ol key={blocks.length} className="md-list">
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInline(item, `ol${blocks.length}-${itemIndex}`)}</li>
          ))}
        </ol>,
      )
      continue
    }

    if (
      line.includes('|') &&
      index + 1 < lines.length &&
      /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/.test(lines[index + 1])
    ) {
      const splitCells = (rowText) =>
        rowText
          .replace(/^\s*\|/, '')
          .replace(/\|\s*$/, '')
          .split('|')
          .map((c) => c.trim())

      const headers = splitCells(line)
      index += 2
      const rows = []
      while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
        rows.push(splitCells(lines[index]))
        index++
      }
      blocks.push(
        <div key={blocks.length} className="md-table-wrapper">
          <table className="md-table">
            <thead>
              <tr>
                {headers.map((cell, cIdx) => (
                  <th key={cIdx}>{renderInline(cell, `th-${blocks.length}-${cIdx}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rIdx) => (
                <tr key={rIdx}>
                  {row.map((cell, cIdx) => (
                    <td key={cIdx}>{renderInline(cell, `td-${blocks.length}-${rIdx}-${cIdx}`)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      )
      continue
    }

    const paragraphLines = [line]
    index++
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^```/.test(lines[index]) &&
      !/^(#{1,6})\s/.test(lines[index]) &&
      !/^>\s?/.test(lines[index]) &&
      !/^[-*+]\s+/.test(lines[index]) &&
      !/^\d+\.\s+/.test(lines[index]) &&
      !(
        lines[index].includes('|') &&
        index + 1 < lines.length &&
        /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/.test(lines[index + 1])
      )
    ) {
      paragraphLines.push(lines[index])
      index++
    }
    blocks.push(
      <p key={blocks.length} className="md-paragraph">
        {paragraphLines.map((lineText, lineIdx) => (
          <span key={lineIdx}>
            {lineIdx > 0 && <br />}
            {renderInline(lineText, `p${blocks.length}-${lineIdx}`)}
          </span>
        ))}
      </p>,
    )
  }

  return blocks
}

export function Markdown({ content, className = '' }) {
  const rendered = useMemo(() => (content ? renderBlocks(content) : null), [content])
  if (!content) return null
  return <div className={`markdown-renderer ${className}`}>{rendered}</div>
}
