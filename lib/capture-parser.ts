export interface ParsedCapture {
  title: string;
  urgent: boolean;
  important: boolean;
  tags: string[];
}

const TAG_PATTERN = /(^|\s)#([a-z0-9_-]+)/gi;
const DOUBLE_BANG = /(^|\s)!!(\s|$)/g;
const SINGLE_BANG = /(^|\s)!(\s|$)/g;
const STAR = /(^|\s)\*(\s|$)/g;

export function parseCapture(input: string): ParsedCapture {
  let working = input;
  const tags: string[] = [];

  // Extract tags
  working = working.replace(TAG_PATTERN, (_match, lead: string, tag: string) => {
    tags.push(tag.toLowerCase());
    return lead;
  });

  let urgent = false;
  let important = false;

  // Check for !! (reset lastIndex to avoid state issues with g flag)
  DOUBLE_BANG.lastIndex = 0;
  if (DOUBLE_BANG.test(working)) {
    urgent = true;
    important = true;
    DOUBLE_BANG.lastIndex = 0;
    working = working.replace(DOUBLE_BANG, "$1$2");
  }

  // Check for single ! (reset lastIndex)
  SINGLE_BANG.lastIndex = 0;
  if (SINGLE_BANG.test(working)) {
    urgent = true;
    SINGLE_BANG.lastIndex = 0;
    working = working.replace(SINGLE_BANG, "$1$2");
  }

  // Check for * (reset lastIndex)
  STAR.lastIndex = 0;
  if (STAR.test(working)) {
    important = true;
    STAR.lastIndex = 0;
    working = working.replace(STAR, "$1$2");
  }

  // Collapse whitespace and trim
  const title = working.replace(/\s+/g, " ").trim();

  return { title, urgent, important, tags };
}
