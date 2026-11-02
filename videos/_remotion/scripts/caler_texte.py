# Sous-titres du style ANIMÉ : le texte EXACT du script, calé sur les temps de Whisper.
# usage : python3 -I caler_texte.py script.txt words-whisper.json words.json
#   script.txt : le texte lu par la voix (les nombres peuvent être écrits en chiffres, ex. « 20 000 »)
#   words-whisper.json : sortie de mots.py (les mots tels que Whisper les a entendus, avec leurs temps)
# Les mots identiques reprennent les temps de Whisper ; quand Whisper s'est trompé (« sceaux » pour « seaux »),
# le passage est réparti à parts égales sur les mots du script. Espace fine avant « : ? ! » (typographie française).
import difflib, json, re, sys, unicodedata

txt, wpath, out = sys.argv[1], sys.argv[2], sys.argv[3]
toks = []
for t in open(txt, encoding="utf-8").read().split():
    if re.fullmatch(r"[\W_]+", t) and toks: toks[-1] += t  # ponctuation isolée : collée au mot précédent
    else: toks.append(t)
w = json.load(open(wpath, encoding="utf-8"))
norm = lambda s: unicodedata.normalize("NFD", s.lower()).encode("ascii", "ignore").decode().strip(".,;:!?…'’ ")
A, B = [norm(t) for t in toks], [norm(x["text"]) for x in w]
times = [None] * len(toks)
for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, A, B, autojunk=False).get_opcodes():
    if tag == "equal":
        for k in range(i2 - i1): times[i1 + k] = (w[j1 + k]["start"], w[j1 + k]["end"])
    elif tag in ("replace", "delete"):
        if j2 > j1: s0, e0 = w[j1]["start"], w[j2 - 1]["end"]
        else: s0 = w[j1 - 1]["end"] if j1 > 0 else 0.3; e0 = w[j1]["start"] if j1 < len(w) else s0 + 0.3
        n = i2 - i1
        for k in range(n): times[i1 + k] = (s0 + (e0 - s0) * k / n, s0 + (e0 - s0) * (k + 1) / n)
words = [{"text": re.sub(r"(?<=\w)([:?!])$", " \\1", t), "start": round(a, 3), "end": round(b, 3)} for t, (a, b) in zip(toks, times)]
for i in range(1, len(words)):  # temps toujours croissants
    if words[i]["start"] < words[i - 1]["start"]: words[i]["start"] = words[i - 1]["end"]
json.dump(words, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
print(len(words), "mots,", words[-1]["end"], "s")
