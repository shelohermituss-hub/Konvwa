# Rendre un film KONVWA (moteur Blender) sur RunPod, sans passer par Claude

Le script `videos/_konvwa/runpod_render.sh` fait tout sur une machine à carte NVIDIA : il installe Blender, récupère le dépôt (moteur
et outils), télécharge ton zip, repère le projet, mesure la vitesse sur 3 images (affiche l'estimation du temps), rend le film,
puis met le MP4 à disposition sur une adresse web.

## 1. Préparer le zip
- Un dossier de film KONVWA/Blender zippé : il doit contenir `project.json` et `assemble.json` (au premier niveau du film), les
  fichiers de plan `sNN.py`, et `audio/` avec la voix.
- La voix est reconnue sous les noms `audio/voice.*`, sinon `audio/clean.wav`, `source.wav` ou `raw.wav` ; les sous-titres viennent de
  `audio/words.json`, ou sont refaits depuis `audio/timeline.json`. Sans voix : vidéo muette.
- Style Blender uniquement (`konvwa.style` = `blender` ou `mega` ; sans valeur = `blender`).
- Envoie le zip sur Google Drive : clic droit > Partager > « Toute personne disposant du lien » (lecteur). **Sans ce partage la machine
  ne peut pas le télécharger.** Copie le lien.
- Inutile de mettre `shots/`, `renders/` ou `.suite/` dans le zip (ça l'alourdit : le film Marmelade pèse quelques Mo, un film de
  813 Mo contenait 26 000 fichiers de rendus).

## 2. Créer la machine (console.runpod.io > Pods > Deploy)
1. **GPU** : RTX 4090, **Community Cloud** (≈ 0,34 $/h ; si indisponible, Secure Cloud ≈ 0,89 $/h).
2. **Image** : `ubuntu:22.04` (champ « Container Image »).
3. **Disque** : Container Disk **80 Go** (le rendu écrit 15 à 25 Go d'images). Si la console propose un « Volume Disk », mets 80 Go
   aussi (monté sur `/workspace`).
4. **Ports** : ajoute `8000` en **HTTP**.
5. **Variables d'environnement** : `NVIDIA_DRIVER_CAPABILITIES` = `all`.
6. **Container Start Command** (Edit / « Override » selon l'écran) : colle cette ligne, en remplaçant `LIEN_DRIVE` par ton lien :

```
bash -c "mkdir -p /workspace && apt-get update -qq && apt-get install -y -qq curl ca-certificates && curl -fsSL https://raw.githubusercontent.com/shelohermituss-hub/Konvwa/ccr-84eb92fb-rldiwe/videos/_konvwa/runpod_render.sh -o /workspace/runpod_render.sh && bash /workspace/runpod_render.sh --zip 'LIEN_DRIVE' 2>&1 | tee /workspace/render.log; sleep 14400"
```
7. Deploy. La machine démarre et lance le rendu toute seule.

## 3. Suivre et récupérer
- **Journal** : bouton « Logs » du pod (ou `https://<id du pod>-8000.proxy.runpod.net/render.log` dans le navigateur). Repères :
  `GPU=`/`NVIDIA GeForce RTX 4090` (carte vue), `BANC D'ESSAI : … s par image -> ETA_RENDU_MIN=…`, `… n/N images`, puis
  `MP4_PRET=<nom>.mp4` et `KONVWA_FIN code=0`.
- **Vidéo** : `https://<id du pod>-8000.proxy.runpod.net/<nom du projet>.mp4` (clic droit > Enregistrer sous). L'identifiant du pod
  est dans la console, et le port 8000 apparaît dans « Connect » comme « HTTP Service ».
- **Arrête la machine ensuite** (Terminate), seulement après avoir téléchargé le MP4 : le fichier disparaît avec elle. Une machine
  oubliée continue à coûter 0,34 $/h.

## 4. Si ça échoue
La dernière ligne du journal donne un code : `KONVWA_FIN code=10` Blender ne voit pas la carte (rendu logiciel, trop lent : arrête la
machine) ; `12` zip illisible ou lien non partagé ; `13` pas de `project.json` + `assemble.json` dans le zip ; `15` style non Blender ;
`1` ou autre : erreur de rendu, lis le journal. Envoie le message exact à Claude pour la correction.

## À savoir
- Sortie en 30 i/s (le script passe `--fps60 non`) ; pour du 60 i/s, change `--fps60 non` en `--fps60 dup` dans le script.
- Le dépôt est public : le script ne contient aucun secret. Ne colle jamais une clé d'API RunPod dans un lien ou un fichier.
- Tester d'abord avec le film Marmelade du dépôt : lancer le script **sans** `--zip` (`bash /workspace/runpod_render.sh duc-marmelade`).

## 5. Récupérer les fichiers toi-même (sans Claude)
- Le MP4 et le journal sont servis par la machine sur le port 8000 : `https://<id du pod>-8000.proxy.runpod.net/<nom>.mp4`
  et `.../render.log`. L'identifiant du pod est dans la console RunPod (Pods), et « Connect » montre le port 8000 comme « HTTP Service ».
  Ouvre l'adresse dans ton navigateur, clic droit > Enregistrer sous.
- La machine reste allumée 4 h après la fin du rendu (le script attend), puis le conteneur s'arrête. **Télécharge le fichier avant**, et
  **supprime (Terminate) la machine** dans la console ensuite : elle facture tant qu'elle existe.
- Autre moyen : dans la console, bouton « Connect » > « Start Web Terminal », puis `ls /workspace/out`.

## 6. Rendre un autre film
- **Film Blender (zip fait avec ton outil)** : zippe le dossier du film, partage le zip sur Google Drive (« Toute personne disposant du
  lien »), et mets le lien dans la commande de démarrage de la section 2 (`--zip 'LIEN_DRIVE'`).
- **Film des styles three.js (toon, lowpoly, stickstory, flat…)** : le script est `videos/_konvwa/runpod_web_render.sh <projet>`. Le projet doit être
  **dans le dépôt** (`videos/<projet>/`, poussé sur GitHub). Mets alors cette commande de démarrage (remplace `empereur-norton`) :
```
bash -c "mkdir -p /workspace && apt-get update -qq && apt-get install -y -qq curl ca-certificates && curl -fsSL https://raw.githubusercontent.com/shelohermituss-hub/Konvwa/ccr-84eb92fb-rldiwe/videos/_konvwa/runpod_web_render.sh -o /workspace/runpod_web_render.sh && bash /workspace/runpod_web_render.sh empereur-norton 2>&1 | tee /workspace/render.log; sleep 14400"
```
  Même réglage que la section 2 (RTX 4090, port 8000 HTTP, `NVIDIA_DRIVER_CAPABILITIES=all`, 80 Go). Le journal affiche `WebGL : …` : si ça
  dit SwiftShader ou llvmpipe, Chrome dessine sur le processeur (trop lent) : arrête la machine. Ce script est récent et peut encore avoir des défauts.
