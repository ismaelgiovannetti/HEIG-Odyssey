"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Hand,
  Info,
  Lightbulb,
  LoaderCircle,
  Monitor,
  UsersRound,
} from "lucide-react";
import {
  PC_BOX_CAPACITY,
  PC_COLUMNS,
  PC_ROWS,
  TEAM_CAPACITY,
} from "@/lib/team/team-contract";
import {
  adjacentBox,
  adjacentCell,
  cellKey,
  describeCell,
  draftSignature,
  firstFreePcCell,
  locatePokemon,
  movePokemon,
  pokemonAt,
  type TeamCell,
} from "@/lib/team/team-draft";
import { PokemonSprite, PokemonTypes } from "./pokemon-summary";
import { PokemonDetailsDialog } from "./pokemon-details-dialog";
import { useTeamCollection } from "./use-team-collection";
import styles from "./team-manager.module.css";

const START_CELL: TeamCell = { area: "team", slot: 1 };
const MOVEMENT_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "PageUp",
  "PageDown",
  "Home",
  "End",
]);

/** PC manuel : aucune recherche ni réorganisation automatique des boîtes. */
export function TeamManager({ playerName }: { playerName: string }) {
  const collection = useTeamCollection();
  const { snapshot, draft, dirty, pending, error } = collection;
  const router = useRouter();
  const [box, setBox] = useState(1);
  const [tipsOpen, setTipsOpen] = useState(true);
  const [focused, setFocused] = useState<TeamCell>(START_CELL);
  const [detailsId, setDetailsId] = useState<string>();
  const [carried, setCarried] = useState<string>();
  const [announcement, setAnnouncement] = useState("");
  const [moveError, setMoveError] = useState("");
  const [boxError, setBoxError] = useState("");
  const [over, setOver] = useState<string>();
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const dragSource = useRef<string | undefined>(undefined);
  const boxTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingFocus = useRef<TeamCell | null>(null);
  const frozen = pending !== null || Boolean(error?.needsReload);
  const byId = useMemo(
    () => new Map(snapshot?.pokemon.map((p) => [p.id, p]) ?? []),
    [snapshot],
  );
  const pcByCell = useMemo(
    () =>
      new Map(
        draft.pc.map((p) => [`${p.boxNumber}:${p.boxSlot}`, p.pokemonId]),
      ),
    [draft.pc],
  );
  const boxCount = draft.pc.filter((p) => p.boxNumber === box).length;
  // Seuls les membres de l'équipe active peuvent ouvrir une fiche.
  // La sélection suit l'identifiant du Pokémon, pas une ancienne position.
  const detailsPokemon =
    detailsId && draft.team.includes(detailsId)
      ? byId.get(detailsId)
      : undefined;
  const closeDetails = useCallback(() => setDetailsId(undefined), []);
  const saveStatus =
    pending === "save"
      ? "Enregistrement automatique…"
      : pending === "load"
        ? "Chargement de la collection…"
        : dirty
          ? "Sauvegarde non confirmée. Rechargez la collection pour vérifier."
          : collection.notice || "Collection à jour.";
  // Un refus de dépôt remplace le succès précédent au même endroit sous le PC.
  const feedbackText = boxError || moveError || saveStatus;

  // Chaque carte d'équipe et son bouton de fiche ont leur propre arrêt Tab.
  // Le PC garde un seul arrêt Tab : ses cases se parcourent avec les flèches.
  // Le focus est posé après le rendu pour permettre aussi un changement de boîte.
  useEffect(() => {
    if (pendingFocus.current) {
      buttons.current.get(cellKey(pendingFocus.current))?.focus();
      pendingFocus.current = null;
    }
  }, [focused, box]);

  useEffect(
    () => () => {
      if (boxTimer.current) clearTimeout(boxTimer.current);
    },
    [],
  );

  // On avertit uniquement tant que la sauvegarde n'est pas confirmée.
  // Une fois la réponse reçue, quitter la page ne demande plus de confirmation.
  // Aucune donnée privée n'est conservée dans le stockage local.
  useEffect(() => {
    if (!dirty && pending !== "save") return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const leave = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      if (
        !(link instanceof HTMLAnchorElement) ||
        link.target === "_blank" ||
        link.hasAttribute("download")
      )
        return;
      const target = new URL(link.href);
      if (
        target.pathname === window.location.pathname &&
        target.search === window.location.search &&
        target.origin === window.location.origin
      )
        return;
      if (
        !window.confirm(
          pending === "save"
            ? "Une sauvegarde est en cours. Quitter cette page malgré tout ?"
            : "Quitter cette page et abandonner les modifications non enregistrées ?",
        )
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", leave, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", leave, true);
    };
  }, [dirty, pending]);

  function clearPickup() {
    setCarried(undefined);
    dragSource.current = undefined;
    setOver(undefined);
    if (boxTimer.current) clearTimeout(boxTimer.current);
    boxTimer.current = null;
  }

  function focusCell(cell: TeamCell) {
    if (cell.area === "pc") {
      if (cell.box !== box) setBoxError("");
      setBox(cell.box);
    }
    pendingFocus.current = cell;
    setFocused({ ...cell });
  }

  async function place(id: string, target: TeamCell) {
    if (frozen || collection.isBusy() || !snapshot) return;
    setBoxError("");
    const source = locatePokemon(draft, id);
    if (!source) {
      clearPickup();
      return;
    }
    const occupant = pokemonAt(draft, target);
    const result = movePokemon(draft, source, target, snapshot.pokemon);
    collection.clearFeedback();
    setMoveError(result.error ?? "");
    if (result.error) {
      // Le refus est annoncé par l'alerte sous le PC, sans message hors écran en double.
      setAnnouncement("");
      return;
    }
    clearPickup();
    const destination = locatePokemon(result.draft, id)!;
    focusCell(destination);
    // Un dépôt sur la même case (ou un ordre inchangé après regroupement)
    // n'est pas une modification et ne déclenche aucune écriture.
    if (draftSignature(result.draft) === draftSignature(draft)) {
      setAnnouncement("Déplacement annulé. Le rangement reste inchangé.");
      return;
    }
    setAnnouncement("");
    const saved = await collection.saveChange(result.draft);
    if (saved) {
      setAnnouncement(
        `${byId.get(id)?.name} déplacé : ${describeCell(destination)}.${occupant ? ` Échange avec ${byId.get(occupant)?.name}.` : ""}`,
      );
      // Le shell et l'accueil relisent eux aussi les données confirmées.
      router.refresh();
    }
  }

  function activate(cell: TeamCell) {
    if (frozen || collection.isBusy()) return;
    if (carried) {
      void place(carried, cell);
      return;
    }
    const id = pokemonAt(draft, cell);
    if (!id) return;
    setCarried(id);
    setMoveError("");
    setBoxError("");
    setAnnouncement(
      `${byId.get(id)?.name} pris. Choisissez une destination puis appuyez sur Entrée. Échap pour annuler.`,
    );
  }

  function keyboard(event: KeyboardEvent<HTMLButtonElement>, cell: TeamCell) {
    if (MOVEMENT_KEYS.has(event.key)) {
      event.preventDefault();
      focusCell(adjacentCell(cell, event.key, box));
    }
    // Entrée et Espace déclenchent nativement le clic du bouton, sans doublon.
  }

  function changeBox(direction: -1 | 1) {
    const next = adjacentBox(box, direction);
    setBoxError("");
    setOver(undefined);
    setBox(next);
    setFocused((current) =>
      current.area === "pc" ? { ...current, box: next } : current,
    );
    setAnnouncement(
      `Boîte ${next}.${carried ? " Pokémon toujours en main." : ""}`,
    );
  }

  function hoverBox(direction: -1 | 1) {
    if (!dragSource.current || frozen || boxTimer.current) return;
    // Une pause sur une flèche ouvre la boîte voisine pendant le glisser-déposer.
    // Un passage = un changement, pour ne pas faire défiler toutes les boîtes d'un coup.
    boxTimer.current = setTimeout(() => {
      changeBox(direction);
      boxTimer.current = null;
    }, 650);
  }

  function stopHoverBox() {
    if (boxTimer.current) clearTimeout(boxTimer.current);
    boxTimer.current = null;
  }

  function startDrag(event: DragEvent<HTMLButtonElement>, cell: TeamCell) {
    const id = pokemonAt(draft, cell);
    if (frozen || collection.isBusy() || !id) {
      event.preventDefault();
      return;
    }
    dragSource.current = id;
    setCarried(id);
    setMoveError("");
    setBoxError("");
    setAnnouncement("");
    // Les données externes déposées dans la page ne sont jamais interprétées.
    // Le déplacement utilise uniquement une référence interne à cette collection.
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", "heig-odyssey-pokemon");
  }

  function dropInBox(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    const source = dragSource.current;
    // Comme sur une case, aucun identifiant reçu d'un dépôt externe n'est utilisé.
    if (!source || frozen || collection.isBusy()) {
      clearPickup();
      return;
    }
    const destination = firstFreePcCell(draft, box);
    if (!destination) {
      clearPickup();
      collection.clearFeedback();
      setMoveError("");
      setAnnouncement("");
      setBoxError("Boîte complète.");
      return;
    }
    // La même validation et la même sauvegarde s'appliquent qu'à un dépôt précis.
    void place(source, destination);
    clearPickup();
  }

  function renderCell(cell: TeamCell) {
    const id =
      cell.area === "team"
        ? draft.team[cell.slot - 1]
        : pcByCell.get(`${cell.box}:${cell.slot}`);
    const pokemon = id ? byId.get(id) : undefined;
    const key = cellKey(cell);
    const picked = Boolean(id && id === carried);
    const isTeam = cell.area === "team";
    const tabStop =
      focused.area === cell.area ? focused.slot === cell.slot : cell.slot === 1;
    const movementButton = (
      <button
        key={key}
        type="button"
        ref={(node) => {
          if (node) buttons.current.set(key, node);
          else buttons.current.delete(key);
        }}
        className={`${styles.cell} ${isTeam ? styles.teamCell : styles.pcCell}`}
        data-picked={(!isTeam && picked) || undefined}
        data-over={(!isTeam && over === key) || undefined}
        data-empty={(!isTeam && !pokemon) || undefined}
        aria-label={`${describeCell(cell)} : ${pokemon ? `${pokemon.name}, niveau ${pokemon.level}${pokemon.isShiny ? ", chromatique" : ""}${pokemon.currentHp === 0 ? ", K.O." : ""}` : "vide"}`}
        aria-pressed={picked}
        aria-describedby="team-controls-help"
        aria-disabled={frozen}
        tabIndex={isTeam || tabStop ? 0 : -1}
        draggable={Boolean(pokemon) && !frozen}
        onFocus={() => {
          setFocused(cell);
        }}
        onClick={() => activate(cell)}
        onKeyDown={(event) => keyboard(event, cell)}
        onDragStart={(event) => startDrag(event, cell)}
        onDragEnd={clearPickup}
        onDragOver={(event) => {
          event.stopPropagation();
          if (!dragSource.current || frozen) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          setOver(key);
        }}
        onDragLeave={() =>
          setOver((current) => (current === key ? undefined : current))
        }
        onDrop={(event) => {
          event.preventDefault();
          // Une case précise conserve l'échange et ne déclenche pas aussi le dépôt sur le cadre.
          event.stopPropagation();
          const source = dragSource.current;
          if (source) void place(source, cell);
          clearPickup();
        }}
      >
        <span className={styles.slotNumber} aria-hidden="true">
          {String(cell.slot).padStart(2, "0")}
        </span>
        {pokemon ? (
          <>
            {/* Seuls les sprites actifs sont harmonisés ; le PC garde son rendu actuel. */}
            <PokemonSprite
              pokemon={pokemon}
              size={isTeam ? 64 : 48}
              normalizeVisibleSize={isTeam}
            />
            {isTeam ? (
              <span className={styles.teamInfo} aria-hidden="true">
                <span className={styles.nameLine}>
                  <strong>{pokemon.name}</strong>
                  <span>Niv. {pokemon.level}</span>
                </span>
                <PokemonTypes types={pokemon.types} />
                <span className={styles.hpLine}>
                  <span className={styles.hpBar}>
                    <span
                      style={{
                        width: `${Math.min(100, (pokemon.currentHp / pokemon.maxHp) * 100)}%`,
                      }}
                    />
                  </span>
                  <span>
                    {pokemon.currentHp === 0
                      ? "K.O."
                      : `${pokemon.currentHp}/${pokemon.maxHp} PV`}
                  </span>
                </span>
              </span>
            ) : (
              <>
                {pokemon.isShiny && (
                  <span className={styles.shiny} aria-hidden="true">
                    ✦
                  </span>
                )}
                {pokemon.currentHp === 0 && (
                  <span className={styles.ko} aria-hidden="true">
                    K.O.
                  </span>
                )}
              </>
            )}
            {picked && (
              <Hand
                className={styles.pickedMark}
                size={14}
                aria-hidden="true"
              />
            )}
          </>
        ) : (
          <span className={styles.emptyLabel} aria-hidden="true">
            {isTeam ? "Emplacement libre" : "+"}
          </span>
        )}
      </button>
    );

    // Une seule carte porte la bordure et les états de déplacement, même vide.
    // Les deux boutons restent frères : consulter la fiche ne prend pas le Pokémon.
    if (!isTeam) return movementButton;
    return (
      <div
        key={key}
        className={styles.teamCard}
        data-picked={picked || undefined}
        data-over={over === key || undefined}
        data-empty={!pokemon || undefined}
      >
        {movementButton}
        {pokemon && (
          <button
            type="button"
            className={styles.detailsButton}
            aria-label={`Voir les détails de ${pokemon.name}`}
            aria-haspopup="dialog"
            title={`Voir les détails de ${pokemon.name}`}
            disabled={frozen || Boolean(carried)}
            onClick={() => {
              if (frozen || carried || collection.isBusy()) return;
              setDetailsId(pokemon.id);
            }}
          >
            <Info size={22} aria-hidden="true" />
          </button>
        )}
      </div>
    );
  }

  async function reload() {
    if (collection.isBusy()) return;
    if (
      dirty &&
      !window.confirm(
        "Recharger le rangement réellement enregistré sur le serveur ? Le déplacement affiché n'est pas encore confirmé.",
      )
    )
      return;
    clearPickup();
    setMoveError("");
    setBoxError("");
    setAnnouncement("");
    await collection.reload();
  }

  return (
    <div
      className={styles.manager}
      onKeyDown={(event) => {
        if (event.key === "Escape" && carried) {
          event.preventDefault();
          clearPickup();
          setMoveError("");
          setBoxError("");
          setAnnouncement("Déplacement annulé. Le Pokémon reste à sa place.");
        }
      }}
    >
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>
            <UsersRound size={15} aria-hidden="true" /> Collection du dresseur
          </p>
          <h1>Gestion d&apos;équipe</h1>
          <p>
            Vos partenaires, à leur place. Préparez votre prochaine aventure.
          </p>
        </div>
        <Link href="/dashboard" className={styles.back}>
          <ArrowLeft size={16} aria-hidden="true" />
          Retour à l&apos;accueil
        </Link>
      </header>

      <div className={styles.feedback}>
        {error && (
          <div className={styles.error} role="alert">
            <p>{error.message}</p>
            {error.needsLogin ? (
              <Link href="/auth/continue">Vérifier ma session</Link>
            ) : (
              (error.needsReload || !snapshot) && (
                <button
                  type="button"
                  disabled={pending !== null}
                  onClick={() => void reload()}
                >
                  Recharger la collection
                </button>
              )
            )}
          </div>
        )}
        <p
          className={styles.srOnly}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {[moveError ? "" : feedbackText, announcement]
            .filter(Boolean)
            .join(" ")}
        </p>
      </div>

      {!snapshot ? (
        <div className={styles.loading} aria-busy={pending !== null}>
          {pending ? (
            <>
              <LoaderCircle size={28} aria-hidden="true" />
              <p>Ouverture du PC…</p>
            </>
          ) : (
            <p>Votre collection n&apos;a pas pu être chargée.</p>
          )}
        </div>
      ) : (
        <>
          <section
            className={styles.instructions}
            aria-labelledby="team-tips-heading"
          >
            <header className={styles.tipsHeader}>
              <h2 className={styles.tipsHeading} id="team-tips-heading">
                <Lightbulb size={20} aria-hidden="true" />
                Tips
              </h2>
              {/* Seul ce bouton replie l'aide ; le titre n'est plus interactif. */}
              <button
                type="button"
                className={styles.tipsToggle}
                aria-expanded={tipsOpen}
                aria-controls="team-controls-help"
                aria-label={tipsOpen ? "Réduire les Tips" : "Afficher les Tips"}
                title={tipsOpen ? "Réduire les Tips" : "Afficher les Tips"}
                onClick={() => setTipsOpen((open) => !open)}
              >
                {tipsOpen ? (
                  <ChevronUp size={18} aria-hidden="true" />
                ) : (
                  <ChevronDown size={18} aria-hidden="true" />
                )}
              </button>
            </header>
            {/* Général, souris, puis clavier : le même ordre à l'écran et à la lecture.
                Le conteneur reste monté afin que le CSS puisse animer sa hauteur. */}
            <div
              className={styles.tipsReveal}
              id="team-controls-help"
              data-open={tipsOpen}
              aria-hidden={!tipsOpen}
            >
              <div className={styles.tipsClip}>
                <div className={styles.tipsContent}>
                  <section
                    className={styles.tipsGroup}
                    aria-labelledby="team-tips-general"
                  >
                    <h3 id="team-tips-general">Général</h3>
                    <ul className={styles.tipsList}>
                      <li>
                        <strong>Case occupée :</strong> les deux Pokémon
                        échangent leur place.
                      </li>
                      <li>
                        <strong>Échap :</strong> annulez le déplacement en cours.
                      </li>
                      <li>
                        <strong>Sauvegarde automatique :</strong>{" "}
                        l’équipe et le rangement du PC sont enregistrés après
                        chaque déplacement ou échange.
                      </li>
                    </ul>
                  </section>
                  <section
                    className={styles.tipsGroup}
                    aria-labelledby="team-tips-mouse"
                  >
                    <h3 id="team-tips-mouse">Souris</h3>
                    <ul className={styles.tipsList}>
                      <li>
                        <strong>Clic ou glisser-déposer :</strong> prenez et
                        posez un Pokémon par clic, ou faites-le glisser vers une
                        case.
                      </li>
                      <li>
                        <strong>Cadre de la boîte :</strong> déposez le Pokémon
                        sur le cadre pour utiliser la première case libre.
                      </li>
                      <li>
                        <strong>Changer de boîte en glissant :</strong> maintenez
                        le Pokémon sur une flèche pour ouvrir la boîte voisine.
                      </li>
                    </ul>
                  </section>
                  <section
                    className={styles.tipsGroup}
                    aria-labelledby="team-tips-keyboard"
                  >
                    <h3 id="team-tips-keyboard">Clavier</h3>
                    <ul className={styles.tipsList}>
                      <li>
                        <strong>Entrée / Espace :</strong> prenez un Pokémon,
                        puis posez-le sur la case choisie.
                      </li>
                      <li>
                        <strong>Flèches directionnelles :</strong> passez d’une
                        case à l’autre.
                      </li>
                      <li>
                        <strong>Tab :</strong> parcourez les éléments interactifs
                        de la page.
                      </li>
                    </ul>
                  </section>
                </div>
              </div>
            </div>
          </section>

          <div className={styles.workspace} aria-busy={pending !== null}>
            <section
              className={`${styles.panel} ${styles.teamPanel}`}
              aria-labelledby="active-team-heading"
            >
              <header className={styles.panelHeading}>
                <div>
                  <UsersRound size={20} aria-hidden="true" />
                  <h2 id="active-team-heading">Mon équipe</h2>
                </div>
                <span>
                  {draft.team.length} / {TEAM_CAPACITY}
                </span>
              </header>
              <div
                className={styles.teamSlots}
                role="group"
                aria-label="Emplacements de l'équipe"
              >
                {Array.from({ length: TEAM_CAPACITY }, (_, i) =>
                  renderCell({ area: "team", slot: i + 1 }),
                )}
              </div>
              <p className={styles.panelFoot}>
                Un à six partenaires, dont un apte au combat. Les places se
                regroupent après un retrait.
              </p>
            </section>

            <section
              className={`${styles.panel} ${styles.pcPanel}`}
              aria-labelledby="pc-heading"
              data-drop-target={over === `box-${box}` || undefined}
              onDragOver={(event) => {
                if (!dragSource.current || frozen) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setOver(`box-${box}`);
              }}
              onDragLeave={(event) => {
                if (
                  event.relatedTarget instanceof Node &&
                  event.currentTarget.contains(event.relatedTarget)
                )
                  return;
                setOver((current) =>
                  current === `box-${box}` ? undefined : current,
                );
              }}
              onDrop={dropInBox}
            >
              <header className={styles.panelHeading}>
                <div>
                  <Monitor size={20} aria-hidden="true" />
                  <h2 id="pc-heading">PC de {playerName}</h2>
                </div>
              </header>
              <div className={styles.boxHeading}>
                <button
                  type="button"
                  className={styles.boxArrow}
                  aria-label="Boîte précédente"
                  disabled={pending !== null}
                  onClick={() => changeBox(-1)}
                  onDragEnter={() => hoverBox(-1)}
                  onDragLeave={stopHoverBox}
                  onDragOver={(event) => {
                    if (dragSource.current) event.preventDefault();
                  }}
                >
                  <ChevronLeft size={22} aria-hidden="true" />
                </button>
                <div>
                  <h3>{snapshot.pc.boxes[box - 1].name}</h3>
                  <span aria-hidden="true">-</span>
                  <span>
                    {boxCount} / {PC_BOX_CAPACITY} places
                  </span>
                </div>
                <button
                  type="button"
                  className={styles.boxArrow}
                  aria-label="Boîte suivante"
                  disabled={pending !== null}
                  onClick={() => changeBox(1)}
                  onDragEnter={() => hoverBox(1)}
                  onDragLeave={stopHoverBox}
                  onDragOver={(event) => {
                    if (dragSource.current) event.preventDefault();
                  }}
                >
                  <ChevronRight size={22} aria-hidden="true" />
                </button>
              </div>
              <div
                className={styles.pcGrid}
                style={
                  {
                    "--pc-rows": PC_ROWS,
                    "--pc-columns": PC_COLUMNS,
                  } as CSSProperties
                }
                role="grid"
                aria-label={`Boîte ${box}`}
                aria-rowcount={PC_ROWS}
                aria-colcount={PC_COLUMNS}
              >
                {Array.from({ length: PC_ROWS }, (_, row) => (
                  <div
                    role="row"
                    aria-rowindex={row + 1}
                    className={styles.pcRow}
                    key={row}
                  >
                    {Array.from({ length: PC_COLUMNS }, (_, column) => (
                      <div
                        role="gridcell"
                        aria-colindex={column + 1}
                        key={column}
                      >
                        {renderCell({
                          area: "pc",
                          box,
                          slot: row * PC_COLUMNS + column + 1,
                        })}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <p className={styles.panelFoot}>
                <span>
                  {snapshot.count}{" "}
                  {snapshot.count > 1 ? "Pokémons" : "Pokémon"}{" "}
                  au total
                </span>
              </p>
            </section>
          </div>

          {/* Le retour de sauvegarde reste sous le PC, même pendant une prise. */}
          <div
            className={styles.saveFeedback}
            data-error={Boolean(boxError || moveError) || undefined}
          >
            {pending === "save" ? (
              <LoaderCircle
                className={styles.savingIcon}
                size={16}
                aria-hidden="true"
              />
            ) : boxError || moveError || error || dirty ? (
              <AlertCircle
                className={styles.saveWarning}
                size={16}
                aria-hidden="true"
              />
            ) : (
              <Check size={16} aria-hidden="true" />
            )}
            {moveError ? (
              <span role="alert">{moveError}</span>
            ) : (
              <span>{feedbackText}</span>
            )}
          </div>

          {detailsPokemon && (
            <PokemonDetailsDialog
              key={detailsPokemon.id}
              pokemon={detailsPokemon}
              onClose={closeDetails}
            />
          )}
        </>
      )}
    </div>
  );
}
