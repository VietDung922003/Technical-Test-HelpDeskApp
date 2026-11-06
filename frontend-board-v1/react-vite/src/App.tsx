import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import LiveIndicator from './components/LiveIndicator'
import RequestDetail from './components/RequestDetail'
import Table from './components/Table'
import { listSites, listStaff } from './api'
import { createSiteMaps, createStaffMap } from './lib/helper'
import { HelpdeskRequest } from './types'


function App() {
 const [selectedRequest, setSelectedRequest] = useState<HelpdeskRequest | null>(null)
 const sitesQuery = useQuery({ queryKey: ['sites'], queryFn: listSites })
 const staffQuery = useQuery({ queryKey: ['staff'], queryFn: listStaff })
 const sites = sitesQuery.data
 const staff = staffQuery.data
 const appErrors = [sitesQuery.error, staffQuery.error].filter(Boolean)

 const retryFailedApis = () => {
   if (sitesQuery.isError) sitesQuery.refetch()
   if (staffQuery.isError) staffQuery.refetch()
 }

 const staffMap = useMemo(() => createStaffMap(staff?.data), [staff])
 const { siteNameMap, siteTimezoneMap } = useMemo(
   () => createSiteMaps(sites?.data),
   [sites],
 )

 return (
  <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
   <div className="mx-auto max-w-7xl">
    <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
     <div>
      <p className="mb-1 text-sm font-medium text-blue-600">WORKSPACE</p>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
        Work Requests
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Track and manage requests across your sites
      </p>
     </div>
     <LiveIndicator />
    </div>

    {appErrors.length > 0 && (
      <div
        role="alert"
        className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
      >
        <div>
          <p className="font-semibold">Some supporting data could not be loaded</p>
          <p className="mt-0.5 text-red-700">
            {appErrors[0] instanceof Error
              ? appErrors[0].message
              : 'Check your connection and try again.'}
          </p>
        </div>
        <button
          type="button"
          onClick={retryFailedApis}
          className="rounded-lg border border-red-200 bg-white px-3 py-2 font-semibold text-red-700 hover:bg-red-100"
        >
          Retry
        </button>
      </div>
    )}

    <Table />

    {selectedRequest && <RequestDetail/>}
    </div>
  </main>
 )
}

export default App
