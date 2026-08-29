const BRIEF_STORAGE_PREFIX = 'starwaves.studio.brief.'

export function setStudioBrief(projectId, brief) {
  try {
    sessionStorage.setItem(BRIEF_STORAGE_PREFIX + projectId, JSON.stringify(brief))
  } catch {
    // sessionStorage unavailable
  }
}

export function takeStudioBrief(projectId) {
  try {
    const raw = sessionStorage.getItem(BRIEF_STORAGE_PREFIX + projectId)
    if (!raw) return null
    sessionStorage.removeItem(BRIEF_STORAGE_PREFIX + projectId)
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function composeBriefText(prompt, attachments = [], mode = 'plan') {
  const modeInstruction =
    mode === 'build'
      ? `\n\n[Mode: Build] Generate the full architecture and write all project files directly in one go.`
      : `\n\n[Mode: Plan] Propose an architecture plan, ask any needed questions, and wait for approval before building.`

  const fileBlocks = (attachments || []).map((file) => (
    `\n\n--- File: ${file.name} ---\n${file.textContent || '[Binary file — content not included]'}`
  ))

  return `${prompt}${fileBlocks.join('')}${modeInstruction}`
}
