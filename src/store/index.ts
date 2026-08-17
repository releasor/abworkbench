import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { generateId } from '../utils/id'

export type Priority = 'low' | 'medium' | 'high' | 'urgent'
export type ThemeMode = 'dark' | 'light'
export type WorkspaceMode = 'focus' | 'night' | 'minimal' | 'dashboard'

export interface Todo {
  id: string
  text: string
  completed: boolean
  priority: Priority
  createdAt: number
  completedAt?: number
  dueDate?: string // YYYY-MM-DD
}

export interface NoteVersion {
  content: string
  savedAt: number
}

export interface NoteFolder {
  id: string
  name: string
  color: string
}

export interface Note {
  id: string
  title: string
  content: string
  createdAt: number
  updatedAt: number
  color: string
  pinned?: boolean
  tags?: string[]
  versions?: NoteVersion[]
  folderId?: string
}

export interface PomodoroSession {
  id: string
  startedAt: number
  endedAt: number
  type: 'work' | 'break'
  completed: boolean
  taskId?: string
}

export interface Habit {
  id: string
  name: string
  icon: string
  color: string
  completedDates: string[] // ISO date strings YYYY-MM-DD
  createdAt: number
}

interface AppState {
  // User
  userName: string
  setUserName: (name: string) => void

  // Sidebar
  sidebarCollapsed: boolean
  toggleSidebar: () => void

  // Todos
  todos: Todo[]
  addTodo: (text: string, priority?: Priority, dueDate?: string) => void
  toggleTodo: (id: string) => void
  deleteTodo: (id: string) => void
  clearCompletedTodos: () => void
  updateTodo: (id: string, updates: Partial<Pick<Todo, 'text' | 'priority' | 'dueDate'>>) => void
  duplicateTodo: (id: string) => void

  // Notes
  notes: Note[]
  noteFolders: NoteFolder[]
  activeNoteId: string | null
  addNote: () => void
  duplicateNote: (id: string) => void
  updateNote: (id: string, updates: Partial<Pick<Note, 'title' | 'content' | 'color' | 'tags' | 'folderId'>>) => void
  togglePinNote: (id: string) => void
  deleteNote: (id: string) => void
  setActiveNote: (id: string | null) => void
  addNoteFolder: (name: string, color: string) => void
  updateNoteFolder: (id: string, updates: Partial<Pick<NoteFolder, 'name' | 'color'>>) => void
  deleteNoteFolder: (id: string) => void

  // Pomodoro
  pomodoroSessions: PomodoroSession[]
  addPomodoroSession: (session: Omit<PomodoroSession, 'id'>) => void
  dailyPomodoroGoal: number
  setDailyPomodoroGoal: (goal: number) => void
  pomodoroWorkDuration: number
  pomodoroShortBreakDuration: number
  pomodoroLongBreakDuration: number
  setPomodoroDurations: (work: number, shortBreak: number, longBreak: number) => void
  pomodoroSoundEnabled: boolean
  setPomodoroSoundEnabled: (enabled: boolean) => void
  pomodoroAutoStartBreaks: boolean
  setPomodoroAutoStartBreaks: (enabled: boolean) => void
  pomodoroAutoStartWork: boolean
  setPomodoroAutoStartWork: (enabled: boolean) => void

  // Theme
  accentColor: string
  setAccentColor: (color: string) => void
  themeMode: ThemeMode
  setThemeMode: (mode: ThemeMode) => void
  toggleThemeMode: () => void
  workspaceMode: WorkspaceMode
  setWorkspaceMode: (mode: WorkspaceMode) => void

  // Weather
  weatherCity: string
  setWeatherCity: (city: string) => void
  weatherAutoLocate: boolean
  setWeatherAutoLocate: (enabled: boolean) => void

  // Habits
  habits: Habit[]
  addHabit: (name: string, icon: string, color: string) => void
  toggleHabitDate: (habitId: string, date: string) => void
  deleteHabit: (id: string) => void
  updateHabit: (id: string, updates: Partial<Pick<Habit, 'name' | 'icon' | 'color'>>) => void
}

const NOTE_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6']

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      // User
      userName: '',
      setUserName: (name) => set({ userName: name }),

      // Sidebar
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      // Todos
      todos: [],
      addTodo: (text, priority = 'medium', dueDate) =>
        set((s) => ({
          todos: [
            ...s.todos,
            { id: generateId(), text, completed: false, priority, createdAt: Date.now(), dueDate },
          ],
        })),
      toggleTodo: (id) =>
        set((s) => ({
          todos: s.todos.map((t) =>
            t.id === id
              ? { ...t, completed: !t.completed, completedAt: !t.completed ? Date.now() : undefined }
              : t
          ),
        })),
      deleteTodo: (id) => set((s) => ({ todos: s.todos.filter((t) => t.id !== id) })),
      clearCompletedTodos: () => set((s) => ({ todos: s.todos.filter((t) => !t.completed) })),
      updateTodo: (id, updates) =>
        set((s) => ({
          todos: s.todos.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        })),
      duplicateTodo: (id) => {
        const todo = useStore.getState().todos.find((t) => t.id === id)
        if (!todo) return
        const dup: Todo = {
          ...todo,
          id: generateId(),
          text: `${todo.text} (副本)`,
          completed: false,
          completedAt: undefined,
          createdAt: Date.now(),
        }
        set((s) => ({ todos: [dup, ...s.todos] }))
      },

      // Notes
      notes: [],
      noteFolders: [],
      activeNoteId: null,
      addNote: () => {
        const newNote: Note = {
          id: generateId(),
          title: '新笔记',
          content: '',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          color: NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)],
        }
        set((s) => ({ notes: [newNote, ...s.notes], activeNoteId: newNote.id }))
      },
      duplicateNote: (id) => {
        const note = useStore.getState().notes.find((n) => n.id === id)
        if (!note) return
        const dup: Note = {
          ...note,
          id: generateId(),
          title: `${note.title} (副本)`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        set((s) => ({ notes: [dup, ...s.notes], activeNoteId: dup.id }))
      },
      updateNote: (id, updates) =>
        set((s) => ({
          notes: s.notes.map((n) => {
            if (n.id !== id) return n
            const next = { ...n, ...updates, updatedAt: Date.now() }
            // Save version when content changes (keep last 20)
            if (updates.content !== undefined && updates.content !== n.content && n.content.length > 0) {
              const versions = [...(n.versions || []), { content: n.content, savedAt: Date.now() }].slice(-20)
              next.versions = versions
            }
            return next
          }),
        })),
      togglePinNote: (id) =>
        set((s) => ({
          notes: s.notes.map((n) =>
            n.id === id ? { ...n, pinned: !n.pinned } : n
          ),
        })),
      deleteNote: (id) =>
        set((s) => ({
          notes: s.notes.filter((n) => n.id !== id),
          activeNoteId: s.activeNoteId === id ? null : s.activeNoteId,
        })),
      setActiveNote: (id) => set({ activeNoteId: id }),
      addNoteFolder: (name, color) =>
        set((s) => ({
          noteFolders: [...s.noteFolders, { id: generateId(), name, color }],
        })),
      updateNoteFolder: (id, updates) =>
        set((s) => ({
          noteFolders: s.noteFolders.map((f) => (f.id === id ? { ...f, ...updates } : f)),
        })),
      deleteNoteFolder: (id) =>
        set((s) => ({
          noteFolders: s.noteFolders.filter((f) => f.id !== id),
          notes: s.notes.map((n) => (n.folderId === id ? { ...n, folderId: undefined } : n)),
        })),

      // Pomodoro
      pomodoroSessions: [],
      addPomodoroSession: (session) =>
        set((s) => ({
          pomodoroSessions: [...s.pomodoroSessions, { ...session, id: generateId() }].slice(-500),
        })),
      dailyPomodoroGoal: 8,
      setDailyPomodoroGoal: (goal) => set({ dailyPomodoroGoal: goal }),
      pomodoroWorkDuration: 25,
      pomodoroShortBreakDuration: 5,
      pomodoroLongBreakDuration: 15,
      setPomodoroDurations: (work, shortBreak, longBreak) =>
        set({ pomodoroWorkDuration: work, pomodoroShortBreakDuration: shortBreak, pomodoroLongBreakDuration: longBreak }),
      pomodoroSoundEnabled: true,
      setPomodoroSoundEnabled: (enabled) => set({ pomodoroSoundEnabled: enabled }),
      pomodoroAutoStartBreaks: true,
      setPomodoroAutoStartBreaks: (enabled) => set({ pomodoroAutoStartBreaks: enabled }),
      pomodoroAutoStartWork: false,
      setPomodoroAutoStartWork: (enabled) => set({ pomodoroAutoStartWork: enabled }),

      // Theme
      accentColor: '#3b82f6',
      setAccentColor: (color) => set({ accentColor: color }),
      themeMode: 'dark',
      setThemeMode: (mode) => set({ themeMode: mode }),
      toggleThemeMode: () => set((s) => ({ themeMode: s.themeMode === 'dark' ? 'light' : 'dark' })),
      workspaceMode: 'focus',
      setWorkspaceMode: (mode) => set({ workspaceMode: mode }),

      // Weather
      weatherCity: '北京',
      setWeatherCity: (city) => set({ weatherCity: city }),
      weatherAutoLocate: true,
      setWeatherAutoLocate: (enabled) => set({ weatherAutoLocate: enabled }),

      // Habits
      habits: [],
      addHabit: (name, icon, color) =>
        set((s) => ({
          habits: [
            ...s.habits,
            { id: generateId(), name, icon, color, completedDates: [], createdAt: Date.now() },
          ],
        })),
      toggleHabitDate: (habitId, date) =>
        set((s) => ({
          habits: s.habits.map((h) => {
            if (h.id !== habitId) return h
            const idx = h.completedDates.indexOf(date)
            const dates = idx >= 0
              ? h.completedDates.toSpliced(idx, 1)
              : [...h.completedDates, date]
            return { ...h, completedDates: dates }
          }),
        })),
      deleteHabit: (id) => set((s) => ({ habits: s.habits.filter((h) => h.id !== id) })),
      updateHabit: (id, updates) =>
        set((s) => ({
          habits: s.habits.map((h) => (h.id === id ? { ...h, ...updates } : h)),
        })),
    }),
    {
      name: 'dashboard-storage',
      partialize: (state) => ({
        todos: state.todos,
        notes: state.notes,
        noteFolders: state.noteFolders,
        pomodoroSessions: state.pomodoroSessions,
        sidebarCollapsed: state.sidebarCollapsed,
        accentColor: state.accentColor,
        themeMode: state.themeMode,
        workspaceMode: state.workspaceMode,
        habits: state.habits,
        userName: state.userName,
        dailyPomodoroGoal: state.dailyPomodoroGoal,
        pomodoroWorkDuration: state.pomodoroWorkDuration,
        pomodoroShortBreakDuration: state.pomodoroShortBreakDuration,
        pomodoroLongBreakDuration: state.pomodoroLongBreakDuration,
        pomodoroSoundEnabled: state.pomodoroSoundEnabled,
        pomodoroAutoStartBreaks: state.pomodoroAutoStartBreaks,
        pomodoroAutoStartWork: state.pomodoroAutoStartWork,
        weatherCity: state.weatherCity,
        weatherAutoLocate: state.weatherAutoLocate,
      }),
    }
  )
)

// Cross-window note sync (e.g. stealth reader exports into dashboard-storage).
if (typeof window !== 'undefined') {
  try {
    const channel = new BroadcastChannel('abwb-store')
    channel.onmessage = (event) => {
      const note = event.data?.note
      if (event.data?.type !== 'notes-upsert' || !note || typeof note !== 'object') return
      if (typeof note.id !== 'string') return
      useStore.setState((s) => ({
        notes: [note, ...s.notes.filter((n) => n.id !== note.id)],
      }))
    }
  } catch {
    // BroadcastChannel may be unavailable
  }
}
