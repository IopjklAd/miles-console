# MILES — Console de supervision

Interface web de supervision et de contrôle du système robotique **MILES**
(carte ESP32-S3, capteurs, périphériques audio, webcam, orchestrateur logiciel).

La console répond à trois questions en un coup d'œil : **où en est le système**,
**d'où viennent les données affichées**, et **que s'est-il passé récemment**.

> Règle directrice : aucune valeur n'est inventée. Une mesure absente s'affiche
> « Indisponible », une valeur simulée porte l'étiquette « Simulé », et l'envoi
> d'une commande n'est jamais présenté comme sa réussite.

---

## 1. Périmètre de la version 1

Pages réellement implémentées (navigation latérale) :

| Route | Page | Contenu |
| --- | --- | --- |
| `/` | Landing | Présentation, architecture, état des intégrations |
| `/auth` | Connexion | E-mail + code à usage unique, session invitée |
| `/dashboard` | Vue d'ensemble | Cartes d'état, indicateurs techniques, activité récente, actions rapides |
| `/dashboard/assistant` | Assistant IA | Conversation, génération, interruption, réessai, copie, statut du fournisseur |
| `/dashboard/conversations` | Conversations | Historique, recherche, renommage, suppression avec confirmation |
| `/dashboard/capteurs` | Capteurs | Valeurs, validité, historique graphique, seuils, alertes |
| `/dashboard/vision` | Vision | État webcam et flux, résolution, dernière image, commande démarrer/arrêt, détection IA déclarée indisponible |
| `/dashboard/audio` | Audio | Entrées/sorties, niveau dBFS, volume (si contrôlable), capture/lecture, reconnaissance/synthèse indisponibles |
| `/dashboard/journaux` | Journaux | Recherche, filtres niveau/source/période, copie, export |
| `/dashboard/controle` | Contrôle de MILES | État, manifeste de capacités, commandes confirmées, résultats |
| `/dashboard/services` | Services | États des processus, dernière activité/erreur/version, démarrer/arrêter/redémarrer (si le backend l'autorise) |
| `/dashboard/parametres` | Paramètres | Général, source de données, connexion, IA, session |

**Hors périmètre v1** (non listés dans la navigation, donc aucun lien mort) :
page matériel détaillée, modèles IA détaillés, documentation intégrée,
multi-utilisateur avancé.

---

## 2. Stack

- **Frontend** : React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui,
  lucide-react, framer-motion, recharts, react-router v7
- **Backend applicatif** : Convex (schéma, requêtes réactives, actions Node « use node »)
- **Authentification** : Convex Auth (e-mail + OTP, session invitée)
- **IA** : action Convex `src/convex/ai.ts` appelant la passerelle
  d'intégration (`@vly-ai/integrations`) — clé lue côté serveur uniquement
- **Matériel** : API REST du backend MILES (contrat documenté §6), **non connectée aujourd'hui**
- **Tests** : Vitest + Testing Library

---

## 3. Démarrage

Prérequis : [Bun](https://bun.sh), un déploiement Convex (fourni sur la plateforme).

```bash
bun install                # dépendances
cp .env.example .env.local # puis renseignez VITE_MILES_API_BASE_URL si backend réel

# terminal 1 — backend Convex + génération de types
bunx convex dev

# terminal 2 — interface
bun run dev                # http://localhost:5173
```

Sur la plateforme Freebuff, le serveur de dev et `convex dev` sont gérés par
l'environnement : aucune commande de démarrage manuelle n'y est nécessaire.

### Hors de Freebuff : les trois services à prévoir

1. **Convex (obligatoire)** — `bunx convex dev` crée ou cible un déploiement.
   Variables : `CONVEX_DEPLOYMENT`, `VITE_CONVEX_URL`, et **`CONVEX_SITE_URL`**
   (`bunx convex env set CONVEX_SITE_URL https://votre-domaine`) : Convex Auth
   s'y accroche pour l'OIDC discovery ; sans cette variable, la connexion par
   e-mail ne confirme jamais.
2. **Envoi d'e-mails OTP** — `src/convex/auth/emailOtp.ts` poste les codes via
   la passerelle d'intégration (`VLY_INTEGRATION_BASE_URL`, défaut
   `https://integrations.vly.ai`, authentifiée par `VLY_INTEGRATION_KEY`).
   Options si vous n'avez pas cette passerelle (à choisir, **aucune n'est
   appliquée ici**) : fournisseur transactionnel (Resend, SendGrid, Mailgun)
   dans `sendVerificationRequest`, ou SMTP via `nodemailer` — le provider
   Convex Auth `Email` est déjà en place, seul l'envoi change.
3. **Fournisseur IA** — `VLY_INTEGRATION_KEY`, côté serveur Convex :
   `bunx convex env set VLY_INTEGRATION_KEY …`. Option documentée pour s'en
   passer : remplacer l'appel `vly.ai.completion` dans `src/convex/ai.ts`
   (seul fichier fournisseur) par l'API de votre choix ; la liste de modèles
   exposée à l'UI vit dans `src/convex/aiConfig.ts`. Substitution non appliquée
   ici.

La variable métier `VITE_MILES_API_BASE_URL` reste vide tant qu'aucun backend
matériel n'existe → mode démonstration.

### Commandes

| Commande | Rôle |
| --- | --- |
| `bun run dev` | Serveur de développement Vite |
| `bunx convex dev` | Backend Convex + codegen (`_generated`) |
| `bunx convex dev --once` | Codegen unique (nécessite un déploiement) |
| `bunx convex codegen --system-udfs` | Codegen **hors-ligne** : aucun déploiement, aucun secret (utilisé en CI) |
| `bun run typecheck` | `tsc -b --noEmit` |
| `bun run test` | `vitest run` (78 tests ; **pas** `bun test`, voir §9) |
| `bun run lint` | ESLint |
| `bun run build` | Build de production |

---

## 4. Variables d'environnement

Aucun fichier `.env` n'est versionné ; **ce modèle fait foi** — le fichier
`.env.example` du dépôt est verrouillé par la plateforme Freebuff et n'a pas
pu y être actualisé : recopiez-y le bloc ci-dessous après export (il est plus
complet que le fichier actuel) :

```bash
# ---- navigateur (Vite) ----
VITE_CONVEX_URL=            # URL du déploiement Convex
VITE_MILES_API_BASE_URL=    # backend MILES ; vide = mode démonstration
# ---- machine ----
CONVEX_DEPLOYMENT=          # cible de `bunx convex dev`
CONVEX_SITE_URL=http://localhost:5173   # domain du front, requis par Convex Auth
# ---- SERVEUR Convex (bunx convex env set, jamais dans .env.local) ----
VLY_INTEGRATION_KEY=        # clé fournisseur IA / passerelle OTP
VLY_INTEGRATION_BASE_URL=   # passerelle OTP optionnelle (défaut intégré)
```

| Variable | Côté | Rôle |
| --- | --- | --- |
| `VITE_CONVEX_URL` | navigateur | URL du déploiement Convex (fournie) |
| `CONVEX_DEPLOYMENT` | machine | Cible Convex locale |
| `CONVEX_SITE_URL` | **serveur Convex** | Domaine du front, obligatoire pour l'OIDC discovery de Convex Auth |
| `VITE_MILES_API_BASE_URL` | navigateur | Adresse du backend MILES ; **vide → mode démonstration** |
| `VLY_INTEGRATION_KEY` | **serveur Convex** | Clé du fournisseur IA / passerelle OTP (`convex env set`) |
| `VLY_INTEGRATION_BASE_URL` | **serveur Convex** | Passerelle OTP optionnelle, défaut `https://integrations.vly.ai` |

Aucune clé secrète n'est présente dans le dépôt ni dans le bundle frontend ;
`.gitignore` exclut `.env` et `.env.*` (hors `.env.example`).

---

## 5. Architecture du code

```
src/
├── config/app.ts            # URLs d'API centralisées, intervalles, constantes
├── miles/
│   ├── types.ts             # types métier (états, capteurs, journaux, commandes)
│   └── api/
│       ├── contract.ts      # interface MilesApi (la seule chose que voient les pages)
│       ├── client.ts        # fetch : timeout, credentials, erreurs typées
│       ├── schema.ts        # contrats zod du backend (validation stricte)
│       ├── live.ts          # appels REST réels
│       ├── demo.ts          # moteur de simulation (origin: "demo")
│       └── index.ts         # fabrique : createMilesApi("live" | "demo")
├── state/
│   ├── settings.tsx         # paramètres locaux + synchronisation PUT /api/settings
│   ├── miles.tsx            # mode, connexion, unique boucle de polling, notifications
│   └── console-providers.tsx
├── hooks/                   # use-format, use-auth, use-conversations, use-domain
│                             # (use-domain : chargement à la demande des pages
│                             #  services/vision/audio, hors boucle de polling)
├── components/
│   ├── layout/              # AppShell, AppSidebar, AppHeader, ModeBanner, notifications
│   ├── miles/               # Panel, PageHeader, StatusBadge, Feedback, LogoMark
│   ├── dashboard/           # StatusCards, MetricsPanel, ActivityTimeline, QuickActions
│   └── assistant/           # ConversationList, MessageItems, Markdown
├── pages/                   # une page par route (lazily loaded)
├── convex/                  # schéma, conversations, ai (« use node »), auth
└── test/setup.ts            # shims jsdom + cleanup Testing Library
```

Principes : les pages ne connaissent que `MilesApi` (jamais `fetch`), une seule
boucle de polling pour toute l'application, chaque domaine garde son propre
état de chargement/erreur, et le changement de source de données vide les
résultats de l'autre source (aucun mélange réel/simulé).

---

## 6. Contrat d'API attendu du backend MILES

Ces routes sont le **contrat prévu**, pas une API existante : elles renvoient
aujourd'hui `not_configured` tant que `VITE_MILES_API_BASE_URL` est vide.

| Méthode | Route | Usage |
| --- | --- | --- |
| GET | `/api/status` | État général + sous-composants + métriques hôte optionnelles |
| GET | `/api/sensors` | Liste des capteurs et dernière valeur |
| GET | `/api/sensors/history?sensorId=&range=` | Série temporelle (`5m\|30m\|1h\|24h`) |
| GET | `/api/logs?limit=` | Journal d'événements |
| GET | `/api/robot/state` | Connexion ESP32-S3, mode, dernière commande |
| GET | `/api/robot/capabilities` | Manifeste des commandes réellement possibles |
| POST | `/api/robot/commands` | `{ commandId, capabilityId }` → accusé de réception |
| GET/PUT | `/api/settings` | Paramètres persistés + test de connexion |
| GET | `/api/services` | Liste des services : état, version, dernière activité/erreur, `controllable` |
| POST | `/api/services/command` | `{ commandId, serviceId, action: start\|stop\|restart }` → accusé de réception |
| GET | `/api/vision` | Webcam, flux (`idle\|starting\|live\|error`), résolution, `snapshotUrl`, `controllable` |
| POST | `/api/vision/command` | `{ commandId, action: start\|stop }` → accusé de réception |
| GET | `/api/audio` | Entrées/sorties, capture/lecture, `levelDbfs`, `volume`, `volumeControllable` |
| POST | `/api/audio/volume` | `{ volume: 0–100 }` → réglage appliqué côté serveur |

Les trois derniers paires GET/POST sont **attendues du backend** : aujourd'hui
seule la démonstration les répond, et le mode réel affiche « indisponible »
plutôt que de simuler.

Exemple de réponse `/api/status` (les champs absents deviennent « Non exposé ») :

```json
{
  "overall": "degraded",
  "backend": { "status": "operational", "label": "Connecté", "latencyMs": 42 },
  "esp32": { "status": "down", "detail": "port série fermé" },
  "sensors": { "status": "operational" },
  "vision": { "status": "unknown" },
  "audio": { "status": "unknown" },
  "services": { "status": "degraded", "label": "3 / 4 en fonctionnement" },
  "ai": { "status": "operational" },
  "host": { "cpuPercent": 23, "memoryPercent": 41, "uptimeSeconds": 36000 },
  "recentErrorCount": 2
}
```

Exemple de capteur :

```json
{
  "id": "vl53l3cx",
  "name": "VL53L3CX — distance",
  "kind": "distance",
  "link": "connected",
  "value": 412,
  "unit": "mm",
  "at": 1761430000000,
  "threshold": { "enabled": false, "min": 80, "max": 3000 }
}
```

Toute réponse qui ne respecte pas ces schémas est rejetée (`parse`) plutôt que
rendue telle quelle.

---

## 7. Mode réel et mode démonstration

- **Mode démonstration** (défaut sans backend) : moteur local déterministe,
  bandeau permanent « MODE DÉMONSTRATION — DONNÉES SIMULÉES », badge « Simulé »
  sur chaque carte, graphique et entrée de journal. Aucune commande physique
  n'est envoyée.
- **Mode réel** : interrogations périodiques (`GET`), mise à jour toutes les
  `pollIntervalMs` (par défaut 5 s). Sans backend, l'interface affiche
  « Backend non configuré » et propose de basculer en démonstration.
- Le passage de mode vide les données de l'autre source.

---

## 8. Backend Convex et IA

Tables : `conversations` (index `by_user`) et `messages` (index
`by_conversation`) — l'historique ne dépend jamais de la mémoire du navigateur.

Flux d'un message :

1. `conversations.postMessage` écrit le message utilisateur + une réponse
   `pending`, planifie `ai.generate` (schedule) ;
2. `ai.generate` (action Node) relit les 20 derniers messages, appelle le
   fournisseur, puis `completeMessage` ou `failMessage` ;
3. la requête réactive `conversations.messages` met à jour l'interface.

Sécurité : contrôle de propriété à chaque lecture/écriture, longueur de message
limitée (4 000 caractères), modèle validé côté serveur, `stop` → la réponse
fournie est **jetée** si l'utilisateur a interrompu, erreurs du fournisseur
nettoyées des jetons (`sanitizeError`), action de test de connectivité
réservée aux sessions authentifiées.

**Limitation de fréquence (`src/convex/rateLimit.ts`)** — toute dépense de
jetons fournisseur est plafonnée **côté serveur**, dans la transaction même de
la mutation (deux requêtes concurrentes ne peuvent pas passer ensemble), y
compris pour les sessions invitées (anonymes) :

| Cible | Seuil | Mécanisme |
| --- | --- | --- |
| Envoi **et** relance | 10 / 5 min par utilisateur | même seau `ai:gen:<userId>` dans `postMessage` et `retryMessage` |
| Test fournisseur `ai.probe` | 3 / 5 min par identité | `internal.rateLimit.consume` appelé **avant** le provider, clé `ai:probe:<subject>` |

Les clés de seau ne sont construites qu'à un endroit — `generationBucketKey` /
`probeBucketKey` dans `rateLimit.ts` — appelé par les deux mutations : envoyer
et relancer partagent le quota **par construction**, pas par convention.

Fenêtre fixe : pire cas = 2× le seuil à la frontière (≤ 20 générations /
5 min), restreint volontairement simple et testé. Refus explicite avec délai
avant nouvel essai (« Réessayer dans N s ») et compteur non consommé en cas de
refus. Seuils ajustables au haut de `rateLimit.ts`.

Tests : `src/test/rateLimit.test.ts` (décision pure de fenêtre) et
`src/test/rateLimitWiring.test.ts` (câblage serveur : seau partagé,
persistance transactionnelle, refus, isolation par identité, namespaces).
`convex-test` (qui exécute de vraies fonctions Convex) exige un backend en
exécution, absent de la CI : ces tests rejouent donc le même chemin
`ctx.db` avec un magasin en mémoire, sans aucun appel fournisseur.

**Limite assumée (non résoluble par le code seul)** : le quota est **par
identité**. Un abus qui multiplierait les sessions invitées conserve budget
pour chaque nouvelle session — la protection ci-dessous limite les dégâts sans
bloquer l'attaque. Protections complémentaires **proposées, non implémentées**
(elles demandent un choix de produit ou de budget) :

1. **Plafond côté fournisseur** (le plus efficace, aucun code) : budget max /
dépense plafonnée chez le fournisseur IA, y compris en mode dégradé.
2. **Plafond global serveur** : compteur `ai:gen:global` partagé — simple à
ajouter, mais un seul utilisateur abusif coupe alors tout le monde.
3. **Encadrement des sessions invitées** : désactiver la session invitée pour
l'IA (ou la désactiver entièrement) — choix produit, réversible côté Convex Auth.

État vérifié : la passerelle répond (`gpt-4o-mini`, réponse test en ~1,5 s).

---

## 9. Tests

```bash
bun run test        # script package.json = vitest run
```

> Piège documenté : `bun test` (sans `run`) lance le **runner natif de Bun**
> sur les mêmes fichiers et échoue (8/78) — l'environnement jsdom est
> configuré pour Vitest. Utilisez toujours `bun run test`.

9 fichiers, 78 tests :

| Fichier | Couverture |
| --- | --- |
| `src/lib/format.test.ts` | formatage durée/pourcent/heure, « Indisponible » pour valeur absente |
| `src/miles/api/client.test.ts` | refus sans backend, codes d'erreur, message explicites, query string |
| `src/miles/api/schema.test.ts` | validation zod, détection « stale », **une commande sans statut reste « envoyée »**, parseurs `services`/`vision`/`audio` (défauts, rejets de payloads invalides) |
| `src/miles/api/demo.test.ts` | origine `demo` partout, ordre des journaux, fenêtre d'historique, absence de commandes de déplacement, cycle commande/état, **flux vision cohérent avec le service, volume borné** |
| `src/components/miles/StatusBadge.test.tsx` | rendu Markdown, badges lisibles sans se fier à la couleur |
| `src/components/layout/AppSidebar.test.tsx` | navigation complète (10 destinations), aucune entrée vers un module absent |
| `src/state/settings.test.tsx` | repli sur les défauts si stockage corrompu, persistance des seuils |
| `src/test/rateLimit.test.ts` | fenêtre fixe du rate limiter : acceptation, comptage, refus avec délai, réinitialisation, seuils documentés |
| `src/test/rateLimitWiring.test.ts` | câblage serveur : seau partagé envoi/relance, refus sans consommer de slot, compteur persisté entre transactions, isolation par identité, séparation génération/probe |

CI (`.github/workflows/ci.yml`) : install reproductible (`bun install
--frozen-lockfile`, Bun figé à 1.3.14) → **codegen Convex hors-ligne**
(`bunx convex codegen --system-udfs`) → tests → typecheck → lint → build.

Le codegen mérite une note : `bunx convex codegen` « tout court » échoue en
GitHub Actions avec `No CONVEX_DEPLOYMENT set`, parce que la CLI exige des
identifiants de déploiement et que `.env.local` (qui les contient en local)
ne versionne rien. Le drapeau `--system-udfs` emprunte la voie hors-ligne du
CLI (écriture locale de `api`/`dataModel`/`server`, sans réseau ni secret).
Vérifié sur un clone vierge : typecheck, tests et build passent avec cette
génération. Elle n'exporte pas `components`, inutilisé ici.

Le lint n'est plus simplement toléré : le pas échoue dès qu'une **nouvelle**
erreur apparaît, et ne tolère que les 3 erreurs connues du template
(`ui/carousel.tsx:96`, `ui/sidebar.tsx:611`, `hooks/use-mobile.ts:14` ;
25 warnings associés, aucun fichier applicatif concerné).

---

## 10. Reprendre le développement (OpenCode)

- Dépôt autonome : `bun install && bunx convex dev && bun run dev` suffit.
- Aucune dépendance propriétaire indispensable à l'exécution : si la passerelle
  d'intégration disparaît, remplacez l'appel dans `src/convex/ai.ts` (seul
  fichier lié à un fournisseur) sans toucher au reste.
- Points d'extension naturels : nouvelles pages dans `src/pages` + route dans
  `src/main.tsx` + entrée dans `AppSidebar`, nouvelles commandes via le
  manifeste du backend, nouveaux capteurs côté backend (aucune modification de
  l'UI nécessaire pour un capteur standard).
- Export : télécharger le dépôt tel quel ; aucun secret n'y est stocké
  (`.env.example` sans valeurs).
- **Gestion des paquets : Bun uniquement.** `bun.lock` est le seul lockfile
  faisant foi (install, CI). `package-lock.json` a été retiré : il était périmé
  (il ne référençait ni `vitest`, ni `jsdom`, ni `@testing-library/*`, donc
  `npm ci` échouait déjà) et aucun script ni workflow ne l'utilisait. Un
  `npm install` le régénérerait si un environnement en avait besoin — dans ce
  cas, documentez-le comme secondaire ou retirez-le à nouveau.

---

## 11. Limitations connues

1. **Backend MILES non connecté** : `VITE_MILES_API_BASE_URL` est vide, le mode
   réel affiche donc « indisponible » sur toutes les pages matérielles.
2. **Aucun matériel vérifié** : l'état de l'ESP32-S3, des capteurs, de la webcam
   et de l'audio n'a jamais été observé en conditions réelles ; en mode
   démonstration tout est explicitement simulé.
3. **Authentification backend absente** : le backend MILES n'expose pas de
   mécanisme d'authentification documenté (limitation documentée dans
   Paramètres → Sécurité).
4. **Endpoints services/vision/audio non encore servis** : les routes
   `/api/services`, `/api/vision` et `/api/audio` sont contractées et
   affichées par les pages dédiées, mais aucun backend ne les expose encore ;
   en mode réel elles répondent « indisponible », jamais une valeur simulée.
5. **Pas de temps réel continu** : les données sont actualisées par
   interrogation périodique, pas par WebSocket (architecturé pour l'ajouter :
   `state/miles.tsx`).
6. **Quotas et coûts IA non affichés** : le fournisseur ne les expose pas.
7. **Serveur de dev exposé — analyse, aucun changement appliqué.**
   - *Impact dans Freebuff* : `host: true` lie le serveur sur toutes les
     interfaces (0.0.0.0:5173), condition de l'événement « server-ready » que
     la plateforme écoute pour ouvrir le preview ; `allowedHosts: true`
     désactive la vérification de l'en-tête `Host`, nécessaire ici car le
     domaine de preview est généré par environnement et le plugin de la
     plateforme (`vlyPlugin`) est injecté à la volée. Restreindre l'un ou
     l'autre exposerait un risque direct de preview en 403 / HMR cassé.
   - *Vérifications disponibles* : aucune ne permet de prouver qu'une valeur
     restrictive reste compatible sans casser le preview en cours — je ne
     change donc pas ce fichier (règle §12) plutôt que d'appliquer une valeur
     générique non testée.
   - *Risque réel* : rejeu DNS-rebinding contre le serveur de **développement**
     uniquement ; `bun run build` ne sert aucun serveur, le risque ne se
     retrouve pas en production.
   - *Recommandé pour un auto-hébergement* (à appliquer à l'export, après
     validation chez vous) :
     `server: { host: "127.0.0.1", port: 5173, allowedHosts: ["localhost", "<votre-domaine>"] }`
     — ou `host: true` seul si l'accès réseau interne est voulu. **Décision à
     prendre à l'export.**
8. **Rate limit en fenêtre fixe** : 2× le seuil possibles à la frontière d'une
   fenêtre ; suffisant pour un usage humain, à remplacer par une fenêtre
   glissante si le coût par requête augmente.
9. **Quota IA par identité uniquement** : les sessions invitées sont limitées
   comme les comptes, mais multiplier les identités multiplie les budgets. Les
   trois compléments possibles (plafond fournisseur, plafond global, encadrement
   des sessions invitées) sont décrits §8 — choisis, non implémentés.

---

## 12. Conventions de la plateforme (à respecter)

- Ne pas modifier `src/convex/auth.ts`, `src/convex/auth.config.ts`,
  `src/convex/auth/emailOtp.ts` ni `vite.config.ts` (HMR).
- Imports d'alias `@/…` côté frontend ; chemins relatifs dans `src/convex`.
- Toujours passer par `useAuth()` pour l'utilisateur, `RequireAuth` pour les
  routes protégées (`/auth?returnTo=…` conserve la destination).
- shadcn/ui + Tailwind v4 : pas de carte imbriquée, pas d'ombre portée,
  `Loader2` plutôt que squelette, curseur explicite sur les éléments cliquables.
- Après modification sous `src/convex/` : `bunx convex dev --once` puis
  `bunx tsc -b --noEmit`.
