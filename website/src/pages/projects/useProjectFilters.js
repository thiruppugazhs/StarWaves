/** Project filtering hook — single responsibility: filter and sort projects. */
import { useMemo } from 'react'

export function useProjectFilters({ projects, query, statusFilter, sortOrder }) {
  const statusCounts = useMemo(() => {
    const counts = { All: projects.length, Active: 0, Planning: 0, 'On hold': 0, Completed: 0 }
    projects.forEach((item) => {
      if (counts[item.status] !== undefined) {
        counts[item.status] += 1
      }
    })
    return counts
  }, [projects])

  const filteredProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return projects
      .filter((project) => {
        const searchable = `${project.name} ${project.description} ${(project.technologies || []).join(' ')}`.toLowerCase()
        return (!normalizedQuery || searchable.includes(normalizedQuery)) && (statusFilter === 'All' || project.status === statusFilter)
      })
      .sort((first, second) => {
        if (sortOrder === 'name') return first.name.localeCompare(second.name)
        if (sortOrder === 'progress') return Number(second.progress || 0) - Number(first.progress || 0)
        return new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime()
      })
  }, [projects, query, statusFilter, sortOrder])

  const hasFilters = Boolean(query.trim()) || statusFilter !== 'All' || sortOrder !== 'updated'

  return { statusCounts, filteredProjects, hasFilters }
}
