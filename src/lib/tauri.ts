import { invoke } from '@tauri-apps/api/core'

/**
 * Type-safe wrapper around Tauri invoke
 * Falls back to returning undefined when not in Tauri context (browser dev)
 */
export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args)
  } catch (e) {
    console.warn(`[Tauri] ${cmd} failed:`, e)
    throw e
  }
}

/**
 * Check if we're running inside Tauri
 */
export function isTauri(): boolean {
  return '__TAURI_INTERNALS__' in window
}
