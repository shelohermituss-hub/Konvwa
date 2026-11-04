#!/usr/bin/env bash
# Rendu d'un film KONVWA (moteur Blender) sur une machine RunPod avec carte NVIDIA, puis le MP4 dans /workspace.
# À coller dans le terminal web du Pod (modèle « RunPod PyTorch » ou tout Ubuntu avec GPU) :
#   bash <(curl -fsSL https://raw.githubusercontent.com/<compte>/<dépôt>/<branche>/videos/_konvwa/runpod_render.sh) duc-marmelade
# ou, si le dépôt est privé : copier ce fichier dans le Pod, puis  bash runpod_render.sh duc-marmelade
# Le script demande un jeton GitHub (lecture seule) seulement si le dépôt n'est pas encore cloné. Rien n'est enregistré.
set -euo pipefail
PROJET="${1:-duc-marmelade}"
REPO="${KONVWA_REPO:-shelohermituss-hub/Konvwa}"
BRANCHE="${KONVWA_BRANCHE:-ccr-84eb92fb-rldiwe}"
BLV="${KONVWA_BLENDER:-5.2.3}"
W=/workspace
cd "$W"

echo "== 1/5 Paquets système (ffmpeg, bibliothèques d'affichage pour Blender sans écran)"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq git ffmpeg xz-utils python3-venv libegl1 libgl1 libglu1-mesa libxi6 libxrender1 libxkbcommon0 libsm6 libxfixes3 libxxf86vm1 >/dev/null

echo "== 2/5 Blender $BLV"
if [ ! -x "$W/blender/blender" ]; then
  MAJ="${BLV%.*}"
  curl -fsSL "https://download.blender.org/release/Blender${MAJ}/blender-${BLV}-linux-x64.tar.xz" -o /tmp/blender.tar.xz
  mkdir -p "$W/blender" && tar -xJf /tmp/blender.tar.xz -C "$W/blender" --strip-components=1 && rm /tmp/blender.tar.xz
fi
export CZ_BLENDER="$W/blender/blender"
# La carte graphique est-elle vue par Blender sans écran ? (sinon EEVEE tourne en logiciel : très lent)
GPU=$("$CZ_BLENDER" -b --factory-startup --python-expr "import gpu; print('GPU=' + gpu.platform.renderer_get())" 2>/dev/null | grep '^GPU=' || true)
echo "   $GPU"
case "$GPU" in *llvmpipe*|*softpipe*|"") echo "!! Blender ne voit pas la carte NVIDIA (rendu logiciel, très lent). Arrêt : envoie ce message à Claude."; exit 1;; esac

echo "== 3/5 Le dépôt KONVWA"
if [ ! -d "$W/Konvwa/.git" ]; then
  if git ls-remote "https://github.com/$REPO.git" >/dev/null 2>&1; then
    git clone --depth 1 -b "$BRANCHE" "https://github.com/$REPO.git" "$W/Konvwa"
  else
    read -rsp "Jeton GitHub (lecture seule, il ne sera pas enregistré) : " TOK; echo
    git clone --depth 1 -b "$BRANCHE" "https://x-access-token:${TOK}@github.com/$REPO.git" "$W/Konvwa"
    git -C "$W/Konvwa" remote set-url origin "https://github.com/$REPO.git"
    unset TOK
  fi
else
  git -C "$W/Konvwa" pull --ff-only || true
fi
cd "$W/Konvwa"

echo "== 4/5 Python des outils (Pillow, numpy, OpenCV, scipy)"
python3 videos/_konvwa/konvwa.py installer >/dev/null
python3 videos/_konvwa/konvwa.py verifier || true

echo "== 5/5 Rendu de $PROJET (réglage automatique pour cette carte, puis les plans, le montage, le son)"
python3 videos/_konvwa/konvwa.py rendu "$PROJET"
cp "videos/$PROJET/renders/$PROJET.mp4" "$W/$PROJET.mp4"
echo
echo "Terminé : $W/$PROJET.mp4"
echo "Télécharge-le depuis JupyterLab (panneau de fichiers à gauche, clic droit > Download), puis ARRÊTE le Pod (Stop / Terminate) pour ne plus payer."
