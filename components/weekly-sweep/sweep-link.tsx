import Link from "next/link";
import { ROUTES } from "@/lib/routes";

/** The Review page's way into the sweep. Always shown, whether or not there are cards. */
export function SweepLink() {
  return (
    <p className="text-small text-foreground-muted">
      <Link href={ROUTES.SWEEP} className="touch-target inline-flex items-center font-medium text-accent underline underline-offset-4">
        Start weekly sweep
      </Link>
    </p>
  );
}
