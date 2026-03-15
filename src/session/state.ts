export interface SessionState {
  proc: ReturnType<typeof Bun.spawn> | null
  host: string | null
  connectedAt: number | null
  buffer: string
  pendingResolve: ((result: { output: string; exitCode: number }) => void) | null
  pendingReject: ((error: Error) => void) | null
  currentMarkerId: string
  running: boolean
  commandQueue: Array<() => void>
  readerDone: boolean
}

export function createState(): SessionState {
  return {
    proc: null,
    host: null,
    connectedAt: null,
    buffer: "",
    pendingResolve: null,
    pendingReject: null,
    currentMarkerId: "",
    running: false,
    commandQueue: [],
    readerDone: false,
  }
}
