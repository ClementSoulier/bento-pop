#!/usr/bin/env bash
# Validation de la page bento publique en production.
#
#   bash apps/landing/scripts/verify-prod.sh [pseudo] [base-url]
#
# Rejouable autant de fois qu'on veut : lecture seule, aucun effet de bord.
# Sert avant déploiement (pour voir ce qui manque) comme après.

set -uo pipefail

PSEUDO="${1:-keremasan}"
BASE="${2:-https://bento-pop.com}"
CURL=(curl -s --max-time 20)

pass=0; fail=0; warn=0
ok()   { printf "  \033[32m✓\033[0m %s\n" "$1"; pass=$((pass+1)); }
ko()   { printf "  \033[31m✗\033[0m %s\n" "$1"; fail=$((fail+1)); }
note() { printf "  \033[33m!\033[0m %s\n" "$1"; warn=$((warn+1)); }
head_() { printf "\n\033[1m%s\033[0m\n" "$1"; }

status() { "${CURL[@]}" -o /dev/null -w "%{http_code}" "$1"; }
statusn() { "${CURL[@]}" -o /dev/null -w "%{http_code}" --max-redirs 0 "$1"; }
body()   { "${CURL[@]}" "$1"; }

head_ "1. Page publique"
HTML=$(body "$BASE/u/$PSEUDO")
CODE=$(status "$BASE/u/$PSEUDO")
if [ "$CODE" = "200" ]; then ok "/u/$PSEUDO répond 200"
else ko "/u/$PSEUDO répond $CODE (branche non déployée ?)"; fi

[ "$CODE" = "200" ] && {
  grep -q "@$PSEUDO" <<<"$HTML" && ok "le pseudo est affiché" || ko "pseudo absent du HTML"
  n=$(grep -o '<h1' <<<"$HTML" | wc -l | tr -d ' ')
  [ "$n" = "1" ] && ok "un seul <h1>" || ko "$n <h1> dans le document"
  grep -q '/_next/image' <<<"$HTML" && ok "images servies par l'optimiseur" \
    || note "aucune image optimisée (bento sans illustration ?)"
  grep -qE 'https://[a-z0-9]+\.supabase\.co/storage' <<<"$HTML" \
    && ko "URL Supabase brute dans le HTML : egress non maîtrisé" \
    || ok "aucune image chargée en direct depuis Supabase"
}

head_ "2. Codes de statut"
for t in "inconnu-$RANDOM:404" "$PSEUDO:200"; do
  u="${t%%:*}"; want="${t##*:}"; got=$(status "$BASE/u/$u")
  [ "$got" = "$want" ] && ok "/u/$u → $got" || ko "/u/$u → $got (attendu $want)"
done
got=$(statusn "$BASE/u/%25")
[ "$got" = "404" ] && ok "/u/%25 → 404 (pseudo malformé rejeté)" || ko "/u/%25 → $got"
UP=$(printf '%s' "$PSEUDO" | tr '[:lower:]' '[:upper:]')
got=$(statusn "$BASE/u/$UP")
[ "$got" = "308" ] && ok "/u/$UP → 308 (canonicalisation)" || ko "/u/$UP → $got (attendu 308)"

head_ "3. Métadonnées de partage"
if [ "$CODE" != "200" ]; then
  note "ignoré : la page ne répond pas 200, on validerait les métadonnées du 404"
else
for tag in 'og:title' 'og:description' 'og:image' 'og:url' 'twitter:card' 'twitter:image'; do
  v=$(grep -o "<meta \(property\|name\)=\"$tag\" content=\"[^\"]*\"" <<<"$HTML" | head -1 | sed 's/.*content="//;s/"$//')
  if [ -z "$v" ]; then ko "$tag absent"
  elif [[ "$tag" == *image || "$tag" == og:url ]] && [[ "$v" != https://* ]]; then ko "$tag non absolue : $v"
  else ok "$tag → ${v:0:64}"; fi
done
grep -q 'apple-itunes-app' <<<"$HTML" && ok "bannière Smart App iOS" || ko "apple-itunes-app absente"
grep -q 'rel="canonical"' <<<"$HTML" && ok "URL canonique déclarée" || ko "canonical absente"
fi

head_ "4. Image Open Graph"
if [ "$CODE" != "200" ]; then
  note "ignoré : pas de page à inspecter"
else
OG=$(grep -o '<meta property="og:image" content="[^"]*"' <<<"$HTML" | head -1 | sed 's/.*content="//;s/"$//')
if [ -n "$OG" ]; then
  read -r c t s < <("${CURL[@]}" -o /tmp/_og.bin -w "%{http_code} %{content_type} %{size_download}" "$OG")
  [ "$c" = "200" ] && ok "image servie ($c, $t)" || ko "image → $c"
  kb=$((s/1024))
  [ "$s" -lt 307200 ] && ok "poids ${kb} Ko (budget WhatsApp 300 Ko)" || ko "poids ${kb} Ko, au-dessus du budget"
  head -c3 /tmp/_og.bin | od -An -tx1 | grep -q "ff d8 ff" && ok "JPEG valide" || note "pas un JPEG"
else ko "pas d'og:image à tester"; fi
fi

head_ "5. Liens universels"
AASA=$(body "$BASE/.well-known/apple-app-site-association")
grep -q '"paths":\["/u/\*"\]' <<<"$AASA" && ok "AASA déclare /u/*" || ko "AASA incomplet"
grep -qE '"appID":"[A-Z0-9]{10}\.' <<<"$AASA" && ok "APPLE_TEAM_ID posée" || ko "APPLE_TEAM_ID absente"
AL=$(body "$BASE/.well-known/assetlinks.json")
NFP=$(python3 -c "import json,sys;d=json.load(sys.stdin);print(sum(len(e['target']['sha256_cert_fingerprints']) for e in d))" <<<"$AL" 2>/dev/null || echo 0)
case "$NFP" in
  0) ko "assetlinks.json vide : ANDROID_SHA256_FINGERPRINT absente";;
  1) note "1 seule empreinte. Il en faut 2 une fois publié sur le Play Store : clé de signature d'application ET clé d'importation";;
  *) ok "$NFP empreintes déclarées";;
esac
G=$(python3 -c "import json,sys;print(len(json.load(sys.stdin).get('statements',[])))" \
  < <("${CURL[@]}" "https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=$BASE&relation=delegate_permission/common.handle_all_urls") 2>/dev/null || echo 0)
[ "$G" -gt 0 ] && ok "Google voit $G déclaration(s)" || note "Google n'en voit aucune (cache 1 h après modification)"

head_ "6. Revalidation à la demande"
c=$("${CURL[@]}" -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" \
     -d '{"paths":["/"]}' "$BASE/api/revalidate")
case "$c" in
  401) ok "endpoint protégé, REVALIDATE_TOKEN posé";;
  503) ko "503 : REVALIDATE_TOKEN absent côté landing (la revalidation du BO admin est inactive aussi)";;
  *)   ko "réponse inattendue : $c";;
esac

head_ "Résultat"
printf "  %d validés · %d échecs · %d à surveiller\n\n" "$pass" "$fail" "$warn"
[ "$fail" -eq 0 ]
