#!/bin/bash
# usage: wmsearch.sh out.txt "query1" "query2" ... — Wikimedia Commons file search, slow to respect rate limits
out=$1; shift; : > $out
sleep 45
for q in "$@"; do
  for try in 1 2 3; do
    r=$(curl -sS -A "KonvwaVideo/1.0 (+https://github.com/shelohermituss-hub/konvwa)" "https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$q")&srnamespace=6&format=json&srlimit=12")
    if echo "$r" | grep -q '"search"'; then echo "== $q" >> $out; echo "$r" | python3 -I -c "import sys,json;[print(x['title']) for x in json.load(sys.stdin)['query']['search']]" >> $out; break; fi
    sleep 40
  done
  sleep 30
done
echo DONE >> $out
