import { ArrowRight, Swords } from "lucide-react";

import { StarterTypeBadge } from "@/components/onboarding/starter-type-badge";
import { SpriteProvider } from "@/components/pokemon/sprite-provider";
import type { StarterView } from "@/lib/starter/starter-contract";

type StatKey = keyof NonNullable<StarterView["baseStats"]>;

const STATS: Array<{ key: StatKey; label: string }> = [
  { key: "hp", label: "PV" },
  { key: "attack", label: "ATQ" },
  { key: "defense", label: "DEF" },
  { key: "specialAttack", label: "ATQ.SP" },
  { key: "specialDefense", label: "DEF.SP" },
  { key: "speed", label: "VIT" },
];

type StarterDetailProps = Readonly<{
  starter: StarterView | null;
  onChoose: () => void;
  onPlayCry: (starter: StarterView) => void;
}>;

function StarterStats({
  baseStats,
}: Readonly<{
  baseStats: NonNullable<StarterView["baseStats"]>;
}>) {
  return (
    <div className="starter-stats" aria-label="Statistiques de base">
      {STATS.map((stat) => (
        <div className="starter-stat" key={stat.key}>
          <span>{stat.label}</span>
          <div>
            <i
              style={{
                width: String(Math.min(100, baseStats[stat.key] / 2.1)) + "%",
              }}
            />
          </div>
          <strong>{baseStats[stat.key]}</strong>
        </div>
      ))}
    </div>
  );
}

export function StarterDetail({
  starter,
  onChoose,
  onPlayCry,
}: StarterDetailProps) {
  return (
    <aside className="starter-detail" aria-live="polite">
      {starter ? (
        <>
          <div
            className="starter-detail__portrait"
            onClick={() => onPlayCry(starter)}
            style={{ cursor: "pointer" }}
            title={"Écouter le cri de " + starter.name}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                onPlayCry(starter);
              }
            }}
          >
            <span>#{String(starter.dexNumber ?? 0).padStart(3, "0")}</span>
            <SpriteProvider
              speciesId={starter.speciesId}
              alt={starter.name}
              width={132}
              height={132}
              priority
            />
          </div>
          <div className="starter-detail__title">
            <div>
              <span>NIVEAU {starter.level}</span>
              <h3>{starter.name}</h3>
            </div>
            <div className="starter-detail__types">
              {starter.types.map((type) => (
                <StarterTypeBadge key={type} type={type} />
              ))}
            </div>
          </div>
          {starter.baseStats ? (
            <StarterStats baseStats={starter.baseStats} />
          ) : null}
          <div className="starter-moves">
            <span>Capacités de départ</span>
            <ul>
              {starter.moves.map((move) => (
                <li key={move.id}>
                  <Swords aria-hidden="true" size={12} />
                  {move.name}
                </li>
              ))}
            </ul>
          </div>
          <button
            className="onboarding-primary-button"
            type="button"
            onClick={onChoose}
          >
            Choisir {starter.name}
            <ArrowRight aria-hidden="true" size={17} />
          </button>
        </>
      ) : (
        <p className="starter-detail__empty">
          Sélectionnez une créature pour afficher sa fiche.
        </p>
      )}
    </aside>
  );
}
