const MAX_PREVIEW_LENGTH = 60

export function previewFor(messages) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const content = messages[index].content
    if (content) {
      return content.length > MAX_PREVIEW_LENGTH
        ? `${content.slice(0, MAX_PREVIEW_LENGTH - 1).trimEnd()}…`
        : content
    }
  }
  return 'New chat'
}
