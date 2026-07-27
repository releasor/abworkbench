// Web Audio API sound effects — no external files needed

import { safeGetString, setBool } from '../../../utils/safeLocalStorage';

const STORAGE_KEY = 'taskflow-sound-enabled';

// Reuse a single AudioContext to avoid hitting browser limits
let sharedCtx: AudioContext | null = null;
function getAudioContext(): AudioContext {
  if (!sharedCtx || sharedCtx.state === 'closed') {
    sharedCtx = new AudioContext();
  }
  if (sharedCtx.state === 'suspended') {
    sharedCtx.resume();
  }
  return sharedCtx;
}

export function isSoundEnabled(): boolean {
  return safeGetString(STORAGE_KEY, 'true') !== 'false';
}

export function setSoundEnabled(enabled: boolean): void {
  setBool(STORAGE_KEY, enabled);
}

// Generate a pleasant "ding" sound for task completion
function playTone(frequency: number, volume: number, duration: number, startDelay = 0): void {
  const ctx = getAudioContext();
  const now = ctx.currentTime + startDelay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(frequency, now);
  gain.gain.setValueAtTime(startDelay > 0 ? 0 : volume, now);
  if (startDelay > 0) {
    gain.gain.linearRampToValueAtTime(volume, now + 0.02);
  }
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration);
}

// Two-note ascending chime (C5 → E5) for task completion
export function playCompletionSound(): void {
  if (!isSoundEnabled()) return;
  try {
    playTone(523.25, 0.15, 0.4, 0);
    playTone(659.25, 0.15, 0.4, 0.12);
  } catch {
    // Ignore audio failures caused by unavailable output devices.
  }
}

// Light tick sound for subtask completion
export function playTickSound(): void {
  if (!isSoundEnabled()) return;
  try {
    playTone(880, 0.1, 0.15);
  } catch {
    // Ignore audio failures caused by unavailable output devices.
  }
}

// Short click sound for UI interactions
export function playClickSound(): void {
  if (!isSoundEnabled()) return;
  try {
    playTone(800, 0.08, 0.08);
  } catch {
    // Ignore audio failures caused by unavailable output devices.
  }
}
