#!/usr/bin/env bash
# Kalıcı defter dalı (D23): operasyonel HTTP defteri (awqat.json) ve Diyanet kota defteri (awqat-kota.json) depodaki
# `kota-defteri` dalında tutulur. Bütün yazan iş akışları aynı concurrency grubundadır (veri-guncelleme), sırayla çalışır.
#   al      → dalı .defter/ altına alır; dal ya da dosyalar yoksa HATA (tüketim sıfırlanmaz, istek gönderilmez)
#   kaydet  → değişiklik varsa commit + fast-forward push (son kota durumu kota-durum.md/json dahil) (her durumda çağrılır: başarısız/yarım çalışmanın istekleri de)
set -euo pipefail
DAL=kota-defteri
case "${1:-}" in
  al)
    git fetch --no-tags --depth=1 origin "$DAL"
    git worktree add --detach .defter FETCH_HEAD >/dev/null
    for f in awqat.json awqat-kota.json; do
      [ -s ".defter/$f" ] || { echo "::error::$DAL dalında $f yok; istek gönderilmeyecek"; exit 1; }
    done
    echo "Defter dalı: $(git -C .defter rev-parse --short HEAD)"
    ;;
  kaydet)
    [ -d .defter ] || { echo "Defter dalı alınmamıştı; kaydedilecek bir şey yok"; exit 0; }
    cd .defter
    git add awqat.json awqat-kota.json
    for f in kota-durum.json kota-durum.md; do [ -f "$f" ] && git add "$f"; done
    if git diff --cached --quiet; then echo "Defter değişmedi"; exit 0; fi
    git -c user.name="github-actions[bot]" -c user.email="41898282+github-actions[bot]@users.noreply.github.com" \
      commit -q -m "defter: ${GITHUB_WORKFLOW:-yerel} #${GITHUB_RUN_ID:-0}"
    git push origin "HEAD:refs/heads/$DAL"
    echo "Defter kaydedildi: $(git rev-parse --short HEAD)"
    ;;
  *) echo "kullanım: $0 al|kaydet" >&2; exit 2 ;;
esac
