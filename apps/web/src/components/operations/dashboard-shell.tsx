import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";

type DashboardShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  nav: Array<{ href: Route; label: string }>;
  children: ReactNode;
};

export function DashboardShell({
  eyebrow,
  title,
  description,
  nav,
  children,
}: DashboardShellProps) {
  return (
    <main className="min-h-screen bg-[#11110f] text-[var(--color-ink)]">
      <header className="border-b border-white/10 px-[var(--space-gutter)] py-5">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <Link className="font-serif text-xl" href="/id">
            Niskala<span className="text-[var(--color-gold)]">.</span>
          </Link>
          <nav className="flex flex-wrap gap-5 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-white/55">
            {nav.map((item) => (
              <Link
                className="transition hover:text-[var(--color-gold)]"
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <section className="px-[var(--space-gutter)] py-14 md:py-20">
        <p className="text-[0.65rem] uppercase tracking-[0.24em] text-[var(--color-gold)]">
          {eyebrow}
        </p>
        <div className="mt-7 grid gap-8 lg:grid-cols-[1fr_0.75fr] lg:items-end">
          <h1 className="max-w-5xl font-serif text-[clamp(4rem,9vw,9rem)] leading-[0.82]">
            {title}
          </h1>
          <p className="max-w-md text-sm leading-7 text-[var(--color-muted)]">
            {description}
          </p>
        </div>
      </section>

      <section className="px-[var(--space-gutter)] pb-20">{children}</section>
    </main>
  );
}

export function OperationsGrid({
  items,
}: {
  items: Array<{ title: string; metric: string; body: string }>;
}) {
  return (
    <div className="grid gap-px bg-white/12 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <article className="min-h-56 bg-[#181815] p-6" key={item.title}>
          <p className="text-[0.62rem] uppercase tracking-[0.2em] text-[var(--color-gold)]">
            {item.title}
          </p>
          <p className="mt-10 font-serif text-5xl">{item.metric}</p>
          <p className="mt-5 text-sm leading-6 text-white/58">{item.body}</p>
        </article>
      ))}
    </div>
  );
}

export function WorkflowList({
  steps,
}: {
  steps: Array<{ label: string; detail: string }>;
}) {
  return (
    <ol className="mt-12 border-t border-white/12">
      {steps.map((step, index) => (
        <li
          className="grid gap-4 border-b border-white/12 py-6 md:grid-cols-[5rem_0.7fr_1fr]"
          key={step.label}
        >
          <span className="text-xs text-[var(--color-gold)]">
            {String(index + 1).padStart(2, "0")}
          </span>
          <h2 className="font-serif text-2xl">{step.label}</h2>
          <p className="max-w-2xl text-sm leading-6 text-white/58">
            {step.detail}
          </p>
        </li>
      ))}
    </ol>
  );
}
