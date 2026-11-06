
import type { Site, Staff } from '../types'

export function createSiteMaps(sites: Site[] = []) {
  return {
    siteNameMap: new Map(sites.map(({ id, name }) => [id, name])),
    siteTimezoneMap: new Map(sites.map(({ id, timezone }) => [id, timezone])),
  }
}

export function createStaffMap(staff: Staff[] = []): Map<number, string> {
  return new Map(staff.map(({ id, name }) => [id, name]))
}
