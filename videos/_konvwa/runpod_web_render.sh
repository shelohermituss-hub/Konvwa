#!/usr/bin/env bash
# Rendu d'un film KONVWA des styles three.js (toon, lowpoly, stickstory, flat…) sur une machine RunPod à carte NVIDIA.
#   runpod_web_render.sh <projet>          (le projet doit être dans le dépôt : videos/<projet>)
# Installe Node, Chrome (Chrome for Testing), un ffmpeg récent ; vérifie que Chrome dessine sur la CARTE (sinon arrêt code 10) ;
# puis « konvwa rendu <projet> » ; le MP4 est servi sur le port 8000 (/workspace/out). Dernière ligne : « KONVWA_FIN code=<n> ».
set -uo pipefail
PROJET="${1:-empereur-norton}"
REPO="${KONVWA_REPO:-shelohermituss-hub/Konvwa}"; BRANCHE="${KONVWA_BRANCHE:-ccr-84eb92fb-rldiwe}"
W=/workspace; mkdir -p "$W/out"; cd "$W"; ln -sf "$W/render.log" "$W/out/render.log" 2>/dev/null || true
etape() { echo; echo "== $(date -u +%H:%M:%S) $*"; }
fin() { echo "KONVWA_FIN code=$1"; }
etape "1/6 Paquets système"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq git curl ca-certificates ffmpeg xz-utils unzip python3 python3-venv python3-pip libegl1 libgl1 libvulkan1 \
  libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 \
  libpango-1.0-0 libcairo2 libasound2 libx11-xcb1 libxshmfence1 fonts-liberation >/dev/null
(cd "$W/out" && nohup python3 -m http.server 8000 >/dev/null 2>&1 &) || true
nvidia-smi --query-gpu=name,driver_version --format=csv,noheader || echo "(nvidia-smi absent)"
ls /usr/share/glvnd/egl_vendor.d/ 2>/dev/null; ls /usr/lib/x86_64-linux-gnu | grep -i -E "nvidia|EGL" | head -8
etape "2/6 ffmpeg récent, Node, Chrome"
( cd /tmp && curl -fsSL --connect-timeout 30 --speed-limit 50000 --speed-time 60 -o ff.tar.xz https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz && tar xf ff.tar.xz && cp ffmpeg-*-static/ffmpeg ffmpeg-*-static/ffprobe /usr/local/bin/ ) || echo "(ffmpeg récent non installé)"
( cd /tmp && curl -fsSL --connect-timeout 30 --speed-limit 50000 --speed-time 60 -o node.tar.xz https://nodejs.org/dist/v22.11.0/node-v22.11.0-linux-x64.tar.xz && tar xf node.tar.xz && cp -r node-v22.11.0-linux-x64/{bin,lib,include,share} /usr/local/ ) || { echo "!! Node non installé"; fin 11; exit 11; }
( cd /tmp && curl -fsSL --connect-timeout 30 --speed-limit 50000 --speed-time 60 -o chrome.zip https://storage.googleapis.com/chrome-for-testing-public/131.0.6778.85/linux64/chrome-linux64.zip && unzip -q -o chrome.zip && ln -sf /tmp/chrome-linux64/chrome /usr/local/bin/chrome-cft ) || { echo "!! Chrome non installé"; fin 11; exit 11; }
export CZ_BROWSER=/tmp/chrome-linux64/chrome KONVWA_GPU=1
node --version; "$CZ_BROWSER" --version
etape "3/6 Le dépôt KONVWA"
git clone --depth 1 -b "$BRANCHE" "https://github.com/$REPO.git" "$W/Konvwa" || { fin 11; exit 11; }
cd "$W/Konvwa"
python3 videos/_konvwa/konvwa.py installer >/tmp/installer.log 2>&1 || true      # (il se plaint de Blender, inutile ici)
[ -x videos/_konvwa/.venv/bin/python ] || { tail -20 /tmp/installer.log; echo "!! outils Python non installés"; fin 11; exit 11; }
[ -d "videos/$PROJET" ] || { echo "!! pas de projet videos/$PROJET dans le dépôt"; fin 13; exit 13; }
etape "4/6 La carte graphique vue par Chrome"
cat > /tmp/gpu.html <<'EOH'
<canvas id=c></canvas><script>const g=document.getElementById('c').getContext('webgl2')||document.getElementById('c').getContext('webgl');const e=g&&g.getExtension('WEBGL_debug_renderer_info');document.title='R:'+(e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):'no-webgl');document.body.append(document.title)</script>
EOH
R=$("$CZ_BROWSER" --headless=new --no-sandbox --use-gl=angle --use-angle=gl-egl --ignore-gpu-blocklist --enable-unsafe-swiftshader --dump-dom file:///tmp/gpu.html 2>/dev/null | grep -o "R:[^<]*" | head -1)
echo "   WebGL : $R"
case "$R" in *[Ss]wift[Ss]hader*|*llvmpipe*|*[Ss]oftware*|*no-webgl*|"") echo "!! Chrome dessine sur le processeur, pas sur la carte (rendu trop lent). ARRÊT."; fin 10; exit 10;; esac
etape "5/6 Rendu de $PROJET"
python3 videos/_konvwa/konvwa.py rendu "$PROJET" 2>&1
CODE=$?
etape "6/6 Résultat"
MP4=$(ls -t videos/$PROJET/renders/*.mp4 2>/dev/null | head -1)
if [ -n "$MP4" ]; then cp "$MP4" "$W/out/"; echo "MP4_PRET=$(basename "$MP4")"; ls -l "$MP4"; else CODE=1; echo "!! pas de MP4"; fi
fin "$CODE"
sleep 14400
