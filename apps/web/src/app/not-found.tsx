import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-6 text-center">
      <div>
        <p className="text-sm uppercase tracking-[0.25em] text-[var(--color-gold)]">
          404
        </p>
        <h1 className="mt-5 font-serif text-5xl">Page not found</h1>
        <Link
          className="mt-8 inline-block underline underline-offset-8"
          href="/id"
        >
          Return home
        </Link>
      </div>
    </main>
  );
}
