"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

export function MotionScope({ children }: { children: ReactNode }) {
  const scope = useRef<HTMLDivElement>(null);

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

          gsap.utils
            .toArray<HTMLElement>("[data-reveal]")
            .forEach((element) => {
              gsap.from(element, {
                y: 54,
                opacity: 0,
                duration: 0.9,
                ease: "power3.out",
                scrollTrigger: {
                  trigger: element,
                  start: "top 86%",
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
  }, []);

  return <div ref={scope}>{children}</div>;
}
