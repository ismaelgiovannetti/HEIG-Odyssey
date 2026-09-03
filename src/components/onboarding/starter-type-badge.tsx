import type { CSSProperties } from "react";

import {
  getPokemonTypeColor,
  getPokemonTypeLabel,
} from "@/lib/pokemon/type-presentation";

type StarterTypeBadgeProps = Readonly<{
  type: string;
}>;

export function StarterTypeBadge({ type }: StarterTypeBadgeProps) {
  const style = {
    "--starter-type-color": getPokemonTypeColor(type),
  } as CSSProperties;

  return (
    <span className="starter-type" style={style}>
      {getPokemonTypeLabel(type)}
    </span>
  );
}
