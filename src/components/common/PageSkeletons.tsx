import { memo } from 'react'

function Block({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />
}

function CardSkeleton() {
  return (
    <div className="glass-card p-4 space-y-3">
      <Block className="h-5 w-2/5" />
      <Block className="h-4 w-4/5" />
      <Block className="h-4 w-3/5" />
    </div>
  )
}

export const DashboardSkeleton = memo(function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Greeting */}
      <Block className="h-8 w-1/3" />
      <Block className="h-5 w-1/2" />

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="glass-card p-4 space-y-2">
            <Block className="h-4 w-1/2" />
            <Block className="h-8 w-2/3" />
          </div>
        ))}
      </div>

      {/* Chart area */}
      <div className="glass-card p-6">
        <Block className="h-5 w-1/4 mb-4" />
        <Block className="h-48 w-full" />
      </div>

      {/* Bottom cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  )
})

export const PomodoroSkeleton = memo(function PomodoroSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Timer circle */}
      <div className="flex justify-center">
        <Block className="w-48 h-48 rounded-full" />
      </div>

      {/* Controls */}
      <div className="flex justify-center gap-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Block key={i} className="w-10 h-10 rounded-full" />
        ))}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="glass-card p-3 space-y-2">
            <Block className="h-4 w-1/2" />
            <Block className="h-6 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  )
})

export const NotesSkeleton = memo(function NotesSkeleton() {
  return (
    <div className="space-y-4 animate-fade-in">
      {/* Search */}
      <Block className="h-10 w-full" />

      {/* Note cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="glass-card p-4 space-y-3">
            <Block className="h-5 w-3/4" />
            <Block className="h-4 w-full" />
            <Block className="h-4 w-2/3" />
            <Block className="h-3 w-1/3 mt-2" />
          </div>
        ))}
      </div>
    </div>
  )
})

export const WeatherSkeleton = memo(function WeatherSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Current weather card */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-4">
          <Block className="w-16 h-16 rounded-full" />
          <div className="space-y-2 flex-1">
            <Block className="h-8 w-1/3" />
            <Block className="h-4 w-1/2" />
          </div>
        </div>
      </div>

      {/* Forecast row */}
      <div className="grid grid-cols-3 md:grid-cols-7 gap-3">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="glass-card p-3 space-y-2 text-center">
            <Block className="h-4 w-8 mx-auto" />
            <Block className="w-8 h-8 rounded-full mx-auto" />
            <Block className="h-4 w-12 mx-auto" />
          </div>
        ))}
      </div>
    </div>
  )
})

export const HabitsSkeleton = memo(function HabitsSkeleton() {
  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center">
        <Block className="h-6 w-24" />
        <Block className="h-9 w-20" />
      </div>

      {/* Habit rows */}
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="glass-card p-4">
          <div className="flex items-center gap-3 mb-3">
            <Block className="w-8 h-8 rounded-full" />
            <Block className="h-5 w-1/3" />
          </div>
          {/* Week dots */}
          <div className="flex gap-2">
            {Array.from({ length: 7 }, (_, j) => (
              <Block key={j} className="w-8 h-8 rounded-full" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
})

export const SettingsSkeleton = memo(function SettingsSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="glass-card p-6 space-y-4">
          <Block className="h-5 w-1/4" />
          {Array.from({ length: 3 }, (_, j) => (
            <div key={j} className="flex items-center justify-between">
              <Block className="h-4 w-1/3" />
              <Block className="h-8 w-24" />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
})

export const TaskFlowSkeleton = memo(function TaskFlowSkeleton() {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Block className="h-9 w-16 rounded-lg" />
          <Block className="h-9 w-16 rounded-lg" />
          <Block className="h-9 w-16 rounded-lg" />
        </div>
        <Block className="h-9 w-24 rounded-lg" />
      </div>
      <Block className="h-10 w-full rounded-lg" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="glass-card p-4 space-y-3">
            <Block className="h-5 w-1/3" />
            {Array.from({ length: 3 }, (_, j) => (
              <CardSkeleton key={j} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
})

export const HotlistSkeleton = memo(function HotlistSkeleton() {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <Block className="h-8 w-40" />
        <Block className="h-8 w-20 rounded-full" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="glass-card p-4 space-y-2 min-h-[320px]">
            <Block className="h-5 w-2/5" />
            {Array.from({ length: 8 }, (_, j) => (
              <Block key={j} className="h-4 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
})
