/** Count completed subtasks in an array. */
export function countCompleted(subtasks: { completed: boolean }[]): number {
  let count = 0;
  for (let i = 0; i < subtasks.length; i++) {
    if (subtasks[i].completed) count++;
  }
  return count;
}
