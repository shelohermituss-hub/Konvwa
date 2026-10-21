#!/bin/bash
# usage: wmget.sh outdir "File name|local.jpg" ...  (slow, with retries)
out=$1; shift; mkdir -p $out
for pair in "$@"; do
  f="${pair%%|*}"; n="${pair##*|}"
  for try in 1 2 3 4; do
    curl -sSL -A "KonvwaVideo/1.0 (+https://github.com/shelohermituss-hub/konvwa)" -o "$out/$n" "https://commons.wikimedia.org/wiki/Special:FilePath/$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$f")?width=1600"
    if file "$out/$n" | grep -qE "JPEG|PNG|GIF"; then echo "ok $n"; break; fi
    sleep 30
  done
  sleep 15
done
echo DONE
