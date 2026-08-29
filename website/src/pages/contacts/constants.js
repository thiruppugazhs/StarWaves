import { Star } from 'lucide-react'

export const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'starred', label: 'Starred', icon: Star },
  { id: 'work', label: 'Work' },
  { id: 'personal', label: 'Personal' },
  { id: 'recruiter', label: 'Recruiter' },
  { id: 'team', label: 'Team' },
  { id: 'client', label: 'Client' },
  { id: 'general', label: 'General' },
]

export const CATEGORY_OPTIONS = [
  { value: 'general', label: 'General' },
  { value: 'work', label: 'Work' },
  { value: 'personal', label: 'Personal' },
  { value: 'recruiter', label: 'Recruiter' },
  { value: 'team', label: 'Team' },
  { value: 'client', label: 'Client' },
]

export function getInitials(name = '') {
  const parts = name.trim().split(/\s+/)
  if (!parts.length || !parts[0]) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}
