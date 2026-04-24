export type DescriptionSegment =
  | { type: "text"; text: string }
  | { type: "link"; text: string; href: string };

const URL_CANDIDATE_PATTERN = /\bhttps?:\/\/[^\s<>"'`{}|\\^]+/giu;
const TRAILING_URL_PUNCTUATION_PATTERN = /[),.!?;:]+$/u;
const MAX_URL_LENGTH = 2048;
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

export function sanitizeHttpUrl(candidate: string): string | null {
  const value = candidate.trim();

  if (
    value.length === 0 ||
    value.length > MAX_URL_LENGTH ||
    /[\u0000-\u001F\u007F\s]/u.test(value)
  ) {
    return null;
  }

  try {
    const url = new URL(value);

    if (!ALLOWED_PROTOCOLS.has(url.protocol.toLowerCase())) {
      return null;
    }

    if (!url.hostname || url.username || url.password) {
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
}

export function getDescriptionSegments(description: string): DescriptionSegment[] {
  const segments: DescriptionSegment[] = [];
  let lastIndex = 0;
  const pushText = (text: string) => {
    if (!text) {
      return;
    }
    const previous = segments.at(-1);
    if (previous?.type === "text") {
      previous.text += text;
      return;
    }
    segments.push({ type: "text", text });
  };

  for (const match of description.matchAll(URL_CANDIDATE_PATTERN)) {
    const rawMatch = match[0];
    const matchIndex = match.index ?? 0;
    const trimmedCandidate = rawMatch.replace(TRAILING_URL_PUNCTUATION_PATTERN, "");
    const trailingText = rawMatch.slice(trimmedCandidate.length);
    const href = sanitizeHttpUrl(trimmedCandidate);

    if (!href) {
      continue;
    }

    if (matchIndex > lastIndex) {
      pushText(description.slice(lastIndex, matchIndex));
    }

    segments.push({ type: "link", text: trimmedCandidate, href });
    pushText(trailingText);
    lastIndex = matchIndex + rawMatch.length;
  }

  if (lastIndex < description.length) {
    pushText(description.slice(lastIndex));
  }

  return segments.length > 0 ? segments : [{ type: "text", text: description }];
}
