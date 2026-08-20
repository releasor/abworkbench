import React from 'react';

/**
 * Parse simple markdown-like text into React elements.
 * Supports: bold (**text**), inline code (`code`), bullet lists (- item), line breaks.
 * Safe: renders as React elements, no HTML injection.
 */

// Precompiled regex patterns for inline markdown parsing
const CODE_RE = /^`([^`]+)`/;
const BOLD_RE = /^\*\*([^*]+)\*\*/;
const ITALIC_RE = /^\*([^*]+)\*/;
const SPECIAL_RE = /[`*]/;
const BULLET_RE = /^[-*]\s+(.+)$/;

function parseInline(text: string, baseKey: number): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = baseKey;

  while (remaining.length > 0) {
    const codeMatch = CODE_RE.exec(remaining);
    if (codeMatch) {
      parts.push(
        <code key={key++} className="px-1 py-0.5 bg-surface-lighter rounded text-xs font-mono">
          {codeMatch[1]}
        </code>
      );
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    const boldMatch = BOLD_RE.exec(remaining);
    if (boldMatch) {
      parts.push(<strong key={key++}>{boldMatch[1]}</strong>);
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    const italicMatch = ITALIC_RE.exec(remaining);
    if (italicMatch) {
      parts.push(<em key={key++}>{italicMatch[1]}</em>);
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    const nextSpecial = remaining.search(SPECIAL_RE);
    if (nextSpecial === -1) {
      parts.push(remaining);
      break;
    }

    if (nextSpecial > 0) {
      parts.push(remaining.slice(0, nextSpecial));
      remaining = remaining.slice(nextSpecial);
    } else {
      parts.push(remaining[0]);
      remaining = remaining.slice(1);
    }
  }

  return parts;
}

interface MarkdownViewProps {
  content: string;
  className?: string;
}

export function MarkdownView({ content, className }: MarkdownViewProps) {
  if (!content) return null;

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let key = 0;
  let listItems: React.ReactNode[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={key++} className="my-1 ml-4 list-disc space-y-0.5">
          {listItems}
        </ul>
      );
      listItems = [];
    }
  };

  for (const line of lines) {
    const bulletMatch = BULLET_RE.exec(line);
    if (bulletMatch) {
      listItems.push(<li key={key++}>{parseInline(bulletMatch[1], key * 1000)}</li>);
    } else {
      flushList();
      if (line.trim() === '') {
        elements.push(<div key={key++} className="h-2" />);
      } else {
        elements.push(
          <p key={key++} className="leading-relaxed">
            {parseInline(line, key * 1000)}
          </p>
        );
      }
    }
  }
  flushList();

  return (
    <div className={className}>
      {elements}
    </div>
  );
}
