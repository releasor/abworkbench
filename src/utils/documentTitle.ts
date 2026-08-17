/** Who currently owns `document.title` — prevents the shell and pomodoro from fighting. */
let pomodoroOwnsTitle = false

export function setPomodoroTitleActive(active: boolean): void {
  pomodoroOwnsTitle = active
}

export function isPomodoroTitleActive(): boolean {
  return pomodoroOwnsTitle
}
