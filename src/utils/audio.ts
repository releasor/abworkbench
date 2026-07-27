let sharedCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  try {
    if (!sharedCtx || sharedCtx.state === 'closed') {
      sharedCtx = new AudioContext()
    }
    if (sharedCtx.state === 'suspended') {
      sharedCtx.resume()
    }
    return sharedCtx
  } catch {
    return null
  }
}

export function playTone(notes: Array<{ freq: number; delay: number }>, duration = 0.2, volume = 0.15) {
  try {
    const ctx = getAudioContext()
    if (!ctx) return
    const now = ctx.currentTime
    for (const { freq, delay } of notes) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now + delay)
      gain.gain.setValueAtTime(0, now + delay)
      gain.gain.linearRampToValueAtTime(volume, now + delay + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.01, now + delay + duration)
      osc.start(now + delay)
      osc.stop(now + delay + duration)
      osc.onended = () => { gain.disconnect() }
    }
  } catch {
    // Audio not available
  }
}

export function playCompleteSound() {
  playTone([
    { freq: 523.25, delay: 0 },
    { freq: 659.25, delay: 0.08 },
  ], 0.2)
}

export function playHabitSound(completed: boolean) {
  if (completed) {
    playTone([
      { freq: 587.33, delay: 0 },
      { freq: 783.99, delay: 0.06 },
    ], 0.15, 0.12)
  } else {
    playTone([
      { freq: 783.99, delay: 0 },
      { freq: 587.33, delay: 0.06 },
    ], 0.15, 0.12)
  }
}

export function playPomodoroCompleteSound() {
  playTone([
    { freq: 523.25, delay: 0 },
    { freq: 659.25, delay: 0.12 },
    { freq: 783.99, delay: 0.24 },
  ], 0.4, 0.2)
}
