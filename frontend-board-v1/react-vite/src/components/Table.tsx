import { HelpdeskRequest } from '../types'

interface TableProps {
  onRowClick?: (request: HelpdeskRequest) => void
  siteNameMap?: Map<number, string>
  siteTimezoneMap?: Map<number, string>
  staffMap?: Map<number, string>
}

function Table({
  onRowClick,
  siteNameMap = new Map<number, string>(),
  siteTimezoneMap = new Map<number, string>(),
  staffMap = new Map<number, string>(),
}: TableProps) {
  return (

  )
}

export default Table
