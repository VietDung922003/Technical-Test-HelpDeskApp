interface LiveIndicatorProps {
  lastUpdated?: string
  onRefresh?: () => void
  isRefreshing?: boolean
}

function LiveIndicator({
  lastUpdated = '--:--:--',
  onRefresh,
  isRefreshing = false,
}: LiveIndicatorProps) {
  return (
   <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-600 shadow-sm">
     <span className="flex items-center gap-2 font-medium text-gray-800">
       <span className="relative flex h-2.5 w-2.5">
         <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
         <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
       </span>
       Live
     </span>
     <span className="text-gray-500">
       Last updated:{' '}
       <span className="font-semibold text-gray-800 tabular-nums">
         {lastUpdated}
       </span>
     </span>
     <button
       type="button"
       onClick={onRefresh}
       disabled={!onRefresh || isRefreshing}
       title={onRefresh ? 'Refresh now' : 'Refresh is not connected'}
       aria-label="Refresh now"
       className="ml-auto flex items-center justify-center rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
     >
       <svg
         xmlns="http://www.w3.org/2000/svg"
         viewBox="0 0 24 24"
         fill="none"
         stroke="currentColor"
         strokeWidth="1.8"
         strokeLinecap="round"
         strokeLinejoin="round"
         className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`}
         aria-hidden="true"
       >
         <path d="M21 12a9 9 0 1 1-2.64-6.36" />
         <path d="M21 3v6h-6" />
       </svg>
     </button>
   </div>
  )
}

export default LiveIndicator
