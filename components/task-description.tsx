import { getDescriptionSegments, type DescriptionSegment } from "@/lib/task-links";
import { cn } from "@/lib/utils";

interface TaskDescriptionProps {
  description: string;
  className?: string;
}

// Segments partition the description left-to-right and never reorder, so each
// segment's cumulative character offset is a stable, content-derived key.
function segmentKeys(segments: DescriptionSegment[]): string[] {
  const keys: string[] = [];
  let offset = 0;
  for (const segment of segments) {
    keys.push(`${offset}-${segment.type}`);
    offset += segment.text.length;
  }
  return keys;
}

export function TaskDescription({ description, className }: TaskDescriptionProps) {
  const segments = getDescriptionSegments(description);
  const keys = segmentKeys(segments);

  return (
    <span className={cn("break-words", className)}>
      {segments.map((segment, index) => {
        const key = keys[index];

        if (segment.type === "text") {
          return <span key={key}>{segment.text}</span>;
        }

        return (
          <a
            key={key}
            href={segment.href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-accent underline underline-offset-2 hover:text-accent-hover"
            onClick={(event) => event.stopPropagation()}
          >
            {segment.text}
          </a>
        );
      })}
    </span>
  );
}
