/**
 * Vérifie que le parcours d'écriture de l'app mobile fonctionne toujours.
 *
 * Complément indispensable à `check-admin-users.mjs`, qui ne teste que des
 * lectures. La migration `20260913000000_admin_users.sql` retire la clé
 * étrangère entre `public.users` et `auth.users`, et dix-sept politiques RLS
 * reposent sur l'égalité entre `users.id` et `auth.uid()`. Une lecture qui
 * marche encore ne prouve rien sur les écritures.
 *
 * Le script rejoue donc ce que fait l'app à son premier lancement, avec la
 * clé anonyme et une vraie session : inscription anonyme, création du profil,
 * création du bento, écriture de la télémétrie. Il vérifie aussi que la
 * policy refuse toujours de créer un profil au nom d'autrui.
 *
 * **Il crée un compte réel et le supprime**, compte d'authentification
 * compris, puis contrôle que les compteurs sont revenus à leur valeur.
 * Ne pas l'interrompre en cours de route : il laisserait un orphelin.
 *
 *   set -a && . apps/admin/.env && set +a
 *   ANON="$(grep '^MOBILE_SUPABASE_ANON_KEY=' apps/landing/.env | cut -d= -f2-)" \
 *   MOBILE_SUPABASE_URL="$MOBILE_SUPABASE_URL" \
 *   MOBILE_SUPABASE_SERVICE_ROLE_KEY="$MOBILE_SUPABASE_SERVICE_ROLE_KEY" \
 *     node apps/mobile/scripts/check-write-path.mjs
 *
 * La clé anonyme est lue depuis `apps/landing/.env`, seul fichier qui la
 * porte : `apps/admin/.env` n'a que la service-role du projet mobile.
 */
const U=process.env.MOBILE_SUPABASE_URL;
const S=process.env.MOBILE_SUPABASE_SERVICE_ROLE_KEY;
const A=process.env.ANON;
const svc={apikey:S,authorization:`Bearer ${S}`,'content-type':'application/json'};
let fail=0;
const ok=(l,c,d='')=>{console.log(`  ${c?'ok   ':'ECHEC'} ${l}${d?' '+d:''}`); if(!c)fail++;};

// 1. inscription anonyme, exactement ce que fait l'app au premier lancement
const su=await fetch(`${U}/auth/v1/signup`,{method:'POST',
  headers:{apikey:A,authorization:`Bearer ${A}`,'content-type':'application/json'},body:JSON.stringify({data:{}})});
const sess=await su.json();
ok('inscription anonyme', su.ok && !!sess.access_token, su.ok?`uid ${sess.user?.id?.slice(0,8)}…`:JSON.stringify(sess).slice(0,120));
if(!sess.access_token){console.log('\nimpossible de continuer'); process.exit(1);}
const uid=sess.user.id;
const tok={apikey:A,authorization:`Bearer ${sess.access_token}`,'content-type':'application/json'};

// 2. création du profil sous RLS, comme l'onboarding
const pseudo=`wp${Date.now().toString().slice(-8)}`;
const ins=await fetch(`${U}/rest/v1/users`,{method:'POST',headers:{...tok,Prefer:'return=representation'},
  body:JSON.stringify({id:uid,pseudo,terms_accepted_at:new Date().toISOString()})});
const prof=await ins.json();
ok('création du profil sous RLS', ins.ok, ins.ok?`pseudo ${pseudo}`:JSON.stringify(prof).slice(0,140));

// 3. la policy refuse toujours un id qui n'est pas le sien
const usurp=await fetch(`${U}/rest/v1/users`,{method:'POST',headers:tok,
  body:JSON.stringify({id:'00000000-0000-4000-8000-000000000999',pseudo:`x${Date.now().toString().slice(-7)}`})});
ok("un profil au nom d'autrui est refusé", !usurp.ok, `HTTP ${usurp.status}`);

// 4. création d'un bento, comme ensureBento
const b=await fetch(`${U}/rest/v1/bentos`,{method:'POST',headers:{...tok,Prefer:'return=representation'},
  body:JSON.stringify({user_id:uid})});
const bj=await b.json();
ok('création du bento sous RLS', b.ok, b.ok?'':JSON.stringify(bj).slice(0,140));

// 5. télémétrie : l'app doit pouvoir écrire ses propres colonnes
const tel=await fetch(`${U}/rest/v1/users?id=eq.${uid}`,{method:'PATCH',headers:tok,
  body:JSON.stringify({last_seen_at:new Date().toISOString(),platform:'ios',app_version:'0.1.0'})});
ok('écriture de la télémétrie sous RLS', tel.ok, `HTTP ${tel.status}`);

// 6. Ménage complet. Les deux suppressions sont nécessaires : depuis le
//    retrait de la clé étrangère, supprimer le compte d'authentification ne
//    cascade plus sur le profil.
await fetch(`${U}/auth/v1/admin/users/${uid}`,{method:'DELETE',headers:svc});
await fetch(`${U}/rest/v1/users?id=eq.${uid}`,{method:'DELETE',headers:svc});

// 7. tout est revenu à sa place
const c=async(t,k='id')=>{const r=await fetch(`${U}/rest/v1/${t}?select=${k}`,
  {headers:{apikey:S,authorization:`Bearer ${S}`,Prefer:'count=exact',Range:'0-0'}});
  return Number((r.headers.get('content-range')||'').split('/')[1]);};
let page=1,auth=0;
for(;;){const r=await fetch(`${U}/auth/v1/admin/users?page=${page}&per_page=200`,{headers:{apikey:S,authorization:`Bearer ${S}`}});
  const us=(await r.json()).users||[]; auth+=us.length; if(us.length<200)break; page++;}
ok('auth.users revenu à 106', auth===106, `${auth}`);
ok('users revenu à 70', (await c('users'))===70);
ok('bentos revenu à 56', (await c('bentos'))===56);
console.log(fail===0?'\nParcours d\'écriture intact.':`\n${fail} échec(s).`);
process.exit(fail?1:0);
