"use client";

import { useState, useTransition } from "react";
import {
  Activity,
  AlertTriangle,
  Award,
  CheckCircle2,
  Coins,
  Compass,
  Dices,
  Flame,
  Layers,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Swords,
  Users,
  XCircle,
} from "lucide-react";
import type {
  AdminDashboardData,
  AdminPlayerItem,
} from "@/lib/admin/admin-analytics-service";
import { SpriteProvider } from "@/components/pokemon/sprite-provider";
import styles from "./admin-dashboard.module.css";

interface AdminDashboardProps {
  initialData: AdminDashboardData;
}

type TabType = "overview" | "players" | "combats" | "gacha" | "system";

export function AdminDashboard({ initialData }: Readonly<AdminDashboardProps>) {
  const [data, setData] = useState<AdminDashboardData>(initialData);
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleRefresh = () => {
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/stats");
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            setData(json.data);
          }
        }
      } catch (err) {
        console.error("Erreur lors de l'actualisation:", err);
      }
    });
  };

  // Filter players list
  const filteredPlayers = data.players.filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      (p.username && p.username.toLowerCase().includes(q)) ||
      p.email.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q)
    );
  });

  const shinyRateDiff = Math.abs(data.overview.observedShinyRate - 1.0);
  const isShinyRateNormal = shinyRateDiff <= 1.5;

  return (
    <div className={styles.adminContainer}>
      {/* Top Header */}
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>Supervision Live</h1>
          <span className={styles.adminBadge}>
            <ShieldCheck size={14} />
            Espace Admin
          </span>
        </div>

        <div className={styles.headerActions}>
          <span className={styles.lastUpdated}>
            Mis à jour à{" "}
            {new Date(data.generatedAt).toLocaleTimeString("fr-FR", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
          <button
            type="button"
            className={styles.refreshBtn}
            onClick={handleRefresh}
            disabled={isPending}
            title="Rafraîchir les données en temps réel"
          >
            <RefreshCw size={14} className={isPending ? styles.spinning : ""} />
            <span>{isPending ? "Chargement..." : "Actualiser"}</span>
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className={styles.tabsNav} aria-label="Sections d'administration">
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === "overview" ? styles.tabBtnActive : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          <Activity size={16} />
          <span>Vue d&apos;ensemble</span>
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === "players" ? styles.tabBtnActive : ""}`}
          onClick={() => setActiveTab("players")}
        >
          <Users size={16} />
          <span>Joueurs ({data.players.length})</span>
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === "combats" ? styles.tabBtnActive : ""}`}
          onClick={() => setActiveTab("combats")}
        >
          <Swords size={16} />
          <span>Combats &amp; Campagne</span>
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === "gacha" ? styles.tabBtnActive : ""}`}
          onClick={() => setActiveTab("gacha")}
        >
          <Dices size={16} />
          <span>Gacha &amp; Économie</span>
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === "system" ? styles.tabBtnActive : ""}`}
          onClick={() => setActiveTab("system")}
        >
          <Layers size={16} />
          <span>Système &amp; Événements</span>
        </button>
      </nav>

      {/* Tab 1: Vue d'ensemble */}
      {activeTab === "overview" && (
        <div className={styles.tabContent}>
          <div className={styles.kpiGrid}>
            <div className={styles.kpiCard}>
              <div className={styles.kpiIcon}>
                <Users size={24} />
              </div>
              <div className={styles.kpiInfo}>
                <span className={styles.kpiLabel}>Comptes Joueurs</span>
                <span className={styles.kpiValue}>
                  {data.overview.totalUsers}
                </span>
                <span className={styles.kpiSub}>
                  {data.overview.verifiedUsers} vérifiés •{" "}
                  {data.overview.activeUsers7d} actifs (7j)
                </span>
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiIcon}>
                <Swords size={24} />
              </div>
              <div className={styles.kpiInfo}>
                <span className={styles.kpiLabel}>Combats Joués</span>
                <span className={styles.kpiValue}>
                  {data.overview.totalBattles}
                </span>
                <span className={styles.kpiSub}>
                  {data.overview.battlesWon} vict. (
                  {data.overview.globalWinRate}% winrate)
                </span>
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiIcon}>
                <Coins size={24} />
              </div>
              <div className={styles.kpiInfo}>
                <span className={styles.kpiLabel}>Masse Monétaire</span>
                <span className={styles.kpiValue}>
                  {data.overview.totalPokedollars.toLocaleString("fr-FR")} ₽
                </span>
                <span className={styles.kpiSub}>
                  Moyenne :{" "}
                  {data.overview.avgPokedollars.toLocaleString("fr-FR")} ₽ /
                  joueur
                </span>
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiIcon}>
                <Sparkles size={24} />
              </div>
              <div className={styles.kpiInfo}>
                <span className={styles.kpiLabel}>Pokémons &amp; Shinies</span>
                <span className={styles.kpiValue}>
                  {data.overview.totalPokemon}
                </span>
                <span className={styles.kpiSub}>
                  ✨ {data.overview.totalShinies} shinies répertoriés
                </span>
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiIcon}>
                <Dices size={24} />
              </div>
              <div className={styles.kpiInfo}>
                <span className={styles.kpiLabel}>Tirages Gacha</span>
                <span className={styles.kpiValue}>
                  {data.overview.totalPulls}
                </span>
                <span className={styles.kpiSub}>
                  {data.overview.totalPullsShinies} shinies obtenus au tirage
                </span>
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiIcon}>
                <Award size={24} />
              </div>
              <div className={styles.kpiInfo}>
                <span className={styles.kpiLabel}>Quêtes Complétées</span>
                <span className={styles.kpiValue}>
                  {data.quests.completionRate}%
                </span>
                <span className={styles.kpiSub}>
                  {data.quests.totalCompleted} terminées /{" "}
                  {data.quests.totalAssigned} assignées
                </span>
              </div>
            </div>
          </div>

          {/* Shiny Rate Observed vs Theory Card */}
          <div className={styles.shinyRateBox}>
            <div>
              <h3
                style={{
                  margin: "0 0 6px",
                  fontSize: "15px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <Sparkles size={16} color="#fbbf24" />
                Vérification du Taux Shiny Gacha
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: "12px",
                  color: "var(--color-text-muted)",
                }}
              >
                Comparaison statistique de l&apos;aléa en base de données par
                rapport au taux théorique de 1%.
              </p>
            </div>
            <div className={styles.rateNumbers}>
              <div>
                <span className={styles.rateObserved}>
                  {data.overview.observedShinyRate}%
                </span>
                <span className={styles.rateExpected}> (théorie : 1.00%)</span>
              </div>
              {isShinyRateNormal ? (
                <span className={styles.rateVerdictNormal}>
                  <CheckCircle2 size={14} /> Normal
                </span>
              ) : (
                <span className={styles.rateVerdictAnomaly}>
                  <AlertTriangle size={14} /> Écart Détecté
                </span>
              )}
            </div>
          </div>

          {/* Top Pokemon species deployed */}
          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                <Flame size={18} color="#c94036" />
                Pokémons les plus Déployés en Équipe
              </h2>
            </div>
            <div className={styles.topPokemonGrid}>
              {data.combats.topTeamSpecies.map((p, idx) => (
                <div key={p.speciesId} className={styles.topPokemonCard}>
                  <span className={styles.topPokemonRank}>#{idx + 1}</span>
                  <div style={{ width: 44, height: 44, flexShrink: 0 }}>
                    <SpriteProvider
                      speciesId={p.speciesId}
                      variant="front"
                      alt={p.speciesName}
                      width={44}
                      height={44}
                    />
                  </div>
                  <div className={styles.topPokemonDetails}>
                    <span className={styles.topPokemonName}>
                      {p.speciesName}
                    </span>
                    <span className={styles.topPokemonCount}>
                      {p.count} en équipe
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Joueurs */}
      {activeTab === "players" && (
        <div className={styles.tabContent}>
          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                <Users size={18} />
                Répertoire des Joueurs ({filteredPlayers.length} /{" "}
                {data.players.length})
              </h2>

              <div className={styles.searchContainer}>
                <Search size={15} color="var(--color-placeholder)" />
                <input
                  type="text"
                  placeholder="Rechercher par nom, email, identifiant..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={styles.searchInput}
                />
              </div>
            </div>

            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.th}>Joueur</th>
                    <th className={styles.th}>Rôle</th>
                    <th className={styles.th}>Statut</th>
                    <th className={styles.th}>Pokédollars</th>
                    <th className={styles.th}>Pokémons</th>
                    <th className={styles.th}>Combats</th>
                    <th className={styles.th}>Équipe Active</th>
                    <th className={styles.th}>Inscrit le</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPlayers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        style={{
                          textAlign: "center",
                          padding: "30px",
                          color: "var(--color-text-muted)",
                        }}
                      >
                        Aucun joueur ne correspond à la recherche.
                      </td>
                    </tr>
                  ) : (
                    filteredPlayers.map((player) => (
                      <PlayerRow key={player.id} player={player} />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Combats & Campagne */}
      {activeTab === "combats" && (
        <div className={styles.tabContent}>
          <div className={styles.kpiGrid}>
            <div className={styles.kpiCard}>
              <div className={styles.kpiIcon}>
                <Compass size={24} />
              </div>
              <div className={styles.kpiInfo}>
                <span className={styles.kpiLabel}>Combats Campagne</span>
                <span className={styles.kpiValue}>
                  {data.combats.campaignBattles}
                </span>
                <span className={styles.kpiSub}>Scénario et boss</span>
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiIcon}>
                <Swords size={24} />
              </div>
              <div className={styles.kpiInfo}>
                <span className={styles.kpiLabel}>Combats Entraînement</span>
                <span className={styles.kpiValue}>
                  {data.combats.trainingBattles}
                </span>
                <span className={styles.kpiSub}>Arènes et bots</span>
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiIcon}>
                <Activity size={24} />
              </div>
              <div className={styles.kpiInfo}>
                <span className={styles.kpiLabel}>Durée Moyenne</span>
                <span className={styles.kpiValue}>
                  {data.combats.avgTurns} tours
                </span>
                <span className={styles.kpiSub}>Par affrontement</span>
              </div>
            </div>
          </div>

          {/* Funnel Campagne */}
          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                <Compass size={18} />
                Entonnoir d&apos;Achèvement des Étapes de Campagne
              </h2>
            </div>
            {data.combats.campaignStageCompletions.length === 0 ? (
              <p style={{ color: "var(--color-text-muted)" }}>
                Aucun combat de campagne complété pour l&apos;instant.
              </p>
            ) : (
              <div>
                {data.combats.campaignStageCompletions.map((stage) => {
                  const maxVal = Math.max(
                    ...data.combats.campaignStageCompletions.map(
                      (s) => s.count,
                    ),
                    1,
                  );
                  const pct = Math.round((stage.count / maxVal) * 100);
                  return (
                    <div
                      key={`${stage.worldId}-${stage.stageId}`}
                      className={styles.funnelItem}
                    >
                      <div className={styles.funnelHeader}>
                        <span>
                          <strong>Monde : {stage.worldId}</strong> — Étape :{" "}
                          {stage.stageId}
                        </span>
                        <span
                          style={{
                            color: "var(--color-primary-light)",
                            fontWeight: 700,
                          }}
                        >
                          {stage.count} victoires
                        </span>
                      </div>
                      <div className={styles.funnelBarTrack}>
                        <div
                          className={styles.funnelBarFill}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Gacha & Économie */}
      {activeTab === "gacha" && (
        <div className={styles.tabContent}>
          <div className={styles.kpiGrid}>
            <div className={styles.kpiCard}>
              <div className={styles.kpiIcon}>
                <Coins size={24} />
              </div>
              <div className={styles.kpiInfo}>
                <span className={styles.kpiLabel}>Dépensé en Tirages</span>
                <span className={styles.kpiValue}>
                  {data.gacha.totalSpentPokedollars.toLocaleString("fr-FR")} ₽
                </span>
                <span className={styles.kpiSub}>Siphon économique</span>
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiIcon}>
                <Coins size={24} />
              </div>
              <div className={styles.kpiInfo}>
                <span className={styles.kpiLabel}>Gagné en Combats</span>
                <span className={styles.kpiValue}>
                  {data.gacha.totalEarnedBattlePokedollars.toLocaleString(
                    "fr-FR",
                  )}{" "}
                  ₽
                </span>
                <span className={styles.kpiSub}>Génération monétaire</span>
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiIcon}>
                <Sparkles size={24} />
              </div>
              <div className={styles.kpiInfo}>
                <span className={styles.kpiLabel}>Taux Shiny Réalisé</span>
                <span className={styles.kpiValue}>
                  {data.gacha.observedShinyRate}%
                </span>
                <span className={styles.kpiSub}>
                  {data.gacha.totalShiniesPulls} shinies sur{" "}
                  {data.gacha.totalPulls} pulls
                </span>
              </div>
            </div>
          </div>

          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                <Dices size={18} />
                Répartition des Tirages par Bannière
              </h2>
            </div>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.th}>Identifiant</th>
                    <th className={styles.th}>Nom du Portail</th>
                    <th className={styles.th}>Total Tirages</th>
                    <th className={styles.th}>Shinies Obtenus</th>
                    <th className={styles.th}>Taux Observé</th>
                  </tr>
                </thead>
                <tbody>
                  {data.gacha.bannerBreakdown.map((b) => {
                    const rate =
                      b.totalPulls > 0
                        ? ((b.shinyCount / b.totalPulls) * 100).toFixed(2)
                        : "0.00";
                    return (
                      <tr key={b.bannerId} className={styles.tr}>
                        <td className={styles.td}>
                          <code>{b.bannerId}</code>
                        </td>
                        <td className={styles.td}>
                          <strong>{b.bannerName}</strong>
                        </td>
                        <td className={styles.td}>{b.totalPulls}</td>
                        <td className={styles.td}>✨ {b.shinyCount}</td>
                        <td className={styles.td}>{rate}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Système & Événements */}
      {activeTab === "system" && (
        <div className={styles.tabContent}>
          <div className={styles.kpiGrid}>
            <div className={styles.kpiCard}>
              <div className={styles.kpiIcon}>
                <CheckCircle2 size={24} color="var(--color-success)" />
              </div>
              <div className={styles.kpiInfo}>
                <span className={styles.kpiLabel}>Outbox Publiés</span>
                <span className={styles.kpiValue}>
                  {data.system.outboxPublished}
                </span>
                <span className={styles.kpiSub}>Événements acheminés</span>
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiIcon}>
                <Activity size={24} />
              </div>
              <div className={styles.kpiInfo}>
                <span className={styles.kpiLabel}>Outbox En Attente</span>
                <span className={styles.kpiValue}>
                  {data.system.outboxPending}
                </span>
                <span className={styles.kpiSub}>File de traitement active</span>
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiIcon}>
                <XCircle
                  size={24}
                  color={
                    data.system.outboxFailed > 0
                      ? "var(--color-error-border)"
                      : "var(--color-text-muted)"
                  }
                />
              </div>
              <div className={styles.kpiInfo}>
                <span className={styles.kpiLabel}>Outbox Échoués</span>
                <span className={styles.kpiValue}>
                  {data.system.outboxFailed}
                </span>
                <span className={styles.kpiSub}>
                  Nécessitent une inspection
                </span>
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiIcon}>
                <Layers size={24} />
              </div>
              <div className={styles.kpiInfo}>
                <span className={styles.kpiLabel}>Events de Domaine</span>
                <span className={styles.kpiValue}>
                  {data.system.processedDomainEvents}
                </span>
                <span className={styles.kpiSub}>Historique persistant</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PlayerRow({ player }: { player: AdminPlayerItem }) {
  return (
    <tr className={styles.tr}>
      <td className={styles.td}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <strong>{player.name}</strong>
          <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
            {player.email}
          </span>
          {player.username && (
            <span
              style={{ fontSize: "10px", color: "var(--color-placeholder)" }}
            >
              @{player.username}
            </span>
          )}
        </div>
      </td>
      <td className={styles.td}>
        {player.role === "admin" ? (
          <span className={styles.badgeRoleAdmin}>ADMIN</span>
        ) : (
          <span className={styles.badgeRoleUser}>Joueur</span>
        )}
      </td>
      <td className={styles.td}>
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          {player.emailVerified ? (
            <span className={styles.badgeVerified}>
              <CheckCircle2 size={12} /> Email vérifié
            </span>
          ) : (
            <span className={styles.badgeUnverified}>
              <XCircle size={12} /> Non vérifié
            </span>
          )}
          <span style={{ fontSize: "10px", color: "var(--color-text-muted)" }}>
            {player.hasCompletedOnboarding
              ? "Onboarding fait"
              : "En onboarding"}
          </span>
        </div>
      </td>
      <td className={styles.td}>
        <strong>{player.pokedollars.toLocaleString("fr-FR")}</strong> ₽
      </td>
      <td className={styles.td}>
        <span>{player.pokemonCount}</span>
        {player.shinyCount > 0 && (
          <span
            style={{ marginLeft: "4px", color: "#fbbf24", fontSize: "11px" }}
          >
            (✨ {player.shinyCount})
          </span>
        )}
      </td>
      <td className={styles.td}>
        <div>
          <span>
            {player.battlesWon}V / {player.battlesTotal - player.battlesWon}D
          </span>
          <span
            style={{
              display: "block",
              fontSize: "11px",
              color: "var(--color-text-muted)",
            }}
          >
            {player.winRate}% win
          </span>
        </div>
      </td>
      <td className={styles.td}>
        <div className={styles.teamMiniList}>
          {player.activeTeam.length === 0 ? (
            <span
              style={{ fontSize: "11px", color: "var(--color-text-muted)" }}
            >
              Aucun
            </span>
          ) : (
            player.activeTeam.map((pkmn, i) => (
              <div
                key={`${pkmn.speciesId}-${i}`}
                className={`${styles.teamMiniSlot} ${pkmn.isShiny ? styles.teamMiniSlotShiny : ""}`}
                title={`${pkmn.speciesName} (Nv. ${pkmn.level})${pkmn.isShiny ? " ✨ SHINY" : ""} - PV: ${pkmn.currentHp}/${pkmn.maxHp}`}
              >
                <div style={{ width: 28, height: 28 }}>
                  <SpriteProvider
                    speciesId={pkmn.speciesId}
                    variant={pkmn.isShiny ? "front_shiny" : "front"}
                    alt={pkmn.speciesName}
                    width={28}
                    height={28}
                  />
                </div>
                <span className={styles.teamMiniLevel}>N.{pkmn.level}</span>
              </div>
            ))
          )}
        </div>
      </td>
      <td
        className={styles.td}
        style={{
          fontSize: "11px",
          color: "var(--color-text-muted)",
          whiteSpace: "nowrap",
        }}
      >
        {new Date(player.createdAt).toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })}
      </td>
    </tr>
  );
}
