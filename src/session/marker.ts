export const MARKER_PREFIX = "<<__OC_SSH_DONE__"
export const MARKER_SUFFIX = ">>"

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export function markerRegex(id: string): RegExp {
  return new RegExp(`${escapeRegex(MARKER_PREFIX) + id}_(\\d+)${escapeRegex(MARKER_SUFFIX)}`)
}
