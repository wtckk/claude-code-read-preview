export type Shot = { file: string; name: string; columns: number; rows: number }

declare module 'claude-code' {
  interface PluginState {
    'read-preview': { shots: Record<string, Shot> }
  }
}
