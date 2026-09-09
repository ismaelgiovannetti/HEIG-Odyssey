"use client";

import { useId, type CSSProperties } from "react";
import styles from "./shiny-sparkles.module.css";

interface ShinySparklesProps {
  active?: boolean;
  className?: string;
}

interface ParticleConfig {
  dx: string;
  dy: string;
  rot: string;
  size: number;
  color: string;
  delay: string;
}

const PARTICLES: readonly ParticleConfig[] = [
  {
    dx: "0px",
    dy: "-72px",
    rot: "45deg",
    size: 24,
    color: "#ffe066",
    delay: "0ms",
  },
  {
    dx: "55px",
    dy: "-50px",
    rot: "70deg",
    size: 18,
    color: "#ffffff",
    delay: "30ms",
  },
  {
    dx: "72px",
    dy: "0px",
    rot: "90deg",
    size: 22,
    color: "#70d6ff",
    delay: "50ms",
  },
  {
    dx: "52px",
    dy: "52px",
    rot: "110deg",
    size: 16,
    color: "#ffe066",
    delay: "20ms",
  },
  {
    dx: "0px",
    dy: "70px",
    rot: "135deg",
    size: 20,
    color: "#ff99c8",
    delay: "60ms",
  },
  {
    dx: "-52px",
    dy: "52px",
    rot: "160deg",
    size: 18,
    color: "#ffffff",
    delay: "40ms",
  },
  {
    dx: "-72px",
    dy: "0px",
    rot: "180deg",
    size: 24,
    color: "#ffe066",
    delay: "10ms",
  },
  {
    dx: "-55px",
    dy: "-50px",
    rot: "210deg",
    size: 17,
    color: "#70d6ff",
    delay: "50ms",
  },
  {
    dx: "28px",
    dy: "-30px",
    rot: "35deg",
    size: 14,
    color: "#ffd700",
    delay: "80ms",
  },
  {
    dx: "-28px",
    dy: "-28px",
    rot: "125deg",
    size: 15,
    color: "#ffffff",
    delay: "70ms",
  },
  {
    dx: "30px",
    dy: "28px",
    rot: "215deg",
    size: 13,
    color: "#ff99c8",
    delay: "90ms",
  },
  {
    dx: "-30px",
    dy: "30px",
    rot: "305deg",
    size: 14,
    color: "#ffe066",
    delay: "60ms",
  },
];

/**
 * Animation étincelante spectaculaire affichée lorsqu'un Pokémon chromatique
 * (Shiny) entre au combat ou éclot d'un œuf.
 */
export function ShinySparkles({
  active = true,
  className = "",
}: Readonly<ShinySparklesProps>) {
  const baseId = useId();
  if (!active) return null;

  return (
    <div
      key={baseId}
      className={`${styles.sparkleContainer} ${className}`.trim()}
      aria-hidden="true"
    >
      <div className={styles.sparkleGlow} />
      {PARTICLES.map((p, idx) => {
        const style: CSSProperties & Record<string, string> = {
          "--dx": p.dx,
          "--dy": p.dy,
          "--rot": p.rot,
          color: p.color,
          animationDelay: p.delay,
        };

        return (
          <svg
            key={idx}
            className={styles.sparkleStar}
            style={style}
            width={p.size}
            height={p.size}
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            {/* Étoile à 4 branches effilées rétro */}
            <path d="M12 0 L14.5 9.5 L24 12 L14.5 14.5 L12 24 L9.5 14.5 L0 12 L9.5 9.5 Z" />
          </svg>
        );
      })}
    </div>
  );
}
