export function formatGreetingTitle(greetingText: string, userName?: string): string {
  const name = userName?.trim()
  return name ? `${greetingText}，${name}` : greetingText
}
