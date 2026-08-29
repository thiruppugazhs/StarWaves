import { request } from './_shared'

function mapHackathon(record) {
  return {
    id: record.id,
    title: record.title,
    organizer: record.organizer,
    startsAt: record.starts_at,
    endsAt: record.ends_at,
    mode: record.mode,
    teamSize: record.team_size,
    tags: record.tags,
    url: record.url,
    source: record.source ?? 'manual',
  }
}

export async function loadHackathons(cursor = null) {
  const page = await request(`/hackathons?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`)
  return { ...page, items: page.items.map(mapHackathon) }
}

export function loadHackathonSources() {
  return request('/hackathon-sources')
}

export function setHackathonSourceEnabled(sourceId, enabled) {
  return request(
    `/hackathon-sources/${encodeURIComponent(sourceId)}?enabled=${enabled}`,
    { method: 'PUT' },
  )
}

export async function createHackathon(hackathon) {
  const record = await request('/hackathons', {
    method: 'POST',
    body: JSON.stringify({
      title: hackathon.title,
      organizer: hackathon.organizer,
      starts_at: new Date(hackathon.startsAt).toISOString(),
      ends_at: new Date(hackathon.endsAt).toISOString(),
      mode: hackathon.mode,
      team_size: hackathon.teamSize,
      tags: hackathon.tags,
      url: hackathon.url,
    }),
  })
  return mapHackathon(record)
}

export async function updateHackathon(hackathonId, hackathon) {
  const payload = {}
  if ('title' in hackathon) payload.title = hackathon.title
  if ('organizer' in hackathon) payload.organizer = hackathon.organizer
  if ('startsAt' in hackathon) payload.starts_at = new Date(hackathon.startsAt).toISOString()
  if ('endsAt' in hackathon) payload.ends_at = new Date(hackathon.endsAt).toISOString()
  if ('mode' in hackathon) payload.mode = hackathon.mode
  if ('teamSize' in hackathon) payload.team_size = hackathon.teamSize
  if ('tags' in hackathon) payload.tags = hackathon.tags
  if ('url' in hackathon) payload.url = hackathon.url

  const record = await request(`/hackathons/${encodeURIComponent(hackathonId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  return mapHackathon(record)
}

export function deleteHackathon(hackathonId) {
  return request(`/hackathons/${encodeURIComponent(hackathonId)}`, { method: 'DELETE' })
}