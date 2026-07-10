import { MoveUpRight } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import styles from "./bespoke-link.module.css";

type BespokeLinkProps = {
  children: ReactNode;
  external?: boolean;
  href: string;
};

export function BespokeLink({
  children,
  external = false,
  href,
}: BespokeLinkProps) {
  const content = (
    <>
      <span>{children}</span>
      <MoveUpRight aria-hidden="true" size={15} />
    </>
  );

  if (external) {
    return (
      <a
        className={styles.link}
        href={href}
        rel="noopener noreferrer"
        target="_blank"
      >
        {content}
      </a>
    );
  }

  return (
    <Link className={styles.link} href={href as Route}>
      {content}
    </Link>
  );
}
