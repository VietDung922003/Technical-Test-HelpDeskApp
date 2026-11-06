
import type { Site, Staff, HelpdeskRequest } from '../types'
import { daysAgo, localDate } from './dates'

const timezoneAliases: Record<string, string> = {
  SGT: 'Asia/Singapore',
  WIB: 'Asia/Jakarta',
  AEST: 'Australia/Sydney',
  AEDT: 'Australia/Sydney',
}

export const priorityBadgeStyles: Record<string, string> = {
  High: 'bg-red-100 text-red-700',
  Critical: 'bg-purple-100 text-purple-700',
  Medium: 'bg-amber-100 text-amber-700',
  Low: 'bg-green-100 text-green-700',
}

export const statusBadgeStyles: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  processing: 'bg-blue-100 text-blue-700',
  complete: 'bg-green-100 text-green-700',
}

export function resolveSiteTimezone(timezone?: string): string {
  return (timezone && timezoneAliases[timezone]) || timezone || 'UTC'
}

export function createSiteMaps(sites: Site[] = []) {
  return {
    siteNameMap: new Map(sites.map(({ id, name }) => [id, name])),
    siteTimezoneMap: new Map(sites.map(({ id, timezone }) => [id, timezone])),
  }
}

export function createStaffMap(staff: Staff[] = []): Map<number, string> {
  return new Map(staff.map(({ id, name }) => [id, name]))
}

export function displayDateToISO(value?: string | null): string {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value ?? '')
  if (!match) return ''
  const [, day, month, year] = match
  const date = new Date(Number(year), Number(month) - 1, Number(day))
  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
  ) return ''
  return `${year}-${month}-${day}`
}

export function getDefaultDateRange(now = new Date()) {
  return { createdFrom: daysAgo(30, now), createdTo: daysAgo(0, now) }
}

export function padDatePart(value: number): string {
  return String(value).padStart(2, '0')
}

export function shiftISODate(value: string, days: number): string {
  if (!value) return ''
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return ''
  date.setUTCDate(date.getUTCDate() + days)
  return `${date.getUTCFullYear()}-${padDatePart(date.getUTCMonth() + 1)}-${padDatePart(date.getUTCDate())}`
}

export function getSiteLocalDateFromTimestamp(value: string | null | undefined, timezone?: string): string {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : localDate(date, resolveSiteTimezone(timezone))
}

export function filterBoardRequests(
  requests: HelpdeskRequest[],
  filters: {
    createdFrom: string
    createdTo: string
    selectedSite: string | null
    selectedStatuses: string[]
    siteTimezoneMap: Map<number, string>
  },
): HelpdeskRequest[] {
  return requests.filter((request) => {
    const status = request.status.toLowerCase()
    const isCancelled = ['canceled', 'cancelled', 'cancled'].includes(status)
    const isDeletedOrMerged = request.deleted_at != null || request.merged_into_id != null
    const createdLocalDate = getSiteLocalDateFromTimestamp(
      request.created_at,
      filters.siteTimezoneMap.get(request.site_id),
    )

    return (
      !isCancelled &&
      !isDeletedOrMerged &&
      (filters.selectedStatuses.length === 0 || filters.selectedStatuses.includes(request.status)) &&
      (!filters.createdFrom || createdLocalDate >= filters.createdFrom) &&
      (!filters.createdTo || createdLocalDate <= filters.createdTo) &&
      (!filters.selectedSite || String(request.site_id) === filters.selectedSite)
    )
  })
}

export function formatDueDate(
  value: string | null | undefined,
  timezone?: string,
  shortYear = false,
): string {
  if (!value) return '—'
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return value
  const year = shortYear ? match[1].slice(-2) : match[1]
  const formattedDate = `${match[3]}/${match[2]}/${year}`
  return timezone ? `${formattedDate} (${timezone})` : formattedDate
}

export function isRequestOverdue(
  dueOn: string | null | undefined,
  status: string | null | undefined,
  timezone: string | undefined,
  now: Date,
): boolean {
  if (!dueOn || !status || !['pending', 'processing'].includes(status.toLowerCase())) {
    return false
  }

  const dueDate = dueOn.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return false
  return dueDate < localDate(now, resolveSiteTimezone(timezone))
}

export function formatEventTimestamp(unixSeconds: number | string | null | undefined, timezone?: string): string {
  if (unixSeconds == null) return '—'
  const date = new Date(Number(unixSeconds) * 1000)
  if (Number.isNaN(date.getTime())) return '—'
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: resolveSiteTimezone(timezone),
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date)
    const part = (type: string) => parts.find((item) => item.type === type)?.value
    const formatted = `${part('day')}/${part('month')}/${part('year')}, ${part('hour')}:${part('minute')}`
    return timezone ? `${formatted} ${timezone}` : formatted
  } catch {
    return date.toISOString()
  }
}

export function formatDueAt(value: string | number | null | undefined, timezone?: string): string {
  if (value == null) return ''
  return timezone ? `${value} (${timezone})` : String(value)
}

export function formatSiteCreatedAt(value: string | null | undefined, timezone?: string): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: resolveSiteTimezone(timezone),
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date)
    const part = (type: string) => parts.find((item) => item.type === type)?.value
    const formatted = `${part('day')}/${part('month')}/${part('year')} ${part('hour')}:${part('minute')}`
    return timezone ? `${formatted} (${timezone})` : formatted
  } catch {
    return date.toISOString()
  }
}


export function sortBoardRequests(
  requests: HelpdeskRequest[],
  sortBy: string,
  sortOrder: string,
): HelpdeskRequest[] {
  return [...requests].sort((a, b) => {
    const aValue = sortBy === 'created' ? a.created_at : a.due_on ?? ''
    const bValue = sortBy === 'created' ? b.created_at : b.due_on ?? ''
    if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1
    if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1
    return 0
  })
}


export function capitalize(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : ''
}
