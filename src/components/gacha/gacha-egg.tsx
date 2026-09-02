"use client";

import { useId } from "react";
import styles from "./gacha-shop.module.css";

interface GachaEggProps {
  className?: string;
}

/** Œuf Pokémon original affiché pendant la scène d'éclosion. */
export function GachaEgg({ className = "" }: Readonly<GachaEggProps>) {
  const gradientPrefix = useId().replaceAll(":", "");
  const shellGradientId = `${gradientPrefix}-egg-shell`;
  const spotGradientId = `${gradientPrefix}-egg-spot`;
  const shadowGradientId = `${gradientPrefix}-egg-shadow`;

  return (
    <svg
      className={`${styles.eggIcon} ${className}`.trim()}
      viewBox="0 0 120 148"
      focusable="false"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={shellGradientId} x1="18" y1="20" x2="99" y2="130" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fffdf0" />
          <stop offset="0.48" stopColor="#f3e9c9" />
          <stop offset="1" stopColor="#bcae87" />
        </linearGradient>
        <linearGradient id={spotGradientId} x1="28" y1="28" x2="82" y2="112" gradientUnits="userSpaceOnUse">
          <stop className={styles.eggSpotLight} offset="0" />
          <stop className={styles.eggSpotDark} offset="1" />
        </linearGradient>
        <radialGradient
          id={shadowGradientId}
          cx="0"
          cy="0"
          r="1"
          gradientTransform="translate(62 118) rotate(90) scale(27 49)"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#665e49" stopOpacity="0.5" />
          <stop offset="1" stopColor="#665e49" stopOpacity="0" />
        </radialGradient>
      </defs>

      <path
        className={styles.eggBase}
        fill={`url(#${shellGradientId})`}
        d="M60 7C36 7 17 37 9 69C0 106 18 139 60 139C102 139 120 106 111 69C103 37 84 7 60 7Z"
      />
      <ellipse cx="60" cy="118" rx="47" ry="25" fill={`url(#${shadowGradientId})`} />
      <g className={styles.eggSpots} fill={`url(#${spotGradientId})`}>
        <path d="M49 10C56 7 68 8 74 15C76 21 70 28 61 29C52 28 46 20 49 10Z" />
        <path d="M20 55C25 47 34 45 40 50C45 57 42 67 34 72C26 72 20 65 20 55Z" />
        <path d="M82 45C91 42 100 48 103 58C103 67 94 72 86 68C79 62 78 52 82 45Z" />
        <path d="M39 100C46 92 58 93 63 102C65 111 57 119 47 118C39 114 36 106 39 100Z" />
        <path d="M75 118C81 112 92 114 96 122C94 131 85 136 76 132C71 128 71 122 75 118Z" />
      </g>
      <path className={styles.eggHighlight} d="M36 36C30 47 27 59 25 70" />
      <path
        className={styles.eggOutline}
        d="M60 7C36 7 17 37 9 69C0 106 18 139 60 139C102 139 120 106 111 69C103 37 84 7 60 7Z"
      />
    </svg>
  );
}
