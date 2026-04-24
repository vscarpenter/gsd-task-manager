import { getDescriptionSegments } from "@/lib/task-links";
import { cn } from "@/lib/utils";

interface TaskDescriptionProps {
  description: string;
  className?: string;
}

export function TaskDescription({ description, className }: TaskDescriptionProps) {
  const segments = getDescriptionSegments(description);

  return (
    <span className={cn("break-words", className)}>
      {segments.map((segment, index) => {
        if (segment.type === "text") {
          return <span key={index}>{segment.text}</span>;
        }

        return (
          <a
            key={index}
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
