"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Play the decorative scene once, when it comes into view on phones as well as desktops. */
export function LandingPreview({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    if (!("IntersectionObserver" in window)) {
      setRevealed(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`hero-art${revealed ? " hero-art-revealed" : ""}`} aria-hidden="true">
      {children}
    </div>
  );
}
