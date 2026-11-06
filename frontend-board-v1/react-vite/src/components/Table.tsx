import { HelpdeskRequest } from '../types'
import { useCallback, useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { listRequests } from '../api'
import { displayDateToISO, getDefaultDateRange, shiftISODate, isRequestOverdue, filterBoardRequests, sortBoardRequests, capitalize, formatDueDate, priorityBadgeStyles, statusBadgeStyles } from '../lib/helper'
import { toApiDate } from '../lib/dates'


const statuses = ['pending', 'processing', 'complete']

const columns = [
  { key: 'site', label: 'Site' },
  { key: 'reference', label: 'Reference' },
  { key: 'title', label: 'Title' },
  { key: 'priority', label: 'Priority' },
  { key: 'status', label: 'Status' },
  { key: 'assignee', label: 'Assignee' },
  { key: 'dueDate', label: 'Due date' },
  { key: 'warning', label: 'Warning' },
]

const defaultRange = getDefaultDateRange()

const apiDateOrEmpty = (value: string) => (value ? toApiDate(value) : '')

type QueryUpdates = Record<string, string | null>

interface FilterChipProps {
  label: string
  active: boolean
  onClick: () => void
}

interface TableProps {
  onRowClick?: (request: HelpdeskRequest) => void
  siteNameMap?: Map<number, string>
  siteTimezoneMap?: Map<number, string>
  staffMap?: Map<number, string>
}

const readFiltersFromParams = (params: URLSearchParams) => {
  let statusesFromUrl: string[] = []
  try {
    const parsed = JSON.parse(params.get('status') || '[]')
    if (Array.isArray(parsed)) {
      statusesFromUrl = parsed.filter((status) => typeof status === 'string')
    }
  } catch {
    statusesFromUrl = []
  }

  const [urlSortBy, urlSortOrder] = (params.get('sort') || '').split(':')
  const siteFromUrl = params.get('site')

  return {
    createdFrom: params.has('created_from')
      ? displayDateToISO(params.get('created_from'))
      : defaultRange.createdFrom,
    createdTo: params.has('created_to')
      ? displayDateToISO(params.get('created_to'))
      : defaultRange.createdTo,
    selectedSite: siteFromUrl && siteFromUrl !== 'all' ? siteFromUrl : null,
    selectedStatuses: statusesFromUrl,
    sortBy: ['created', 'dueDate'].includes(urlSortBy) ? urlSortBy : 'created',
    sortOrder: ['asc', 'desc'].includes(urlSortOrder) ? urlSortOrder : 'desc',
  }
}

const dateInputClassName =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100'

function FilterChip({ label, active, onClick }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600/10'
          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  )
}

function Table({
  onRowClick,
  siteNameMap = new Map<number, string>(),
  siteTimezoneMap = new Map<number, string>(),
  staffMap = new Map<number, string>(),
}: TableProps) {
 const [now] = useState(() => new Date())
 const [searchParams, setSearchParams] = useSearchParams()
 const {
    createdFrom,
    createdTo,
    selectedSite,
    selectedStatuses,
    sortBy,
    sortOrder,
 } = readFiltersFromParams(searchParams)

 const updateQuery = useCallback((updates: QueryUpdates) => {
   setSearchParams((currentParams) => {
     const params = new URLSearchParams(currentParams)
     params.set('page', String(updates.page ?? '1'))
     Object.entries(updates).forEach(([key, value]) => {
       if (value === null) params.delete(key)
       else params.set(key, value)
     })
     return params
   })
 }, [setSearchParams])

 useEffect(() => {
   const needsDefaults =
     !searchParams.has('page') ||
     !searchParams.has('per_page') ||
     !searchParams.has('created_from') ||
     !searchParams.has('created_to') ||
     !searchParams.has('site') ||
     !searchParams.has('status') ||
     !searchParams.has('sort')

   if (needsDefaults) {
     updateQuery({
       page: searchParams.get('page') || '1',
       per_page: searchParams.get('per_page') || '10',
       created_from: searchParams.get('created_from') || apiDateOrEmpty(createdFrom),
       created_to: searchParams.get('created_to') || apiDateOrEmpty(createdTo),
       site: searchParams.get('site') || 'all',
       status: searchParams.get('status') || JSON.stringify(selectedStatuses),
       sort: searchParams.get('sort') || `${sortBy}:${sortOrder}`,
     })
   }
 }, [searchParams, createdFrom, createdTo, selectedStatuses, sortBy, sortOrder, updateQuery])

 const setCreatedFrom = (value: string) =>
   updateQuery({ created_from: apiDateOrEmpty(value) })
 const setCreatedTo = (value: string) =>
   updateQuery({ created_to: apiDateOrEmpty(value) })
 const setSelectedSite = (value: string | null | ((current: string | null) => string | null)) => {
   const nextSite = typeof value === 'function' ? value(selectedSite) : value
   updateQuery({ site: nextSite || 'all' })
 }

 const setSelectedStatuses = (value: string[] | ((current: string[]) => string[])) => {
   const nextStatuses = typeof value === 'function' ? value(selectedStatuses) : value
   updateQuery({ status: JSON.stringify(nextStatuses) })
 }

 const setSortBy = (value: string) => updateQuery({ sort: `${value}:${sortOrder}` })
 const setSortOrder = (value: string) => updateQuery({ sort: `${sortBy}:${value}` })

 const page = Math.max(1, Number(searchParams.get('page')) || 1)
 const perPage = Math.min(100, Math.max(1, Number(searchParams.get('per_page')) || 10))

 const requestParams = {
   page,
   per_page: perPage,
   created_from: apiDateOrEmpty(shiftISODate(createdFrom, -1)),
   created_to: apiDateOrEmpty(shiftISODate(createdTo, 1)),
   status: selectedStatuses,
 }

 const {
   data: response,
   isLoading,
   isError,
   error,
  } = useQuery({
   queryKey: ['requests', requestParams],
   queryFn: () => listRequests({
         ...requestParams,
         status: selectedStatuses.length ? JSON.stringify(selectedStatuses) : undefined,
       }),
  })
 const requests = response?.data ?? []

 const boardFilters = {
   createdFrom,
   createdTo,
   selectedSite,
   selectedStatuses,
   siteTimezoneMap,
 }
 const filteredData = filterBoardRequests(requests, boardFilters)
 const sortedData = sortBoardRequests(filteredData, sortBy, sortOrder)

 const toggleSite = (site: string) =>
  setSelectedSite((current) => (current === site ? null : site))

 const toggleStatus = (status: string) =>
   setSelectedStatuses((current) =>
     current.includes(status)
       ? current.filter((item: string) => item !== status)
       : [...current, status],
  )

 const resetDateRange = () =>
   updateQuery({
     created_from: apiDateOrEmpty(defaultRange.createdFrom),
     created_to: apiDateOrEmpty(defaultRange.createdTo),
   })
  return (
   <div className="space-y-5">
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
     <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold text-slate-900">Filters</h2>
        <p className="mt-0.5 text-sm text-slate-500">Narrow requests by date, site, or status</p>
      </div>
      <button
        type="button"
        onClick={resetDateRange}
        className="rounded-lg px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-50"
      >
        Reset to last 30 days
      </button>
     </div>

     <div className="grid gap-4 border-b border-slate-100 pb-5 sm:grid-cols-2 lg:grid-cols-[minmax(180px,220px)_minmax(180px,220px)_1fr] lg:items-end">
      <div className="space-y-1.5">
       <label htmlFor="created-from" className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
         Created from
       </label>
       <input
         id="created-from"
         type="date"
         value={createdFrom}
         max={createdTo || undefined}
         onChange={(event) => setCreatedFrom(event.target.value)}
         className={dateInputClassName}
       />
      </div>
      <div className="space-y-1.5">
       <label htmlFor="created-to" className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
         Created to
       </label>
       <input
         id="created-to"
         type="date"
         value={createdTo}
         min={createdFrom || undefined}
         onChange={(event) => setCreatedTo(event.target.value)}
         className={dateInputClassName}
       />
      </div>
      <p className="text-sm text-slate-500 lg:pb-2">
        Date format: <span className="font-medium text-slate-700">DD/MM/YYYY</span>
        <span className="mx-2 text-slate-300">|</span>
        {apiDateOrEmpty(createdFrom) || '—'} – {apiDateOrEmpty(createdTo) || '—'}
      </p>
     </div>
     <div className="space-y-4 pt-5">
       <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
         <span className="w-14 pt-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Site</span>
         <div className="flex flex-1 flex-wrap gap-2">
           <FilterChip
             label="All sites"
             active={selectedSite === null}
             onClick={() => setSelectedSite(null)}
           />
           {Array.from(siteNameMap.entries()).map(([siteId, siteName]) => (
             <FilterChip
               key={siteId}
               label={siteName}
               active={selectedSite === String(siteId)}
               onClick={() => toggleSite(String(siteId))}
             />
           ))}
         </div>
       </div>

       <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
         <span className="w-14 pt-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Status</span>
         <div className="flex flex-1 flex-wrap gap-2">
           <FilterChip
             label="All"
             active={selectedStatuses.length === 0}
             onClick={() => setSelectedStatuses([])}
           />
           {statuses.map((status) => (
             <FilterChip
               key={status}
               label={capitalize(status)}
               active={selectedStatuses.includes(status)}
               onClick={() => toggleStatus(status)}
             />
           ))}
         </div>
       </div>
     </div>
    </section>

    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-slate-500"><span className="font-semibold text-slate-900">{filteredData.length}</span> requests</p>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="sort-by" className="text-sm text-slate-500">Sort:</label>
        <select
          id="sort-by"
          value={sortBy}
          onChange={(event) => setSortBy(event.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        >
          <option value="created">Created</option>
          <option value="dueDate">Due date</option>
        </select>
        <select
          id="sort-order"
          aria-label="Sort order"
          value={sortOrder}
          onChange={(event) => setSortOrder(event.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        >
          <option value="asc">Ascending</option>
          <option value="desc">Descending</option>
        </select>

      </div>
    </div>

    {isError && (
      <div
        role="alert"
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
      >
        <div>
          <p className="font-semibold">Could not load requests</p>
          <p className="mt-0.5 text-red-700">
            {error instanceof Error ? error.message : 'Check your connection and try again.'}
          </p>
        </div>

      </div>
    )}

    <div className="w-full overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[900px] border-collapse text-left text-sm">
        <thead>
          <tr className="bg-slate-50 text-slate-500">
            {columns.map((column) => (
              <th
                key={column.key}
                className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide whitespace-nowrap"
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {isLoading ? (
            Array.from({ length: perPage }, (_, rowIndex) => (
              <tr key={`skeleton-${rowIndex}`} className="animate-pulse">
                {columns.map((column, columnIndex) => (
                  <td key={column.key} className="px-4 py-4">
                    <span
                      className={`block h-4 rounded bg-slate-100 ${columnIndex === 2 ? 'w-48' : 'w-24'}`}
                      aria-hidden="true"
                    />
                  </td>
                ))}
              </tr>
            ))
          ) : isError && !response ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-slate-500">
                Requests are currently unavailable. Please try again later.
              </td>
            </tr>
          ) : sortedData.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-slate-400">
                No requests found
              </td>
            </tr>
          ) : (
            sortedData.map((row) => {
              const siteName = siteNameMap.get(row.site_id) ?? `Site ${row.site_id}`
              const assigneeName = row.assignee
                ? staffMap.get(row.assignee.id) ?? row.assignee.name
                : 'Unassigned'
              const dueDate = row.due_on?.slice(0, 10) ?? ''
              const dueDateDisplay = formatDueDate(
                row.due_on,
                siteTimezoneMap.get(row.site_id),
              )
              const isOverdue = isRequestOverdue(
                row.due_on,
                row.status,
                siteTimezoneMap.get(row.site_id),
                now,
              )
              const detailRow = {
                ...row,
                site: siteName,
                reference: row.ref,
                timezone: siteTimezoneMap.get(row.site_id),

                createdAt: row.created_at,
                dueDate,
                warning: isOverdue ? 'Overdue' : '',
              }

              return (
                <tr
                  key={row.id}
                  onClick={() => onRowClick?.(detailRow)}
                  className="cursor-pointer transition-colors hover:bg-slate-50"
                >
                  <td className="px-4 py-3 font-medium text-gray-900">{siteName}</td>
                  <td className="px-4 py-3 text-gray-600">{row.ref}</td>
                  <td className="px-4 py-3 text-gray-900">{row.title}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${priorityBadgeStyles[row.priority ?? ''] || 'bg-gray-100 text-gray-700'}`}>
                      {row.priority ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeStyles[row.status] || 'bg-gray-100 text-gray-700'}`}>
                      {capitalize(row.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{assigneeName}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-600">{dueDateDisplay}</td>
                  <td className="px-4 py-3 text-amber-600">{isOverdue ? 'Overdue' : '—'}</td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>

    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-slate-500">
        Showing {response?.total ? Math.min((page - 1) * perPage + 1, response.total) : 0}
        {'–'}
        {Math.min(page * perPage, response?.total ?? 0)} of {response?.total ?? 0} requests
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => updateQuery({ page: String(page - 1) })}
          disabled={page <= 1 || isLoading}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Previous
        </button>
        <span className="text-sm text-slate-600">
          Page {page} of {Math.max(1, response?.total_pages ?? 1)}
        </span>
        <button
          type="button"
          onClick={() => updateQuery({ page: String(page + 1) })}
          disabled={page >= (response?.total_pages ?? 1) || isLoading}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
   </div>
  )
}

export default Table
