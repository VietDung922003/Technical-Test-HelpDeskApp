import { useEffect, useMemo, useState } from 'react'
import type { HelpdeskRequest, RequestEvent } from '../types'
import { useQuery } from '@tanstack/react-query'
import { listEvents } from '../api'
import { isRequestOverdue, formatEventTimestamp, priorityBadgeStyles, statusBadgeStyles, capitalize, formatSiteCreatedAt, formatDueDate, formatDueAt } from '../lib/helper'


interface DetailRequest extends HelpdeskRequest {
  reference?: string
  site?: string
  timezone?: string
  dueDate?: string | null
  createdAt?: string
}

interface RequestDetailProps {
  request: DetailRequest
  onClose: () => void
  onBack: () => void
  staffMap?: Map<number, string>
}

function buildDetail(row: DetailRequest) {
  return {
    reference: row.ref ?? row.reference ?? '—',
    title: row.title ?? '—',
    location: row.location ?? '—',
    building: row.site ?? '—',
    timezone: row.timezone ?? '',
    priority: row.priority ?? '—',
    status: row.status ?? '—',
    dueOn: row.due_on ?? row.dueDate ?? null,
    assignee: row.assignee?.name ?? row.assignee ?? 'Unassigned',
    createdAt: row.created_at ?? row.createdAt ?? '—',
    dueDate: row.due_on ?? row.dueDate ?? '—',
  }
}

function RequestDetail({request,
onClose,
onBack,
staffMap = new Map<number, string>(),
}: RequestDetailProps) {
 const [showReverted, setShowReverted] = useState(false)
 const [now] = useState(() => new Date())
 const detail = buildDetail(request)
 const isOverdue = isRequestOverdue(
   detail.dueOn,
   detail.status,
   detail.timezone,
   now,
 )
 const {
   data: events = [],
   isLoading: isEventsLoading,
   isError: isEventsError,
   error: eventsError,
 } = useQuery({
   queryKey: ['request-events', request.id],
   queryFn: async () => {
     const allEvents: RequestEvent[] = []
     let page = 1
     let hasMore
     do {
       const response = await listEvents(request.id, page)
       allEvents.push(...response.data)
       hasMore = response.has_more
       page += 1
     } while (hasMore)
     return allEvents
   },
   enabled: request.id != null,
 })

 const firstResponseEvent = useMemo(
   () => events
     .filter((event) => event.status === 'processing' && event.actor_id !== null)
     .sort((a, b) => a.at - b.at)[0] ?? null,
   [events],
 )

 const firstResponse = firstResponseEvent
   ? {
       respondedBy:
         (firstResponseEvent.actor_id !== null
           ? staffMap.get(firstResponseEvent.actor_id)
           : undefined) ??
         firstResponseEvent.actor_name ??
         `Staff ${firstResponseEvent.actor_id}`,
       responseTime: formatEventTimestamp(firstResponseEvent.at, detail.timezone),
     }
  : null

 useEffect(() => {
   const handleKey = (event: globalThis.KeyboardEvent) => {
     if (event.key === 'Escape') onClose()
   }
   window.addEventListener('keydown', handleKey)
   return () => window.removeEventListener('keydown', handleKey)
 }, [onClose])

 const revertingIds = new Set(
   events.filter((event) => event.reverts_id != null).map((event) => event.reverts_id),
 )
 const isRevertedEvent = (event: RequestEvent) =>
   event.reverts_id != null || revertingIds.has(event.id)

 const visibleEvents = showReverted
   ? events
  : events.filter((event) => !isRevertedEvent(event))

 const revertedCount = events.filter(isRevertedEvent).length
 const sortedEvents = [...visibleEvents].sort((a, b) => b.at - a.at)
  return (
   <div
     className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 sm:p-8"
     onClick={onClose}
   >
     <div
       className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-xl"
       onClick={(event) => event.stopPropagation()}
       role="dialog"
       aria-modal="true"
       aria-label="Request detail"
     >
       {/* Header nav */}
       <div className="sticky top-0 flex items-center border-b border-gray-200 bg-white px-6 py-3">
         <button
           type="button"
           onClick={onBack}
           className="flex items-center gap-1 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
         >
           <span aria-hidden="true">←</span> Back to Board
         </button>
       </div>

       <div className="px-6 py-6">
         {/* Title block */}
         <div className="flex flex-wrap items-start justify-between gap-3">
           <div>
             <h2 className="text-2xl font-bold text-gray-900">
               {detail.reference}
             </h2>
             <p className="mt-1 text-base text-gray-700">{detail.title}</p>
           </div>
           <div className="flex flex-wrap items-center gap-2">
             <span
               className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${priorityBadgeStyles[detail.priority] || 'bg-gray-100 text-gray-700'}`}
             >
               {detail.priority} Priority
             </span>
             <span
               className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeStyles[detail.status] || 'bg-gray-100 text-gray-700'}`}
             >
               {capitalize(detail.status)}
             </span>
             {isOverdue && (
               <span className="inline-flex rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white">
                 ⚠️ OVERDUE
               </span>
             )}
           </div>
         </div>
         <p className="mt-2 text-sm text-gray-500">
           📍 {detail.location} — {detail.building}
         </p>

         {/* First response banner */}
         {firstResponse ? (
           <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
             <div className="text-xs font-semibold tracking-wide text-blue-700">
               ⚡ FIRST RESPONSE
             </div>
             <div className="mt-1 text-sm text-gray-800">
               Responded by:{' '}
               <span className="font-semibold">
                 {firstResponse.respondedBy}
               </span>
             </div>
             <div className="text-sm text-gray-600">
               Response time: {firstResponse.responseTime}
             </div>

           </div>
         ) : isEventsLoading ? (
           <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
             Loading first-response data…
           </div>
         ) : isEventsError ? (
           <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
             {eventsError instanceof Error ? eventsError.message : 'Unable to load request events'}
           </div>
         ) : (
           <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
             <div className="text-xs font-semibold tracking-wide text-amber-700">
               ⏳ Awaiting first response
             </div>
             <div className="mt-1 text-sm text-gray-700">
               No technician has responded yet.
             </div>
           </div>
         )}

         {/* Key details */}
         <div className="mt-6 rounded-lg border border-gray-200">
           <div className="border-b border-gray-200 px-4 py-2 text-xs font-semibold tracking-wide text-gray-500">
             📋 KEY DETAILS
           </div>
           <div className="grid grid-cols-1 gap-4 px-4 py-4 sm:grid-cols-2">
             <div>
               <div className="text-xs text-gray-500">Assignee</div>
               <div className="text-sm font-medium text-gray-900">
                 {typeof detail.assignee === 'string' ? detail.assignee : detail.assignee.name}
               </div>
             </div>
             <div>
               <div className="text-xs text-gray-500">Due Date</div>
               <div
                 className={`text-sm font-medium ${isOverdue ? 'text-red-600' : 'text-gray-900'}`}
               >
                 {formatDueDate(detail.dueDate, detail.timezone, true)}
               </div>
             </div>
             <div>
               <div className="text-xs text-gray-500">Created</div>
               <div className="text-sm font-medium text-gray-900">
                 {formatSiteCreatedAt(detail.createdAt, detail.timezone)}
               </div>
             </div>
             <div>
               <div className="text-xs text-gray-500">Status</div>
               <div className="text-sm font-medium text-gray-900">
                 {capitalize(detail.status)}
               </div>
             </div>
           </div>
         </div>

         {/* Audit timeline */}
         <div className="mt-6">
           <div className="flex flex-wrap items-center justify-between gap-3">
             <div>
               <div className="text-xs font-semibold tracking-wide text-gray-500">
                 📜 AUDIT TIMELINE
               </div>
               <div className="text-xs text-gray-400">
                 {detail.timezone ? `All times shown in ${detail.timezone}` : 'Times are shown as returned by the API'}
               </div>
             </div>
             <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-600">
               <input
                 type="checkbox"
                 checked={showReverted}
                 onChange={(event) => setShowReverted(event.target.checked)}
                 className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
               />
               Show reverted events ({revertedCount} hidden)
             </label>
           </div>

           <div className="mt-4">
             {isEventsLoading ? (
               <p className="py-6 text-center text-sm text-gray-400">Loading events…</p>
             ) : isEventsError ? (
               <p className="py-6 text-center text-sm text-red-500">
                 {eventsError instanceof Error ? eventsError.message : 'Unable to load events'}
               </p>
             ) : sortedEvents.length === 0 ? (
               <p className="py-6 text-center text-sm text-gray-400">
                 No events
               </p>
             ) : (
               sortedEvents.map((event) => {
                 const reverted = isRevertedEvent(event)
                 return (
                   <div
                     key={event.id}
                     className={`relative border-l-2 border-gray-200 pb-5 pl-4 last:pb-0 ${reverted ? 'opacity-50' : ''}`}
                   >
                     <div className="flex items-start gap-2">
                       {event.status === 'processing' && event.actor_id !== null ? (
                         <span
                           className="mt-0.5 text-amber-500"
                           aria-label="First response"
                         >
                           ★
                         </span>
                       ) : (
                         <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gray-300" />
                       )}
                       <div>
                         <div className="text-sm text-gray-900">
                           <span className="font-medium">
                             {formatEventTimestamp(event.at, detail.timezone)}
                           </span>{' '}
                           ── {event.status
                             ? `Status: ${capitalize(event.status)}`
                             : event.due_at != null
                               ? `Due date: ${formatDueAt(event.due_at, detail.timezone)}`
                               : event.note
                                 ? 'Note'
                                 : 'Event'}
                           {reverted && (
                             <span className="ml-2 rounded bg-gray-200 px-1.5 py-0.5 text-xs font-semibold text-gray-600">
                               [Reverted]
                             </span>
                           )}
                         </div>
                         <div className="text-sm text-gray-500">
                           Actor: {event.actor_id === null
                             ? 'System'
                             : staffMap.get(event.actor_id) ?? event.actor_name ?? `Staff ${event.actor_id}`}
                         </div>
                         {event.note && (
                           <div className="mt-1.5 border-l-2 border-gray-300 pl-3 text-sm italic text-gray-600">
                             {event.note}
                           </div>
                         )}
                       </div>
                     </div>
                   </div>
                 )
               })
             )}
           </div>
         </div>
       </div>
     </div>
   </div>
  )
}

export default RequestDetail
