"use client";

import Image from "next/image";
import { useState, type CSSProperties } from "react";
import { Check, Coins, GraduationCap, Lock, MapPinned, Sparkles, Star, Swords, Trophy } from "lucide-react";
import type { CampaignProgressOverview, CampaignStageView, CampaignWorldView } from "@/lib/campaign/campaign-service";

interface CampaignMapProps { overview: CampaignProgressOverview; }
type MapPoint = { left: number; top: number };

const WORLD_MAPS: Record<string, string> = Object.fromEntries(
  ["bachelor-1", "bachelor-2", "bachelor-3", "bachelor-4", "bachelor-5", "master-1", "master-2", "doctorat"]
    .map((id) => [id, `/campaign/maps/${id}.png`]),
);

// Coordonnées des plateformes peintes. Le dernier point est toujours l'arène du boss.
const points = (pairs: [number, number][]): MapPoint[] =>
  pairs.map(([left, top]) => ({ left, top }));
const WORLD_POINTS: Record<string, MapPoint[]> = {
  "bachelor-1": points([[14,82],[27,72],[37,63],[48,54],[58,44],[71,30],[87,17]]),
  "bachelor-2": points([[12,81],[22,72],[33,63],[43,55],[53,48],[62,40],[73,31],[85,16]]),
  "bachelor-3": points([[16,80],[30,84],[43,73],[56,66],[67,56],[54,43],[42,49],[57,34],[82,16]]),
  "bachelor-4": points([[9,86],[18,76],[31,67],[48,59],[54,47],[42,37],[48,22],[61,28],[74,25],[87,14]]),
  "bachelor-5": points([[10,83],[22,70],[33,62],[43,56],[53,49],[62,43],[70,36],[76,29],[82,23],[87,17],[91,13]]),
  "master-1": points([[12,83],[27,86],[42,76],[57,75],[71,68],[63,57],[51,51],[37,57],[26,59],[39,43],[52,33],[82,15]]),
  "master-2": points([[12,84],[25,84],[35,75],[46,68],[56,61],[67,59],[75,50],[63,46],[50,42],[38,52],[29,61],[48,34],[84,16]]),
  doctorat: points([[17,78],[34,64],[49,51],[63,40],[75,29],[87,16]]),
};

const WORLD_ACCENTS: Record<string, string> = {
  "bachelor-1":"#7993aa", "bachelor-2":"#59a967", "bachelor-3":"#f1b82d",
  "bachelor-4":"#c56f35", "bachelor-5":"#a45de2", "master-1":"#8a50b8",
  "master-2":"#63bde8", doctorat:"#e6b84f",
};

function getStagePoint(worldId: string, index: number, total: number) {
  const points = WORLD_POINTS[worldId] ?? WORLD_POINTS["bachelor-1"];
  if (index === total - 1) return points.at(-1)!;
  return points[index] ?? { left: 10 + index * (80 / Math.max(1, total - 1)), top: 70 };
}
const shortName = (world: CampaignWorldView) => world.name.split(" - ")[0];
const theme = (world: CampaignWorldView) => world.name.split(" - ")[1]?.replace(/^Type /, "") ?? world.degree;

export function CampaignMap({ overview }: Readonly<CampaignMapProps>) {
  const [worldId, setWorldId] = useState(overview.currentWorldId);
  const [stageId, setStageId] = useState<string | null>(overview.nextRecommendedStage?.id ?? null);
  const [launching, setLaunching] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
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
      const response = await fetch("/api/battle/start", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({stageId:target.id}) });
      const data = await response.json();
      setMessage(response.ok && data.success ? `Combat initialisé contre ${data.trainer.name} !` : data.error ?? "Impossible de lancer le combat. Vérifiez votre équipe active.");
    } catch { setMessage("Une erreur de communication est survenue lors du démarrage du combat."); }
    finally { setLaunching(null); }
  };

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

    <div className="campaign-world-summary"><div><span className="campaign-world-summary__degree">{world.degree}</span><strong>{theme(world)}</strong></div><div className="campaign-world-summary__progress"><span>{world.completedStagesCount}/{world.totalStagesCount} étapes</span><div className="campaign-progress" aria-label={`Progression du monde : ${progress}%`}><span style={{width:`${progress}%`}}/></div></div></div>
    {message&&<p className="campaign-message" role="status">{message}</p>}

    <div className="campaign-map" aria-label={`Carte des étapes de ${world.name}`} style={{backgroundImage:`linear-gradient(rgba(8,13,24,.1),rgba(8,13,24,.18)),url(${WORLD_MAPS[world.id]})`}}>
      <ol className="campaign-stages-list">{world.stages.map((item,index)=>{const point=getStagePoint(world.id,index,world.stages.length);const selected=item.id===stage?.id;const boss=index===world.stages.length-1;return <li key={item.id} className="campaign-stage-item" style={{left:`${point.left}%`,top:`${point.top}%`}}><button type="button" className={`campaign-stage-node is-${item.status.toLowerCase()} ${selected?"is-selected":""} ${boss?"is-boss":""}`} onClick={()=>setStageId(item.id)} aria-label={`${item.name} - ${item.isCompleted?"Terminée":item.isLocked?"Verrouillée":"Disponible"}`} aria-pressed={selected}>
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
