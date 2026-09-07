/** Ignore broken stdout/stderr when Electron is launched without a console (GUI / detached). */
export function patchConsoleForBrokenPipe(): void {
  const swallow = (err: unknown): boolean => {
    const code = err && typeof err === 'object' && 'code' in err ? String((err as NodeJS.ErrnoException).code) : ''
    return code === 'EPIPE' || code === 'ERR_STREAM_DESTROYED'
  }

  for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    const original = console[method].bind(console)
    console[method] = (...args: unknown[]) => {
      try {
        original(...args)
      } catch (err) {
        if (!swallow(err)) throw err
      }
    }
  }

  for (const stream of [process.stdout, process.stderr]) {
    stream?.on?.('error', (err) => {
      if (swallow(err)) return
    })
  }

  process.prependListener('uncaughtException', (err) => {
    if (!swallow(err)) return
    // Swallow EPIPE so embedded Mineradio startup hooks do not treat it as fatal.
  })
}
