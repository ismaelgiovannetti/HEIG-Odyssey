import os
import subprocess
import sys

# Force UTF-8 output on Windows terminal
if sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

TRACKS = [
    # Thèmes de Boss & Combats
    ("hooh-battle-hgss", "Pokemon HeartGold SoulSilver Ho-oh Battle Music OST"),
    ("champion-cynthia-dpp", "Pokemon Diamond Pearl Cynthia Battle Music OST"),
    ("zinnia-battle-oras", "Pokemon Omega Ruby Alpha Sapphire Zinnia Battle Music OST"),
    ("gym-leader-rse", "Pokemon Ruby Sapphire Emerald Gym Leader Battle Music OST"),
    ("gym-leader-hgss", "Pokemon HeartGold SoulSilver Kanto Gym Leader Battle Music OST"),
    ("champion-alder-bw", "Pokemon Black White Champion Alder Battle Music OST"),
    ("gym-leader-dpp", "Pokemon Diamond Pearl Platinum Gym Leader Battle Music OST"),
    ("champion-diantha-xy", "Pokemon XY Champion Diantha Battle Music OST"),
    ("boss-lysandre-xy", "Pokemon XY Team Flare Boss Lysandre Battle Music OST"),
    ("chairman-rose-swsh", "Pokemon Sword Shield Chairman Rose Battle Music OST"),
    ("n-final-battle-bw", "Pokemon Black White N Final Battle Music OST"),
    ("giratina-battle-pla", "Pokemon Legends Arceus Giratina Battle Music OST"),
    ("boss-giovanni-usum", "Pokemon UltraSun UltraMoon Rocket Boss Giovanni Battle Music OST"),
    ("battle-theme-1", "Pokemon Diamond Pearl Wild Pokemon Battle Music OST"),
    ("victory-theme", "Pokemon Diamond Pearl Trainer Battle Victory Music OST"),
    ("defeat-theme", "Pokemon HeartGold Defeat Battle Music OST"),
    # Thèmes d'ambiance et menus
    ("route-1", "Pokemon HeartGold SoulSilver Route 30 Music OST"),
    ("pokemon-center", "Pokemon HeartGold SoulSilver Pokemon Center Music OST"),
    ("pc-box", "Pokemon HeartGold SoulSilver Pokemon Box Bills PC Music OST"),
    ("town", "Pokemon HeartGold SoulSilver Cherrygrove City Music OST"),
    # Thèmes de campagne
    ("campaign-bachelor", "Pokemon HeartGold SoulSilver Route 29 Theme OST"),
    ("campaign-master", "Pokemon HeartGold Goldenrod City OST"),
    ("campaign-doctorat", "Pokemon HeartGold SoulSilver Indigo Plateau Pokemon League Music OST"),
]

DEST_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "audio", "tracks")
os.makedirs(DEST_DIR, exist_ok=True)

print(f"Téléchargement des {len(TRACKS)} pistes audio via yt-dlp dans {DEST_DIR}...")

for track_id, query in TRACKS:
    dest_file = os.path.join(DEST_DIR, f"{track_id}.mp3")
    print(f"\n-> [{track_id}] Recherche : '{query}'...")
    
    cmd = [
        sys.executable,
        "-m", "yt_dlp",
        "--default-search", "ytsearch1",
        "--extract-audio",
        "--audio-format", "mp3",
        "--audio-quality", "0",
        "--max-filesize", "25M",
        "--output", os.path.join(DEST_DIR, f"{track_id}.%(ext)s"),
        "--no-playlist",
        "--force-overwrites",
        query
    ]
    
    try:
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="utf-8", errors="replace")
        if res.returncode == 0 and os.path.exists(dest_file):
            size_kb = os.path.getsize(dest_file) / 1024
            print(f"  [OK] Téléchargé avec succès : {track_id}.mp3 ({size_kb:.1f} KB)")
        else:
            print(f"  [WARN] Erreur pour {track_id} : {res.stderr[:200]}")
    except Exception as e:
        print(f"  [WARN] Exception : {e}")

print("\nTous les téléchargements sont terminés !")
