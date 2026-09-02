"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type CSSProperties } from "react";
import { Check, Coins, GraduationCap, Lock, MapPinned, Sparkles, Star, Swords, Trophy } from "lucide-react";
import { BattleArena } from "@/components/battle/battle-arena";
import {
  BattleRequestError,
  readBattleStartResponse,
  type BattleStartPayload,
} from "@/lib/combat/battle-client";
import {
  getCampaignStagePoint,
  getCampaignWorldMap,
} from "@/lib/campaign/campaign-map-config";
import type { CampaignProgressOverview, CampaignStageView, CampaignWorldView } from "@/lib/campaign/campaign-service";

interface CampaignMapProps { overview: CampaignProgressOverview; }

const WORLD_ACCENTS: Record<string, string> = {
  "bachelor-1":"#7993aa", "bachelor-2":"#59a967", "bachelor-3":"#f1b82d",
  "bachelor-4":"#c56f35", "bachelor-5":"#a45de2", "master-1":"#8a50b8",
  "master-2":"#63bde8", doctorat:"#e6b84f",
};

const shortName = (world: CampaignWorldView) => world.name.split(" - ")[0];
const theme = (world: CampaignWorldView) => world.name.split(" - ")[1]?.replace(/^Type /, "") ?? world.degree;

export function CampaignMap({ overview }: Readonly<CampaignMapProps>) {
  const router = useRouter();
  const [worldId, setWorldId] = useState(overview.currentWorldId);
  const [stageId, setStageId] = useState<string | null>(overview.nextRecommendedStage?.id ?? null);
  const [launching, setLaunching] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [activeBattle, setActiveBattle] = useState<BattleStartPayload | null>(null);
  const world = overview.worlds.find((item) => item.id === worldId) ?? overview.worlds[0];
  const stage = world.stages.find((item) => item.id === stageId)
    ?? world.stages.find((item) => item.status === "ACCESSIBLE") ?? world.stages[0];
  const progress = world.totalStagesCount ? Math.round(world.completedStagesCount / world.totalStagesCount * 100) : 0;

  const selectWorld = (next: CampaignWorldView) => {
    setWorldId(next.id);
    setStageId(next.stages.find((item) => item.status === "ACCESSIBLE")?.id ?? next.stages.at(-1)?.id ?? null);
    setMessage(null);
  };

  const launch = async (target: CampaignStageView) => {
    if (target.isLocked || launching) return;
    setLaunching(target.id); setMessage(null);
    try {
      // Seul l'identifiant de l'étape est transmis : le serveur contrôle
      // l'accès, choisit le dresseur et relit l'équipe du compte connecté.
      const response = await fetch("/api/battle/start", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageId: target.id }),
      });
      setActiveBattle(await readBattleStartResponse(response));
    } catch (cause) {
      setMessage(
        cause instanceof BattleRequestError
          ? cause.message
          : "Une erreur de communication est survenue lors du démarrage du combat.",
      );
    } finally {
      setLaunching(null);
    }
  };

  if (activeBattle) {
    return (
      <BattleArena
        key={activeBattle.battleId}
        initialBattle={activeBattle}
        mode="campaign"
        onReturn={() => {
          setActiveBattle(null);
          setMessage(null);
          // Le serveur a pu créditer les gains et débloquer l'étape suivante.
          router.refresh();
        }}
      />
    );
  }

  return <section className="campaign-container campaign-redesign" aria-labelledby="campaign-title" style={{"--campaign-accent":WORLD_ACCENTS[world.id]} as CSSProperties}>
    <header className="campaign-hero">
      <div><span className="campaign-hero__eyebrow"><MapPinned size={15}/> Parcours académique</span><h1 id="campaign-title" className="campaign-title">Campagne - {shortName(world)}</h1><p>{world.description}</p></div>
      <div className="campaign-hero__stats" aria-label={`${overview.totalCompletedStages} étapes terminées sur ${overview.totalStages}`}><Trophy size={27}/><div><strong>{overview.totalCompletedStages}/{overview.totalStages}</strong><span>Épreuves réussies</span></div></div>
    </header>

    <nav className="campaign-worlds-nav" aria-label="Navigation entre les mondes de la campagne">
      <div className="campaign-worlds-nav__heading"><GraduationCap size={21}/><span>Mondes</span></div>
      <ol className="campaign-worlds-list">{overview.worlds.map((item,index)=><li key={item.id}><button type="button" className={`campaign-world-tab ${item.id===worldId?"is-active":""} ${item.isCompleted?"is-completed":""} ${item.isLocked?"is-locked":""}`} onClick={()=>selectWorld(item)} aria-current={item.id===worldId?"page":undefined} aria-label={`${item.name} (${item.completedStagesCount}/${item.totalStagesCount} terminées)${item.isLocked?" - Verrouillé":""}`}>
        <span className="campaign-world-tab__number">{item.isCompleted?<Check size={14}/>:item.isLocked?<Lock size={13}/>:index+1}</span><span className="campaign-world-tab__info"><strong>{shortName(item)}</strong><small>{item.completedStagesCount}/{item.totalStagesCount}</small></span>
      </button></li>)}</ol>
    </nav>

    <div className="campaign-world-summary"><div><span className="campaign-world-summary__degree">{world.degree}</span><strong>{theme(world)}</strong></div><div className="campaign-world-summary__progress"><span>{world.completedStagesCount}/{world.totalStagesCount} étapes</span><div className="campaign-progress" role="progressbar" aria-label="Progression du monde" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{width:`${progress}%`}}/></div></div></div>
    {message&&<p className="campaign-message" role="status">{message}</p>}

    <div className="campaign-map" aria-label={`Carte des étapes de ${world.name}`} style={{backgroundImage:`linear-gradient(rgba(8,13,24,.1),rgba(8,13,24,.18)),url(${getCampaignWorldMap(world.id)})`}}>
      <ol className="campaign-stages-list">{world.stages.map((item,index)=>{const point=getCampaignStagePoint(world.id,index,world.stages.length);const selected=item.id===stage?.id;const boss=index===world.stages.length-1;return <li key={item.id} className="campaign-stage-item" style={{left:`${point.left}%`,top:`${point.top}%`}}><button type="button" className={`campaign-stage-node is-${item.status.toLowerCase()} ${selected?"is-selected":""} ${boss?"is-boss":""}`} onClick={()=>setStageId(item.id)} aria-label={`${item.name} - ${item.isCompleted?"Terminée":item.isLocked?"Verrouillée":"Disponible"}`} aria-pressed={selected}>
        {item.isCompleted?<Check size={22} strokeWidth={3}/>:item.isLocked?<Lock size={19}/>:boss?<Star size={25} fill="currentColor"/>:<span>{item.stageNumber}</span>}
      </button></li>})}</ol>

      {stage&&<article className="campaign-stage-card" aria-live="polite">
        <div className="campaign-stage-card__topline"><span className="campaign-type-pill">{theme(world)}</span><span className={`campaign-stage-status is-${stage.status.toLowerCase()}`}>{stage.isCompleted?"Terminée":stage.isLocked?"Verrouillée":"Disponible"}</span></div>
        <div className="campaign-stage-card__identity"><Image src={stage.trainerSprite} alt="" width={62} height={62} className="campaign-stage-card__sprite"/><div><span>Épreuve {stage.stageNumber}</span><h2>{stage.name}</h2></div></div>
        <p className="campaign-stage-card__trainer">Adversaire <strong>{stage.trainerName}</strong></p><p className="campaign-stage-card__description">{stage.description}</p>
        <div className="campaign-stage-card__meta"><span aria-label={`Difficulté ${Math.min(5, Math.max(1, Math.ceil(stage.recommendedLevel / 20)))} sur 5`}><Sparkles size={15}/> Niveau {stage.recommendedLevel}</span><span><Coins size={15}/> {stage.rewardMoney}</span><span>+{stage.rewardXp} XP</span></div>
        <button type="button" className="campaign-fight-button" onClick={()=>launch(stage)} disabled={stage.isLocked||launching!==null} aria-label={`${stage.isCompleted?"Rejouer":"Lancer le combat"} : ${stage.name}`}>
          {launching===stage.id?"Préparation...":stage.isLocked?<><Lock size={16}/> Verrouillé</>:<><Swords size={17}/> {stage.isCompleted?"Rejouer":"Combattre"}</>}
        </button>
      </article>}
      <div className="campaign-map-legend" aria-label="Légende de la carte"><span><i className="is-completed"><Check size={10}/></i>Terminé</span><span><i className="is-accessible"/>Disponible</span><span><i className="is-locked"><Lock size={9}/></i>Verrouillé</span></div>
    </div>
  </section>;
}
