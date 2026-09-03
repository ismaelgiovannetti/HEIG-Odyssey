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
  Check,
  ChevronLeft,
  ChevronRight,
  Leaf,
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
  teamRefusal,
  type TeamCell,
} from "@/lib/team/team-draft";
import { PokemonDetailsDialog } from "./pokemon-details-dialog";
import { TeamPokemonCell } from "./team-pokemon-cell";
import { PokemonReleaseDialog } from "./pokemon-release-dialog";
import { TeamTipsDialog } from "./team-tips-dialog";
import { useTeamCollection } from "./use-team-collection";
import { useTeamLeaveGuard } from "./use-team-leave-guard";
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
  // L'aide reste disponible sans masquer l'équipe dès l'arrivée sur la page.
  const [tipsOpen, setTipsOpen] = useState(false);
  const [focused, setFocused] = useState<TeamCell>(START_CELL);
  const [detailsId, setDetailsId] = useState<string>();
  const [releaseId, setReleaseId] = useState<string>();
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
  useTeamLeaveGuard({
    active: dirty || pending === "save" || pending === "release",
    saving: pending === "save" || pending === "release",
  });
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
  const releaseCandidate = releaseId ? byId.get(releaseId) : undefined;
  const releaseButton = useRef<HTMLButtonElement>(null);
  const closeDetails = useCallback(() => setDetailsId(undefined), []);
  const saveStatus =
    pending === "release"
      ? "Relâchement en cours…"
      : pending === "save"
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
    // Le callback s'exécute dans le même tick que la mise à jour de pending :
    // appeler router.refresh() après un await séparé laisserait une fenêtre
    // où l'ordre de traitement React entre les deux n'est pas garanti.
    await collection.saveChange(result.draft, () => {
      setAnnouncement(
        `${byId.get(id)?.name} déplacé : ${describeCell(destination)}.${occupant ? ` Échange avec ${byId.get(occupant)?.name}.` : ""}`,
      );
      // Le shell et l'accueil relisent eux aussi les données confirmées.
      router.refresh();
    });
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

  function prepareRelease(id: string) {
    if (frozen || collection.isBusy() || !snapshot) return;
    const pokemon = byId.get(id);
    if (!pokemon) {
      clearPickup();
      return;
    }

    // Le contrôle côté client donne un retour immédiat. Le serveur répète cette
    // validation dans la transaction afin qu'une requête directe ne puisse pas
    // vider l'équipe ou n'y laisser que des partenaires K.O.
    if (draft.team.includes(id)) {
      const refusal = teamRefusal(
        { ...draft, team: draft.team.filter((pokemonId) => pokemonId !== id) },
        snapshot.pokemon,
      );
      if (refusal) {
        collection.clearFeedback();
        clearPickup();
        setBoxError("");
        setMoveError(refusal);
        setAnnouncement("");
        return;
      }
    }

    collection.clearFeedback();
    setMoveError("");
    setBoxError("");
    clearPickup();
    setReleaseId(id);
  }

  function dropForRelease(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    const source = dragSource.current;
    if (!source || frozen || collection.isBusy()) {
      clearPickup();
      return;
    }
    prepareRelease(source);
  }

  async function confirmRelease() {
    if (!releaseCandidate || pending === "release") return;
    const releasedName = releaseCandidate.name;
    const released = await collection.releasePokemon(
      releaseCandidate.id,
      releasedName,
      () => router.refresh(),
    );
    setReleaseId(undefined);
    if (released) {
      setAnnouncement(`${releasedName} a été relâché dans la nature.`);
    }
    releaseButton.current?.focus();
  }

  function renderCell(cell: TeamCell) {
    const id =
      cell.area === "team"
        ? draft.team[cell.slot - 1]
        : pcByCell.get(`${cell.box}:${cell.slot}`);
    const pokemon = id ? byId.get(id) : undefined;
    const key = cellKey(cell);
    const picked = Boolean(id && id === carried);
    const tabStop =
      focused.area === cell.area ? focused.slot === cell.slot : cell.slot === 1;
    return (
      <TeamPokemonCell
        key={key}
        cell={cell}
        pokemon={pokemon}
        picked={picked}
        frozen={frozen}
        highlighted={over === key}
        tabStop={tabStop}
        detailsDisabled={frozen || Boolean(carried)}
        buttonRef={(node) => {
          if (node) buttons.current.set(key, node);
          else buttons.current.delete(key);
        }}
        canDrop={() => Boolean(dragSource.current)}
        onFocus={setFocused}
        onActivate={activate}
        onNavigate={keyboard}
        onDragStart={startDrag}
        onDragEnd={clearPickup}
        onHighlight={(next) => {
          if (next) setOver(next);
          else setOver((current) => (current === key ? undefined : current));
        }}
        onDrop={(event, destination) => {
          event.preventDefault();
          // Une case précise ne déclenche pas aussi le dépôt sur le cadre.
          event.stopPropagation();
          const source = dragSource.current;
          if (source) void place(source, destination);
          clearPickup();
        }}
        onOpenDetails={(pokemonId) => {
          if (frozen || carried || collection.isBusy()) return;
          setDetailsId(pokemonId);
        }}
      />
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
        <p className={styles.eyebrow}>
          <UsersRound size={15} aria-hidden="true" /> Collection du dresseur
        </p>
        <div className={styles.headingLine}>
          <h1>Gestion d&apos;équipe</h1>
          <div className={styles.headingActions}>
            <p className={styles.headingSubtitle}>
              Préparez votre prochaine aventure.
            </p>
            <button
              type="button"
              className={styles.tipsTrigger}
              aria-label="Afficher les Tips"
              title="Tips"
              onClick={() => setTipsOpen(true)}
            >
              <Lightbulb size={21} aria-hidden="true" />
              <span>Tips</span>
            </button>
          </div>
        </div>
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

      {/* Cette zone reçoit toute la hauteur encore disponible dans le shell.
          Ses trois rangées restent stables pendant le chargement et la sauvegarde. */}
      <div className={styles.content}>
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
                  <button
                    ref={releaseButton}
                    type="button"
                    className={styles.releaseButton}
                    data-over={over === "release" || undefined}
                    aria-label={
                      carried && byId.get(carried)
                        ? `Relâcher ${byId.get(carried)!.name} dans la nature`
                        : "Relâcher un Pokémon dans la nature"
                    }
                    title="Relâcher dans la nature"
                    disabled={frozen}
                    onClick={() => {
                      if (carried) {
                        prepareRelease(carried);
                        return;
                      }
                      collection.clearFeedback();
                      setMoveError(
                        "Prenez d’abord un Pokémon avant de le relâcher.",
                      );
                      setBoxError("");
                      setAnnouncement("");
                    }}
                    onDragEnter={(event) => {
                      event.stopPropagation();
                      if (dragSource.current && !frozen) setOver("release");
                    }}
                    onDragOver={(event) => {
                      event.stopPropagation();
                      if (!dragSource.current || frozen) return;
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                      setOver("release");
                    }}
                    onDragLeave={() =>
                      setOver((current) =>
                        current === "release" ? undefined : current,
                      )
                    }
                    onDrop={dropForRelease}
                  >
                    <Leaf size={18} aria-hidden="true" />
                  </button>
                  <span className={styles.pcCount}>
                    {snapshot.count}{" "}
                    {snapshot.count > 1 ? "Pokémons" : "Pokémon"} au total
                  </span>
                </p>
              </section>
            </div>

            {/* Le retour de sauvegarde reste sous le PC, même pendant une prise. */}
            <div
              className={styles.saveFeedback}
              data-error={Boolean(boxError || moveError) || undefined}
            >
              {pending === "save" || pending === "release" ? (
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
                onUpdated={() => {
                  void collection.reload();
                }}
              />
            )}
            {releaseCandidate && (
              <PokemonReleaseDialog
                key={releaseCandidate.id}
                pokemon={releaseCandidate}
                pending={pending === "release"}
                onCancel={() => {
                  if (pending !== "release") setReleaseId(undefined);
                }}
                onConfirm={() => void confirmRelease()}
              />
            )}
            {tipsOpen && <TeamTipsDialog onClose={() => setTipsOpen(false)} />}
          </>
        )}
      </div>
    </div>
  );
}
