#!/usr/bin/env bash
# Rendu d'un film KONVWA (moteur Blender) sur une machine RunPod avec carte NVIDIA, puis le MP4 servi sur le port 8000.
#   runpod_render.sh [--zip <lien Google Drive | identifiant | adresse .zip>] [<projet>]
# - sans --zip : rend le film <projet> du dépôt (par défaut duc-marmelade) ;
# - avec --zip : télécharge le zip du client, repère le dossier du projet (project.json + assemble.json), le range dans
#   videos/<nom>/ et le rend.
# Le journal complet est dans /workspace/render.log ; le MP4 et le journal sont servis par /workspace/out sur le port 8000
# (adresse https://<id du pod>-8000.proxy.runpod.net/). Dernière ligne écrite : « KONVWA_FIN code=<n> ».
# Aucun secret : le dépôt et le zip sont publics.
set -euo pipefail
ZIP="${KONVWA_ZIP:-}"
PROJET=""
while [ $# -gt 0 ]; do
  case "$1" in
    --zip) ZIP="$2"; shift 2;;
    *) PROJET="$1"; shift;;
  esac
done
REPO="${KONVWA_REPO:-shelohermituss-hub/Konvwa}"
BRANCHE="${KONVWA_BRANCHE:-ccr-84eb92fb-rldiwe}"
BLV="${KONVWA_BLENDER:-5.2.3}"
W=/workspace
mkdir -p "$W/out"
cd "$W"
ln -sf "$W/render.log" "$W/out/render.log" 2>/dev/null || true
export CZ_POST_RASTER=1      # sous-titres dessinés avec la police épaisse du pack (pas d'Arial Black sur Linux)

etape() { echo; echo "== $(date -u +%H:%M:%S) $*"; }
fin() { echo "KONVWA_FIN code=$1"; }

etape "1/6 Paquets système"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq git curl ca-certificates ffmpeg xz-utils unzip python3 python3-venv python3-pip \
  libegl1 libgl1 libglu1-mesa libxi6 libxrender1 libxkbcommon0 libsm6 libxfixes3 libxxf86vm1 libx11-6 libxext6 >/dev/null
# serveur du MP4 : seulement /workspace/out
(cd "$W/out" && nohup python3 -m http.server 8000 >/dev/null 2>&1 &) || true

# ffmpeg d'Ubuntu 22.04 (4.4) ne sait pas le « sidechaincompress » du mix du pack : on prend un ffmpeg statique récent (sinon le mix de secours de konvwa est utilisé).
if ! timeout 60 ffmpeg -hide_banner -f lavfi -i "sine=d=0.2" -f lavfi -i "sine=d=0.2" -filter_complex "[0:a]apad[a];[1:a]apad[b];[a][b]sidechaincompress[o]" -map "[o]" -t 1 -f null - >/dev/null 2>&1; then
  ( cd /tmp && curl -fsSL --connect-timeout 30 --speed-limit 50000 --speed-time 60 -o ff.tar.xz https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz && tar xf ff.tar.xz && cp ffmpeg-*-static/ffmpeg ffmpeg-*-static/ffprobe /usr/local/bin/ && echo "   ffmpeg récent installé" ) || echo "   (ffmpeg récent non installé : mix de secours)"
fi

etape "2/6 Blender $BLV et la carte graphique"
if [ ! -x "$W/blender/blender" ]; then
  MAJ="${BLV%.*}"; BASE="https://download.blender.org/release/Blender${MAJ}"; F="blender-${BLV}-linux-x64.tar.xz"
  if ! curl -fsSLI --max-time 60 "$BASE/$F" >/dev/null 2>&1; then
    F=$(curl -fsSL --max-time 60 "$BASE/" | grep -o 'blender-[0-9.]*-linux-x64.tar.xz' | sort -uV | tail -1)
    echo "   $BLV introuvable, on prend $F"
  fi
  curl -fsSL --connect-timeout 30 --speed-limit 50000 --speed-time 60 "$BASE/$F" -o /tmp/blender.tar.xz
  mkdir -p "$W/blender" && tar -xJf /tmp/blender.tar.xz -C "$W/blender" --strip-components=1 && rm /tmp/blender.tar.xz
fi
export CZ_BLENDER="$W/blender/blender"
"$CZ_BLENDER" --version | head -1
nvidia-smi --query-gpu=name,driver_version,memory.total --format=csv,noheader 2>/dev/null || echo "   (nvidia-smi absent)"
GPU=$("$CZ_BLENDER" -b --factory-startup --python-expr "import gpu; print('GPU=' + gpu.platform.renderer_get())" 2>/dev/null | grep '^GPU=' || true)
echo "   ${GPU:-GPU= (non lue)}"
case "$GPU" in
  *llvmpipe*|*softpipe*) echo "!! Blender ne voit pas la carte NVIDIA (rendu logiciel, très lent). ARRÊT."; fin 10; exit 10;;
esac

etape "3/6 Le dépôt KONVWA (moteur et outils)"
if [ ! -d "$W/Konvwa/.git" ]; then
  git clone --depth 1 -b "$BRANCHE" "https://github.com/$REPO.git" "$W/Konvwa"
else
  git -C "$W/Konvwa" pull --ff-only || true
fi
cd "$W/Konvwa"
python3 videos/_konvwa/konvwa.py installer >/tmp/installer.log 2>&1 || { tail -20 /tmp/installer.log; echo "!! installation des outils Python échouée"; fin 11; exit 11; }

if [ -n "$ZIP" ]; then
  etape "4/6 Le zip du client"
  ID=$(printf '%s' "$ZIP" | sed -nE 's#.*/d/([A-Za-z0-9_-]{20,}).*#\1#p; s#.*[?&]id=([A-Za-z0-9_-]{20,}).*#\1#p' | head -1)
  [ -z "$ID" ] && case "$ZIP" in http*) ID="";; *) ID="$ZIP";; esac
  if [ -n "$ID" ]; then URL="https://drive.usercontent.google.com/download?id=${ID}&export=download&confirm=t"; else URL="$ZIP"; fi
  for essai in 1 2 3 4 5 6 7 8 9 10 11 12; do
    curl -fL -C - -sS --speed-limit 100000 --speed-time 30 -o "$W/projet.zip" "$URL" && break
    echo "   téléchargement interrompu (essai $essai, $(stat -c %s "$W/projet.zip" 2>/dev/null) octets) : reprise"; sleep 5
  done
  if ! unzip -tq "$W/projet.zip" >/dev/null 2>&1 && [ -n "$ID" ]; then
    echo "   le téléchargement direct a donné autre chose qu'un zip : essai avec gdown"
    python3 -m pip install -q gdown && python3 -m gdown "$ID" -O "$W/projet.zip" || true
  fi
  unzip -tq "$W/projet.zip" >/dev/null 2>&1 || { echo "!! le fichier téléchargé n'est pas un zip lisible ($(ls -l "$W/projet.zip" 2>&1 | awk '{print $5}') octets)"; fin 12; exit 12; }
  ls -l "$W/projet.zip" | awk '{print "   zip : " $5 " octets"}'
  rm -rf "$W/projet" && mkdir -p "$W/projet"
  unzip -q -o "$W/projet.zip" -d "$W/projet"
  rm -f "$W/projet.zip"
  echo "   projets trouvés (project.json + assemble.json) :"
  RACINE=""
  while IFS= read -r pj; do
    d=$(dirname "$pj")
    if [ -f "$d/assemble.json" ]; then echo "     $d"; [ -z "$RACINE" ] && RACINE="$d"; fi
  done < <(find "$W/projet" -name project.json -not -path '*/node_modules/*' -not -path '*/_creatorize/*' | sort)
  [ -z "$RACINE" ] && { echo "!! aucun dossier avec project.json et assemble.json dans le zip. Contenu :"; (cd "$W/projet" && find . -maxdepth 3 | head -40); fin 13; exit 13; }
  B=$(basename "$RACINE")
  [ "$RACINE" = "$W/projet" ] && B="film-client"
  PROJET=$(printf '%s' "$B" | tr 'A-Z ' 'a-z-' | tr -cd 'a-z0-9_-')
  [ -z "$PROJET" ] && PROJET="film-client"
  [ -e "videos/$PROJET" ] && PROJET="${PROJET}-client"
  cp -a "$RACINE" "videos/$PROJET"
  echo "   projet : videos/$PROJET"
else
  PROJET="${PROJET:-duc-marmelade}"
fi

etape "4b/6 Audio du projet (voix et mots)"
python3 - "$PROJET" <<'EOF2'
import glob, json, os, shutil, sys
p = os.path.join('videos', sys.argv[1]); A = os.path.join(p, 'audio')
os.makedirs(A, exist_ok=True)
if not glob.glob(os.path.join(A, 'voice.*')):
    for nom in ('clean.wav', 'source.wav', 'raw.wav', 'voix.wav', 'narration.wav') + tuple(os.path.basename(x) for x in sorted(glob.glob(os.path.join(A, '*.mp3')) + glob.glob(os.path.join(A, '*.m4a')))):
        if os.path.exists(os.path.join(A, nom)):
            shutil.copy(os.path.join(A, nom), os.path.join(A, 'voice' + os.path.splitext(nom)[1]))
            print('   voix : audio/%s -> audio/voice%s' % (nom, os.path.splitext(nom)[1])); break
    else:
        print('   (!) aucune voix trouvée dans audio/')
wj = os.path.join(A, 'words.json')
if not os.path.exists(wj):
    mots = []
    tl = os.path.join(A, 'timeline.json')
    if os.path.exists(tl):
        d = json.load(open(tl, encoding='utf-8-sig'))
        for ph in (d if isinstance(d, list) else d.get('phrases', [])):
            for w in ph.get('words', []):
                mots.append({'word': w.get('w') or w.get('word') or w.get('text', ''), 'start': float(w.get('s', w.get('start', 0))), 'end': float(w.get('e', w.get('end', 0)))})
    if mots:
        json.dump({'words': mots}, open(wj, 'w', encoding='utf-8'), ensure_ascii=False)
        print('   words.json : %d mots refaits depuis audio/timeline.json' % len(mots))
    else:
        print('   (!) pas de mots : sous-titres impossibles')
EOF2

etape "4c/6 Chemins Windows de l'outil Creatorize dans le projet"
# Un projet fait sur PC garde parfois des chemins « C:/Users/…/templates/blender/… » : on les redirige vers le moteur du dépôt
# (fichiers du projet seulement, jamais le moteur).
python3 - "$PROJET" "$PWD/videos/_creatorize/blender" <<'EOF3'
import os, re, sys
p, moteur = os.path.join('videos', sys.argv[1]), sys.argv[2].rstrip('/')
rx = re.compile(r'[A-Za-z]:[\\/]+Users[\\/]+[^"\'\n]*?templates[\\/]+blender(?=[\\/"\'])', re.I)
n = f = 0
for racine, dirs, fichiers in os.walk(p):
    dirs[:] = [d for d in dirs if d not in ('shots', 'renders', '.suite', 'out', 'frames_final', 'node_modules')]
    for nom in fichiers:
        if nom.endswith(('.py', '.json', '.md', '.txt')):
            ch = os.path.join(racine, nom)
            try:
                t = open(ch, encoding='utf-8').read()
            except Exception:
                continue
            t2, k = rx.subn(lambda m: moteur, t)
            if k:
                open(ch, 'w', encoding='utf-8').write(t2); n += k; f += 1
print('   chemins Windows réécrits : %d dans %d fichier(s)' % (n, f))
EOF3

# Filet : si le chemin Windows vient d'ailleurs (scène enregistrée), le même chemin relatif pointe vers le moteur (lien, non versionné).
for u in $(grep -rhoE '[A-Za-z]:/Users/[^/"'"'"']+/AppData/Local/Programs/creatorize-suite/resources/templates/blender' "videos/$PROJET" --include=*.py --include=*.json 2>/dev/null | sort -u | head -3) "C:/Users/GODZYY/AppData/Local/Programs/creatorize-suite/resources/templates/blender"; do
  L="$PWD/videos/_creatorize/blender/$u"; mkdir -p "$(dirname "$L")"; [ -e "$L" ] || ln -s "$PWD/videos/_creatorize/blender" "$L"
done

etape "5/6 Contrôles et banc d'essai de $PROJET"
python3 videos/_konvwa/konvwa.py verifier || true
INFO=$(python3 - "$PROJET" <<'EOF'
import json, os, re, sys
p = os.path.join('videos', sys.argv[1])
m = json.load(open(os.path.join(p, 'project.json'), encoding='utf-8-sig'))
a = json.load(open(os.path.join(p, 'assemble.json'), encoding='utf-8-sig'))
style = m.get('konvwa', {}).get('style', 'blender')
spans = []
for s in a.get('shots', []):
    t = open(os.path.join(p, s + '.py'), encoding='utf-8-sig').read()
    mm = re.search(r'^F0\s*,\s*F1\s*=\s*(\d+)\s*,\s*(\d+)', t, re.M)
    if mm: spans.append((s, int(mm.group(1)), int(mm.group(2))))
total = max(b for _, _, b in spans) if spans else round(float(m.get('end', 0)) * 30)
first = spans[0] if spans else ('s01', 1, 30)
f0, f1 = first[1], first[2]
mid = (f0 + f1) // 2
snd = [os.path.exists(os.path.join(p, 'sons.json')), bool([f for f in os.listdir(os.path.join(p, 'audio')) if f.startswith('voice.')]) if os.path.isdir(os.path.join(p, 'audio')) else False]
print(style, total, first[0], f'{f0 + 8},{mid},{f1 - 8}', int(snd[0]), int(snd[1]))
EOF
) || { echo "!! project.json / assemble.json illisibles"; fin 14; exit 14; }
read -r STYLE TOTAL PREMIER FRAMES SONS VOIX <<<"$INFO"
echo "   style $STYLE, $TOTAL images, premier plan $PREMIER, sons.json=$SONS, voix=$VOIX"
case "$STYLE" in blender|mega) ;; *) echo "!! style « $STYLE » : ce script ne rend que les styles Blender."; fin 15; exit 15;; esac
[ "$VOIX" = "0" ] && echo "   (!) pas de voix audio/voice.* : la vidéo sortira sans son"
T0=$(date +%s)
python3 videos/_konvwa/konvwa.py test "$PROJET" "$PREMIER" --frames "$FRAMES" --scale 1 --samples 48 2>&1 | tail -15 || true
LOG=$(ls -dt "videos/$PROJET"/renders/test/${PREMIER}_r*/ 2>/dev/null | head -1)
if [ -n "$LOG" ] && [ -f "$LOG/log.txt" ]; then
  SPF=$(grep -oE '^CZ frame [0-9]+ [0-9.]+s' "$LOG/log.txt" | awk '{gsub("s","",$4); a[NR]=$4} END{ if (NR>=2) printf "%.1f", (a[NR]+a[NR-1])/2; else if (NR==1) printf "%.1f", a[1] }')
  if [ -n "${SPF:-}" ]; then
    ETA=$(python3 -c "print(round(float('$SPF')*$TOTAL/60))")
    echo "   BANC D'ESSAI : $SPF s par image (pleine taille, 48 échantillons) -> ETA_RENDU_MIN=$ETA minutes pour $TOTAL images (un seul Blender ; le réglage automatique peut faire mieux)"
  fi
fi

etape "5b/6 Son : effets, fond et mix (voix devant, -14 LUFS)"
# sons.json du projet (effets calés sur les mots) + un whoosh à chaque changement de plan ; les effets restent sous la voix (mix du pack : voix au moins 12 dB au-dessus).
python3 videos/_konvwa/konvwa.py son "$PROJET" 2>&1 | tail -40; [ -f "videos/$PROJET/audio/final_mix.wav" ] && echo "   son : final_mix.wav prêt" || echo "(!) son non fait : la voix seule sera utilisée"

etape "6/6 Rendu complet de $PROJET"
# 30 i/s : choix du client. Le moteur garde les images déjà rendues : en cas d'échec on supprime les journaux de plan (un
# vieux « Traceback » les ferait échouer à nouveau) et on relance une fois, ce qui ne refait que les images manquantes.
CODE=1
for essai in 1 2; do
  python3 videos/_konvwa/konvwa.py rendu "$PROJET" --fps60 non && CODE=0 || CODE=$?
  [ "$CODE" = "0" ] && break
  echo "   rendu échoué (essai $essai, code $CODE) : images déjà faites gardées, nouvel essai"
  rm -f "videos/$PROJET"/shots/*_q.log
done
# Images noires ou illisibles ? (le montage ne les signale pas : elles donnent des passages noirs dans la vidéo). On les supprime
# et on les refait avec les réglages d'origine (sans le réglage automatique de vitesse) : le moteur ne rend que les images manquantes.
noires() {
  videos/_konvwa/.venv/bin/python - "videos/$PROJET" <<'EOF3'
import glob, os, sys
from PIL import Image, ImageStat
for p in sorted(glob.glob(os.path.join(sys.argv[1], 'shots', '*', '[0-9]*.png'))):
    try: m = ImageStat.Stat(Image.open(p).convert('L').resize((54, 96))).mean[0]
    except Exception: m = 0   # fichier illisible : à refaire
    if m < 2: print(p)
EOF3
}
if [ "$CODE" = "0" ]; then
  etape "6b/6 Images noires ou illisibles ?"
  NOIRES=$(noires 2>&1 || true)
  N=$(printf '%s\n' "$NOIRES" | grep -c 'png$' || true)
  if [ "${N:-0}" -gt 0 ]; then
    echo "   $N images noires ou illisibles (10 premières) :"; printf '%s\n' "$NOIRES" | head -10
    printf '%s\n' "$NOIRES" | grep 'png$' | xargs rm -f
    python3 videos/_konvwa/konvwa.py rendu "$PROJET" --fps60 non --sans-reglage --jobs 2 && CODE=0 || CODE=$?
    echo "   après nouveau rendu : $(noires 2>&1 | grep -c 'png$' || true) image(s) encore noire(s) (un fondu ou un noir voulu en fait partie)"
  else
    echo "   aucune image noire"
  fi
fi
if [ "$CODE" = "0" ] && [ -f "videos/$PROJET/renders/$PROJET.mp4" ]; then
  cp "videos/$PROJET/renders/$PROJET.mp4" "$W/out/$PROJET.mp4"
  ls -l "$W/out/$PROJET.mp4" | awk '{print "   MP4 : " $5 " octets"}'
  ffprobe -v error -show_entries stream=codec_type,width,height,r_frame_rate,duration -of compact "$W/out/$PROJET.mp4" || true
  echo "MP4_PRET=$PROJET.mp4"
  fin 0
else
  echo "!! le rendu a échoué (code $CODE)"
  fin "${CODE:-1}"
  exit "${CODE:-1}"
fi
