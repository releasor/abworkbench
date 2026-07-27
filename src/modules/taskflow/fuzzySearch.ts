/**
 * Shared fuzzy search utilities — usable on both client and server
 * without any DOM or framework dependencies.
 */

/**
 * Match `lowerQuery` (already lowercased) against `text`.
 * Returns true if query is a substring or every character appears in order.
 */
export function fuzzyMatchPrepared(lowerQuery: string, text: string): boolean {
  const t = text.toLowerCase();
  if (t.includes(lowerQuery)) return true;
  let qIndex = 0;
  for (let tIndex = 0; tIndex < t.length && qIndex < lowerQuery.length; tIndex++) {
    if (t[tIndex] === lowerQuery[qIndex]) qIndex++;
  }
  return qIndex === lowerQuery.length;
}

/**
 * Smart match: supports quoted exact-match ("phrase") and fuzzy matching.
 */
export function smartMatch(query: string, text: string): boolean {
  const trimmed = query.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    const exact = trimmed.slice(1, -1).toLowerCase();
    return text.toLowerCase().includes(exact);
  }
  return fuzzyMatchPrepared(query.toLowerCase(), text);
}

interface SearchableItem {
  title: string;
  description: string;
  tags: string[];
  category: string;
  status?: string;
  priority?: string;
  notes?: { content: string }[];
  subtasks?: { title: string }[];
}

// Precompiled regex for structured query prefixes: #tag, p:, s:, c:
const TAG_RE = /(?:^|\s)#(\S+)/gi;
const PRIORITY_RE = /(?:^|\s)p:(\S+)/gi;
const STATUS_RE = /(?:^|\s)s:(\S+)/gi;
const CATEGORY_RE = /(?:^|\s)c:(\S+)/gi;

interface ParsedQuery {
  tags: string[];
  priority: string | null;
  status: string | null;
  category: string | null;
  freeText: string;
}

// LRU cache for parsed queries — avoids re-parsing the same search string per filter pass
const PARSE_CACHE_MAX = 20;
const parseCache = new Map<string, ParsedQuery>();

function parseQuery(query: string): ParsedQuery {
  let cached = parseCache.get(query);
  if (cached) return cached;

  const tags: string[] = [];
  let priority: string | null = null;
  let status: string | null = null;
  let category: string | null = null;
  // Extract #tags
  TAG_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TAG_RE.exec(query)) !== null) tags.push(m[1].toLowerCase());

  // Extract p:priority
  PRIORITY_RE.lastIndex = 0;
  m = PRIORITY_RE.exec(query);
  if (m) { priority = m[1].toLowerCase(); }

  // Extract s:status
  STATUS_RE.lastIndex = 0;
  m = STATUS_RE.exec(query);
  if (m) { status = m[1].toLowerCase(); }

  // Extract c:category
  CATEGORY_RE.lastIndex = 0;
  m = CATEGORY_RE.exec(query);
  if (m) { category = m[1].toLowerCase(); }

  // Remove all structured prefixes from remaining text in one pass
  const remaining = query.replace(/(?:^|\s)(?:#|p:|s:|c:)\S+/g, ' ');

  cached = { tags, priority, status, category, freeText: remaining.trim() };
  if (parseCache.size >= PARSE_CACHE_MAX) {
    const firstKey = parseCache.keys().next().value;
    if (firstKey !== undefined) parseCache.delete(firstKey);
  }
  parseCache.set(query, cached);
  return cached;
}

/** Extract only the free-text portion of a query, stripping #tag, p:, s:, c: prefixes. Uses LRU-cached parse result. */
export function extractFreeText(query: string): string {
  return parseQuery(query).freeText;
}

// Status aliases for common shorthand
const STATUS_ALIASES: Record<string, string> = {
  'todo': 'todo', '待办': 'todo',
  'doing': 'in-progress', 'progress': 'in-progress', '进行': 'in-progress',
  'review': 'review', '审查': 'review',
  'done': 'done', '完成': 'done',
};

/**
 * Check if an item matches a search query.
 * Supports:
 *   - #tag — tag search (fuzzy)
 *   - p:high / p:urgent — priority filter (exact)
 *   - s:done / s:todo — status filter (exact, with aliases)
 *   - c:work — category filter (fuzzy on category name)
 *   - "phrase" — quoted exact substring match
 *   - plain text — fuzzy match across all fields
 *   - Combined: "p:high #frontend s:todo login" matches all conditions
 * categoryNameMap: Map<categoryId, lowercaseName>
 */
export function matchesSearchQuery(
  item: SearchableItem,
  query: string,
  categoryNameMap: { get(id: string): string | undefined }
): boolean {
  const raw = query.trim();
  if (!raw) return true;

  const { tags, priority, status, category, freeText } = parseQuery(raw);

  // Check tag filters
  for (const tagQ of tags) {
    let found = false;
    for (let j = 0; j < item.tags.length; j++) {
      if (fuzzyMatchPrepared(tagQ, item.tags[j].toLowerCase())) { found = true; break; }
    }
    if (!found) return false;
  }

  // Check priority filter
  if (priority && item.priority) {
    if (item.priority.toLowerCase() !== priority) return false;
  }

  // Check status filter (with alias support)
  if (status && item.status) {
    const mappedStatus = STATUS_ALIASES[status] || status;
    if (item.status.toLowerCase() !== mappedStatus) return false;
  }

  // Check category filter
  if (category) {
    const catName = categoryNameMap.get(item.category);
    if (!catName || !catName.includes(category)) return false;
  }

  // If no free text, all structured filters matched
  if (!freeText) return true;

  // Free text fuzzy match across all fields
  if (smartMatch(freeText, item.title) || smartMatch(freeText, item.description)) return true;

  for (let j = 0; j < item.tags.length; j++) {
    if (smartMatch(freeText, item.tags[j])) return true;
  }

  if (item.notes) {
    for (let j = 0; j < item.notes.length; j++) {
      if (smartMatch(freeText, item.notes[j].content)) return true;
    }
  }

  if (item.subtasks) {
    for (let j = 0; j < item.subtasks.length; j++) {
      if (smartMatch(freeText, item.subtasks[j].title)) return true;
    }
  }

  const catName = categoryNameMap.get(item.category);
  if (catName && smartMatch(freeText, catName)) return true;

  return false;
}
