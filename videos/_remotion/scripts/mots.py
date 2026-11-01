# words.json pour le style ANIMÉ (français) : python3 scripts/mots.py transcription.out words.json [décalage_s]
# Entrée : la sortie JSON ligne par ligne de `npx hyperframes transcribe voix.wav -m medium -l fr --json`
# (Whisper, mots horodatés). Sortie : [{"text", "start", "end"}, ...], le format que lisent story.ts (à la main)
# et templates/audio/timeline.py + mix.py (ducking de la musique pendant la voix).
# La ponctuation isolée (« ? », « ! », « : », « … ») est retirée. Relire ensuite les nombres écrits en lettres et
# les mots que Whisper place dans une pause : tout le minutage de la vidéo part de ce fichier.
import json, sys

src, out = sys.argv[1], sys.argv[2]
off = float(sys.argv[3]) if len(sys.argv) > 3 else 0.0
words = []
for line in open(src, encoding="utf-8"):
    line = line.strip()
    if not line.startswith("{"):
        continue
    d = json.loads(line)
    if d.get("type") != "words":
        continue
    for w in d["words"]:
        if w["text"].strip() in ("?", "!", ":", ";", "…", "»", "«"):
            continue
        words.append({"text": w["text"].strip(), "start": round(w["start"] + off, 3), "end": round(w["end"] + off, 3)})
json.dump(words, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
print(len(words), "mots,", words[-1]["end"] if words else 0, "s")
