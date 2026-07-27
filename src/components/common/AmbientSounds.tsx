import { useState, useEffect } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import clsx from 'clsx'

interface SoundOption {
  id: string
  label: string
  icon: string
  type: 'white' | 'pink' | 'brown' | 'rain' | 'wind'
}

const sounds: SoundOption[] = [
  { id: 'white', label: '白噪音', icon: '🌊', type: 'white' },
  { id: 'pink', label: '粉噪音', icon: '🌸', type: 'pink' },
  { id: 'brown', label: '棕噪音', icon: '🪵', type: 'brown' },
  { id: 'rain', label: '雨声', icon: '🌧️', type: 'rain' },
  { id: 'wind', label: '风声', icon: '💨', type: 'wind' },
]

// Module-level audio manager — persists across component mounts/unmounts
let audioCtx: AudioContext | null = null
let sourceNode: AudioBufferSourceNode | null = null
let gainNode: GainNode | null = null
let currentSoundId: string | null = null
let currentVolume = 50
let currentMuted = false
let listeners: Array<() => void> = []

function notify() { for (const fn of listeners) fn() }

function subscribe(fn: () => void) {
  listeners.push(fn)
  return () => { listeners = listeners.filter((l) => l !== fn) }
}

function getSnapshot() {
  return { activeSound: currentSoundId, volume: currentVolume, muted: currentMuted }
}

function stopAudio() {
  if (sourceNode) {
    try { sourceNode.stop() } catch { /* already stopped */ }
    sourceNode.disconnect()
    sourceNode = null
  }
  currentSoundId = null
  notify()
}

function startAudio(type: SoundOption['type']) {
  stopAudio()

  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new AudioContext()
  }
  const ctx = audioCtx
  if (ctx.state === 'suspended') ctx.resume()

  const bufferSize = ctx.sampleRate * 4
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1

  const src = ctx.createBufferSource()
  src.buffer = buffer
  src.loop = true
  sourceNode = src

  const filter = ctx.createBiquadFilter()
  const gain = ctx.createGain()
  gainNode = gain

  const vol = currentMuted ? 0 : (currentVolume / 100) * 0.3

  switch (type) {
    case 'white':
      gain.gain.setValueAtTime(vol, ctx.currentTime)
      break
    case 'pink':
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(1200, ctx.currentTime)
      gain.gain.setValueAtTime(vol * 1.3, ctx.currentTime)
      break
    case 'brown':
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(400, ctx.currentTime)
      gain.gain.setValueAtTime(vol * 2, ctx.currentTime)
      break
    case 'rain':
      filter.type = 'bandpass'
      filter.frequency.setValueAtTime(2000, ctx.currentTime)
      filter.Q.setValueAtTime(0.5, ctx.currentTime)
      gain.gain.setValueAtTime(vol * 0.8, ctx.currentTime)
      break
    case 'wind':
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(600, ctx.currentTime)
      gain.gain.setValueAtTime(vol * 1.2, ctx.currentTime)
      break
  }

  src.connect(filter)
  filter.connect(gain)
  gain.connect(ctx.destination)
  src.start()
}

function setVolume(vol: number) {
  currentVolume = vol
  if (gainNode && audioCtx) {
    const v = currentMuted ? 0 : (vol / 100) * 0.3
    gainNode.gain.setValueAtTime(v, audioCtx.currentTime)
  }
  notify()
}

function setMuted(muted: boolean) {
  currentMuted = muted
  if (gainNode && audioCtx) {
    const v = muted ? 0 : (currentVolume / 100) * 0.3
    gainNode.gain.setValueAtTime(v, audioCtx.currentTime)
  }
  notify()
}

function toggleSoundId(sound: SoundOption) {
  if (currentSoundId === sound.id) {
    stopAudio()
  } else {
    currentSoundId = sound.id
    startAudio(sound.type)
  }
  notify()
}

interface AmbientSoundsProps {
  compact?: boolean
}

export default function AmbientSounds({ compact = false }: AmbientSoundsProps) {
  const [state, setState] = useState(getSnapshot)

  useEffect(() => {
    queueMicrotask(() => {
      setState(getSnapshot())
    })
    return subscribe(() => setState(getSnapshot()))
  }, [])

  const { activeSound, volume, muted } = state

  if (compact) {
    const activeSoundObj = sounds.find((s) => s.id === activeSound)
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => setMuted(!muted)}
          aria-label={muted ? '取消静音' : '静音'}
          className="p-1.5 rounded-lg text-text-muted hover:text-text transition-colors"
        >
          {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>
        <div className="flex gap-1">
          {sounds.map((sound) => (
            <button
              key={sound.id}
              onClick={() => toggleSoundId(sound)}
              aria-label={`${sound.label}${activeSound === sound.id ? '（已选中）' : ''}`}
              className={clsx(
                'w-7 h-7 rounded-md text-sm flex items-center justify-center transition-all',
                activeSound === sound.id
                  ? 'bg-primary/20 scale-110'
                  : 'bg-surface-lighter hover:bg-surface-lighter/80'
              )}
              title={sound.label}
            >
              {sound.icon}
            </button>
          ))}
        </div>
        {activeSoundObj && !muted && (
          <span className="text-xs text-primary">{activeSoundObj.label}</span>
        )}
      </div>
    )
  }

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Volume2 size={16} className="text-primary" />
          <span className="text-sm font-medium text-text">环境音</span>
        </div>
        <button
          onClick={() => setMuted(!muted)}
          aria-label={muted ? '取消静音' : '静音'}
          className="p-1.5 rounded-lg text-text-muted hover:text-text transition-colors"
        >
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {sounds.map((sound) => (
          <button
            key={sound.id}
            onClick={() => toggleSoundId(sound)}
            aria-label={`${sound.label}${activeSound === sound.id ? '（已选中）' : ''}`}
            className={clsx(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all',
              activeSound === sound.id
                ? 'bg-primary/15 text-primary ring-1 ring-primary'
                : 'bg-surface-lighter text-text-muted hover:bg-surface-lighter/80'
            )}
          >
            <span>{sound.icon}</span>
            <span>{sound.label}</span>
          </button>
        ))}
      </div>

      {/* Volume Slider */}
      <div className="flex items-center gap-3">
        <VolumeX size={14} className="text-text-muted flex-shrink-0" />
        <input
          type="range"
          min="0"
          max="100"
          value={muted ? 0 : volume}
          onChange={(e) => {
            setVolume(Number(e.target.value))
            if (muted) setMuted(false)
          }}
          aria-label="音量控制"
          className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-125"
          style={{
            background: `linear-gradient(to right, var(--color-primary) ${muted ? 0 : volume}%, var(--color-surface-lighter) ${muted ? 0 : volume}%)`,
          }}
        />
        <Volume2 size={14} className="text-text-muted flex-shrink-0" />
        <span className="text-[10px] text-text-muted w-6 text-right">{muted ? 0 : volume}</span>
      </div>
    </div>
  )
}
