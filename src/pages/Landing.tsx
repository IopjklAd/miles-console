/**
 * Landing page — public entry to the MILES console.
 *
 * States clearly what the product is, what is connected today and where the
 * operator goes next (sign in → console). The embedded preview is labelled as
 * an illustration so it can't be mistaken for live data.
 */

import { LogoMark } from "@/components/miles/LogoMark";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Bot,
  Cpu,
  Gamepad2,
  Gauge,
  Layers,
  Radio,
  ScrollText,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import { useNavigate } from "react-router";

const FEATURES = [
  {
    icon: Gauge,
    title: "Supervision des capteurs",
    description:
      "PIR, sonore et distance VL53L3CX avec validité explicite : mesure réelle, donnée ancienne, valeur invalide ou simulation.",
  },
  {
    icon: Bot,
    title: "Assistant IA sécurisé",
    description:
      "Conversations persistées côté serveur, fournisseur choisi dans le backend : aucune clé d'API dans le navigateur.",
  },
  {
    icon: ScrollText,
    title: "Diagnostic technique",
    description:
      "Journaux filtrables par niveau, source et période, avec recherche, copie et export des entrées chargées.",
  },
  {
    icon: Gamepad2,
    title: "Contrôle validé",
    description:
      "Les commandes proviennent du manifeste du backend, les actions à effet physique demandent une confirmation et l'envoi reste distinct de la réussite.",
  },
  {
    icon: Terminal,
    title: "Mode démonstration",
    description:
      "Sans matériel connecté, l'interface reste testable : chaque valeur simulée porte son étiquette permanente.",
  },
  {
    icon: ShieldCheck,
    title: "État honnête",
    description:
      "Une mesure indisponible s'affiche « Indisponible » : rien n'est inventé pour remplir un graphique ou une carte.",
  },
];

const STACK = [
  {
    label: "Interface",
    items: ["React 19 + TypeScript", "Vite + Tailwind + shadcn/ui", "Navigation latérale responsive", "Thème sombre / clair"],
  },
  {
    label: "Backend applicatif",
    items: ["Convex (données + temps réel)", "Authentification opérateur", "Actions IA « use node »", "Historique des conversations"],
  },
  {
    label: "Système MILES",
    items: ["API REST du backend MILES", "Carte ESP32-S3", "Capteurs et périphériques", "Contrat d'API documenté"],
  },
];

const INTEGRATIONS = [
  { name: "Authentification opérateur", status: "Connecté", tone: "ok" },
  { name: "Conversations IA (passerelle)", status: "Connecté", tone: "ok" },
  { name: "Persistance des conversations", status: "Connecté", tone: "ok" },
  { name: "Backend MILES (REST)", status: "À connecter", tone: "todo" },
  { name: "ESP32-S3 et capteurs", status: "Non vérifié", tone: "todo" },
  { name: "Webcam et audio", status: "Hors périmètre v1", tone: "muted" },
] as const;

const PREVIEW_ROWS = [
  { label: "État général", value: "Dégradé", tone: "text-warning" },
  { label: "Backend", value: "Non configuré", tone: "text-warning" },
  { label: "ESP32-S3", value: "Indisponible", tone: "text-muted-foreground" },
  { label: "Capteurs", value: "Indisponible", tone: "text-muted-foreground" },
  { label: "Assistant IA", value: "Prêt", tone: "text-success" },
];

function SectionTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();

  const openConsole = () => {
    navigate(isAuthenticated ? "/dashboard" : "/auth?returnTo=/dashboard");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <LogoMark />
            <div className="leading-tight">
              <p className="text-sm font-bold tracking-tight">MILES</p>
              <p className="text-[11px] text-muted-foreground">
                Console de supervision
              </p>
            </div>
          </div>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#fonctionnalites" className="transition-colors hover:text-foreground">
              Fonctionnalités
            </a>
            <a href="#architecture" className="transition-colors hover:text-foreground">
              Architecture
            </a>
            <a href="#integrations" className="transition-colors hover:text-foreground">
              Intégrations
            </a>
          </nav>
          <Button size="sm" className="cursor-pointer gap-1.5" onClick={openConsole}>
            {isLoading ? "…" : isAuthenticated ? "Ouvrir la console" : "Se connecter"}
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,color-mix(in_oklab,var(--primary)_12%,transparent),transparent)]"
        />
        <div className="relative mx-auto grid w-full max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:py-24">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
              <Radio className="size-3.5 text-primary" aria-hidden />
              Système robotique · ESP32-S3 · capteurs · IA
            </span>
            <h1 className="mt-5 text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
              Pilotez MILES depuis une console qui{" "}
              <span className="text-primary">ne ment jamais</span> sur l'état du
              système.
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
              Supervision des capteurs, assistant IA, commandes validées et
              diagnostic technique réunis dans une interface sombre et
              responsive. Chaque valeur indique si elle vient du matériel, du
              backend ou du mode démonstration.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button size="lg" className="cursor-pointer gap-2" onClick={openConsole}>
                {isAuthenticated ? "Ouvrir la console" : "Accéder à la console"}
                <ArrowRight className="size-4" aria-hidden />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="cursor-pointer gap-2"
                onClick={() => navigate("/auth?returnTo=/dashboard")}
              >
                Créer une session opérateur
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Sans matériel connecté, la console démarre en mode démonstration —
              clairement signalé en permanence.
            </p>
          </motion.div>

          {/* Illustration of the console */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.1, ease: "easeOut" }}
            className="relative"
          >
            <div className="rounded-xl border border-border/70 bg-card">
              <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-primary" aria-hidden />
                  <span className="text-sm font-semibold tracking-tight">
                    Vue d'ensemble
                  </span>
                </div>
                <span className="rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning">
                  Aperçu
                </span>
              </div>
              <div className="grid gap-2 p-4 sm:grid-cols-2">
                {PREVIEW_ROWS.map((row, index) => (
                  <motion.div
                    key={row.label}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.2 + index * 0.07 }}
                    className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5"
                  >
                    <span className="text-xs text-muted-foreground">
                      {row.label}
                    </span>
                    <span className={cn("text-xs font-medium", row.tone)}>
                      {row.value}
                    </span>
                  </motion.div>
                ))}
                <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 sm:col-span-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-muted-foreground">
                      Journaux
                    </span>
                    <span className="mono-value text-[11px] text-muted-foreground">
                      3 entrées
                    </span>
                  </div>
                  <div className="mt-2 space-y-1 font-mono text-[11px] text-muted-foreground">
                    <p>19:42:11 · INFO · backend · Point d'état publié</p>
                    <p>19:42:09 · WARNING · services · miles-vision arrêté</p>
                    <p>19:41:58 · ERROR · esp32 · Port série indisponible</p>
                  </div>
                </div>
              </div>
              <div className="border-t border-border/60 px-4 py-2.5 text-[11px] text-muted-foreground">
                Aperçu d'interface à titre illustratif — pas des mesures réelles.
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="fonctionnalites" className="border-t border-border/60 py-16">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <SectionTitle
            eyebrow="Fonctionnalités"
            title="Une console technique complète"
            description="Chaque page partage la même navigation, les mêmes états de chargement et la même gestion d'erreur."
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.article
                  key={feature.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                  className="rounded-xl border border-border/70 bg-card p-5 transition-colors hover:border-primary/30"
                >
                  <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <h3 className="mt-4 text-sm font-semibold tracking-tight">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {feature.description}
                  </p>
                </motion.article>
              );
            })}
          </div>
        </div>
      </section>

      {/* Architecture */}
      <section id="architecture" className="border-t border-border/60 bg-muted/20 py-16">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <SectionTitle
            eyebrow="Architecture"
            title="Trois couches, un contrat d'API"
            description="Le frontend ne parle jamais au matériel : il interroge le backend MILES ou, en attendant, le moteur de démonstration."
          />
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {STACK.map((layer, index) => (
              <motion.div
                key={layer.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.4, delay: index * 0.08 }}
                className="rounded-xl border border-border/70 bg-card p-5"
              >
                <div className="flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                    {index === 0 ? (
                      <Layers className="size-4" aria-hidden />
                    ) : index === 1 ? (
                      <ShieldCheck className="size-4" aria-hidden />
                    ) : (
                      <Cpu className="size-4" aria-hidden />
                    )}
                  </span>
                  <h3 className="text-sm font-semibold tracking-tight">
                    {layer.label}
                  </h3>
                </div>
                <ul className="mt-4 space-y-2 text-xs text-muted-foreground">
                  {layer.items.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span
                        className="mt-1.5 size-1 shrink-0 rounded-full bg-primary"
                        aria-hidden
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Integrations status */}
      <section id="integrations" className="border-t border-border/60 py-16">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <SectionTitle
            eyebrow="État des intégrations"
            title="Ce qui est réellement connecté aujourd'hui"
            description="Aucune fonctionnalité matérielle n'est présentée comme opérationnelle tant qu'elle n'a pas été vérifiée."
          />
          <div className="mx-auto mt-10 max-w-3xl overflow-hidden rounded-xl border border-border/70 bg-card">
            <ul className="divide-y divide-border/60">
              {INTEGRATIONS.map((item) => (
                <li
                  key={item.name}
                  className="flex items-center justify-between gap-4 px-5 py-3.5"
                >
                  <span className="text-sm">{item.name}</span>
                  <span
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-xs font-medium",
                      item.tone === "ok"
                        ? "border-success/30 bg-success/10 text-success"
                        : item.tone === "todo"
                          ? "border-warning/35 bg-warning/10 text-warning"
                          : "border-border bg-muted/60 text-muted-foreground",
                    )}
                  >
                    {item.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border/60 bg-muted/20 py-16">
        <div className="mx-auto w-full max-w-6xl px-4 text-center sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Ouvrez la console MILES
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
            Connectez-vous pour accéder au tableau de bord, à l'assistant, aux
            capteurs, aux journaux et au contrôle du robot.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button size="lg" className="cursor-pointer gap-2" onClick={openConsole}>
              {isAuthenticated ? "Ouvrir la console" : "Commencer"}
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60 py-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2.5">
            <LogoMark size="sm" />
            <span className="text-xs text-muted-foreground">
              MILES — console de supervision robotique
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Emplacement du logo officiel à renseigner · interface prête à
            rejoindre le backend MILES
          </p>
        </div>
      </footer>
    </div>
  );
}
