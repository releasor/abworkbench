import React from 'react';
import { extractFreeText } from '../fuzzySearch';

const MAX_CACHE_SIZE = 50;
const regexCache = new Map<string, { split: RegExp; test: RegExp }>();

function getRegexes(query: string) {
  let cached = regexCache.get(query);
  if (!cached) {
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    cached = {
      split: new RegExp(`(${escapedQuery})`, 'gi'),
      test: new RegExp(`^${escapedQuery}$`, 'i'),
    };
    // LRU eviction: delete oldest entry when at capacity
    if (regexCache.size >= MAX_CACHE_SIZE) {
      const firstKey = regexCache.keys().next().value;
      if (firstKey !== undefined) regexCache.delete(firstKey);
    }
    regexCache.set(query, cached);
  }
  return cached;
}

export function highlightText(text: string, query: string): React.ReactNode {
  if (!query || !text) return text;

  // Only highlight the free text portion, not structured prefixes like p:high or #tag
  const freeText = extractFreeText(query);
  if (!freeText) return text;

  const { split, test } = getRegexes(freeText);
  const parts = text.split(split);

  return parts.map((part, i) =>
    test.test(part) ? (
      <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded">
        {part}
      </mark>
    ) : (
      part
    )
  );
}
