export function getPeriod(hour: number): string {
  return hour < 12 ? '上午' : hour < 18 ? '下午' : '晚上'
}

export function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, '[代码]')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/!\[.*?\]\(.*?\)/g, '[图片]')
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')
    .replace(/^- \[x\] /gm, '✓ ')
    .replace(/^- \[ \] /gm, '○ ')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/#{1,6}\s*/g, '')
    .replace(/^>\s*/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/---+/g, '')
    .replace(/\n{2,}/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
