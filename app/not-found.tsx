import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4">
      <div className="text-center space-y-3">
        <p aria-hidden="true" className="text-display text-muted-foreground">404</p>
        <h1 className="text-h2 font-semibold">Page not found</h1>
        <p className="text-muted-foreground max-w-md">
          The page you&rsquo;re looking for doesn&rsquo;t exist or has been moved.
        </p>
      </div>
      <Link href="/" className="btn btn-primary touch-target focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background">
        Return to task manager
      </Link>
    </main>
  );
}
