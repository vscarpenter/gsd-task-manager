import { getDescriptionSegments } from "@/lib/task-links";
import { cn } from "@/lib/utils";

interface TaskDescriptionProps {
  description: string;
  className?: string;
}

export function TaskDescription({ description, className }: TaskDescriptionProps) {
  const segments = getDescriptionSegments(description);

  // Segments partition the description left-to-right and never reorder, so the
  // cumulative character offset of each segment is a stable, content-derived key.
  let offset = 0;

  return (
    <span className={cn("break-words", className)}>
      {segments.map((segment) => {
        const key = `${offset}-${segment.type}`;
        offset += segment.text.length;

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
