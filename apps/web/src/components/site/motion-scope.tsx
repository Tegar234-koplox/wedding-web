"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, type ReactNode } from "react";

export function MotionScope({ children }: { children: ReactNode }) {
  const scope = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useLayoutEffect(() => {
    if (
      !scope.current ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    let disposed = false;
    let cleanup: () => void = () => undefined;
    let refreshFrame: number | undefined;

    void Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(
      ([gsapModule, scrollTriggerModule]) => {
        if (disposed || !scope.current) {
          return;
        }

        const gsap = gsapModule.default;
        const ScrollTrigger = scrollTriggerModule.ScrollTrigger;
        gsap.registerPlugin(ScrollTrigger);

        const context = gsap.context(() => {
          const hero = scope.current?.querySelector("[data-hero]");

          if (hero) {
            gsap.from("[data-hero-line]", {
              yPercent: 115,
              opacity: 0,
              duration: 1.15,
              stagger: 0.12,
              ease: "power4.out",
            });

            gsap.from("[data-hero-detail]", {
              y: 24,
              opacity: 0,
              duration: 0.8,
              delay: 0.55,
              stagger: 0.1,
              ease: "power3.out",
            });

            gsap.to("[data-hero-image]", {
              yPercent: 8,
              ease: "none",
              scrollTrigger: {
                trigger: "[data-hero]",
                start: "top top",
                end: "bottom top",
                scrub: 0.7,
              },
            });
          }

          const explicitReveals =
            gsap.utils.toArray<HTMLElement>("[data-reveal]");
          const explicitSet = new Set(explicitReveals);
          const automaticReveals = gsap.utils
            .toArray<HTMLElement>(
              [
                "main h1",
                "main h2",
                "main h3",
                "main p",
                "main li",
                "main blockquote",
                "main article",
                "main img",
                "main a",
                "main button",
                "footer p",
                "footer a",
              ].join(","),
            )
            .filter((element) => {
              if (
                element.closest("[data-hero]") ||
                element.closest("[data-reveal]") ||
                element.closest("[data-invitation-motion]")
              ) {
                return false;
              }

              if (
                element.matches("article") &&
                element.querySelector("h1, h2, h3, p, li, a, button")
              ) {
                return false;
              }

              return !Array.from(explicitSet).some((explicit) =>
                explicit.contains(element),
              );
            });

          explicitReveals.forEach((element) => {
            gsap.from(element, {
              y: 54,
              opacity: 0,
              duration: 0.9,
              ease: "power3.out",
              scrollTrigger: {
                trigger: element,
                start: "top 88%",
                once: true,
              },
            });
          });

          automaticReveals.forEach((element, index) => {
            const isMedia = element.matches("img");
            gsap.from(element, {
              y: isMedia ? 0 : 28,
              opacity: 0,
              duration: isMedia ? 1 : 0.72,
              delay: Math.min((index % 4) * 0.035, 0.105),
              ease: "power2.out",
              scrollTrigger: {
                trigger: element,
                start: "top 92%",
                once: true,
              },
            });
          });

          gsap.utils
            .toArray<HTMLElement>("[data-parallax]")
            .forEach((element) => {
              gsap.to(element, {
                yPercent: -7,
                ease: "none",
                scrollTrigger: {
                  trigger: element.parentElement,
                  start: "top bottom",
                  end: "bottom top",
                  scrub: 0.8,
                },
              });
            });
        }, scope);

        refreshFrame = window.requestAnimationFrame(() => {
          if (!disposed) {
            ScrollTrigger.refresh();
          }
        });

        cleanup = () => {
          if (refreshFrame !== undefined) {
            window.cancelAnimationFrame(refreshFrame);
          }
          context.revert();
        };
      },
    );

    return () => {
      disposed = true;
      cleanup();
    };
  }, [pathname]);

  return <div ref={scope}>{children}</div>;
}
