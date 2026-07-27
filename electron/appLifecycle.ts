export function shouldQuitForExistingInstance(hasSingleInstanceLock: boolean): boolean {
  return !hasSingleInstanceLock
}
