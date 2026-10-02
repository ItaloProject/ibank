"use client";

import { useState } from "react";
import { PlayCircle, X, ExternalLink, Info, Zap, BookOpen } from "lucide-react";
import { PageHeader, PageShell, PageBody } from "@/components/mobile";
import { TRACKS, isQuick, type Track, type Video } from "./catalog";

// Esta página fica aberta a todos (veja OPEN_PATHS no layout): o YouTube proíbe cobrar para assistir no player incorporado.

const watchUrl = (v: Video) => `https://www.youtube.com/watch?v=${v.youtubeId}`;

type Tab = "resumos" | "aulas";

const BY_TAB: Record<Tab, Track[]> = {
  resumos: TRACKS.map((t) => ({ ...t, videos: t.videos.filter(isQuick) })).filter((t) => t.videos.length),
  aulas: TRACKS.map((t) => ({ ...t, videos: t.videos.filter((v) => !isQuick(v)) })).filter((t) => t.videos.length),
};
const count = (tab: Tab) => BY_TAB[tab].reduce((n, t) => n + t.videos.length, 0);

const TABS: { id: Tab; label: string; hint: string; icon: typeof Zap }[] = [
  { id: "resumos", label: "Resumos rápidos", hint: "até 10 minutos", icon: Zap },
  { id: "aulas", label: "Aulas completas", hint: "mais de 10 minutos", icon: BookOpen },
];

function removalUrl() {
  const phone = (process.env.NEXT_PUBLIC_WHATSAPP ?? "").replace(/\D/g, "");
  if (!phone) return null;
  const text = encodeURIComponent("Olá! Sou criador de um vídeo exibido na página de Vídeos do MUVO e gostaria de pedir a retirada.");
  return `https://wa.me/${phone}?text=${text}`;
}

function VideoCard({ video, onPlay }: { video: Video; onPlay: () => void }) {
  return (
    <div className="group rounded-xl overflow-hidden border bg-card hover:border-primary/50 transition-colors flex flex-col">
      <button type="button" onClick={onPlay} className="text-left" aria-label={`Assistir: ${video.title}`}>
        <div className="relative aspect-video bg-muted overflow-hidden">
          <img
            src={`https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg`}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/35 transition-colors flex items-center justify-center">
            <PlayCircle className="h-12 w-12 text-white drop-shadow-lg" />
          </div>
          <span className="absolute bottom-2 right-2 text-[10px] font-medium bg-black/70 text-white px-1.5 py-0.5 rounded tabular-nums">
            {video.duration}
          </span>
        </div>
        <div className="p-3 pb-2">
          <p className="text-sm font-semibold leading-snug line-clamp-2">{video.title}</p>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{video.description}</p>
        </div>
      </button>
      <div className="mt-auto px-3 pb-3 flex items-center justify-between gap-2 text-[11px]">
        <a
          href={video.channelUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="min-w-0 truncate text-muted-foreground hover:text-foreground transition-colors"
          title={`Canal ${video.channel} no YouTube`}
        >
          Canal: <span className="font-medium">{video.channel}</span>
        </a>
        <a
          href={watchUrl(video)}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 inline-flex items-center gap-1 font-medium text-primary hover:underline"
        >
          No YouTube <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}

function TrackSection({ track, onPlay }: { track: Track; onPlay: (v: Video) => void }) {
  const Icon = track.icon;
  return (
    <section id={track.id} className="space-y-3 scroll-mt-20">
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 h-7 w-7 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">
            {track.title} <span className="text-xs font-normal text-muted-foreground">({track.videos.length})</span>
          </h2>
          <p className="text-xs text-muted-foreground">{track.subtitle}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {track.videos.map((v) => (
          <VideoCard key={v.youtubeId} video={v} onPlay={() => onPlay(v)} />
        ))}
      </div>
    </section>
  );
}

export default function VideosPage() {
  const [playing, setPlaying] = useState<Video | null>(null);
  const [tab, setTab] = useState<Tab>("resumos");
  const removal = removalUrl();
  const tracks = BY_TAB[tab];

  return (
    <PageShell>
      <PageHeader
        title="Vídeos"
        description="Seleção gratuita de vídeos públicos do YouTube para aprender a investir, do básico à renda variável"
      />
      <PageBody width="wide" className="space-y-6">
      <div role="tablist" aria-label="Tipo de vídeo" className="grid grid-cols-2 gap-2 rounded-xl border bg-muted/30 p-1 sm:inline-grid sm:w-auto">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-left transition-colors ${
                active ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${active ? "text-primary" : ""}`} />
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-tight">
                  {t.label} <span className="font-normal text-muted-foreground tabular-nums">({count(t.id)})</span>
                </span>
                <span className="block text-[11px] text-muted-foreground">{t.hint}</span>
              </span>
            </button>
          );
        })}
      </div>

      <nav aria-label="Temas" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-none">
        {tracks.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => document.getElementById(t.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
            >
              <Icon className="h-3.5 w-3.5" /> {t.title}
            </button>
          );
        })}
      </nav>

      <div className="space-y-8">
        {tracks.map((t) => (
          <TrackSection key={`${tab}-${t.id}`} track={t} onPlay={setPlaying} />
        ))}
      </div>

      <aside className="rounded-xl border bg-muted/30 px-4 py-3 flex gap-3 text-xs text-muted-foreground leading-relaxed">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <p>
          Os vídeos são públicos, pertencem aos seus criadores e tocam pelo player oficial do YouTube. Cada visualização conta
          para o canal. O MUVO não tem parceria com esses canais, não recebe nada por eles e os vídeos não são recomendação
          de investimento. Taxas e regras citadas podem ter mudado desde a gravação.{" "}
          {removal ? (
            <>
              É o criador de algum deles e prefere que não apareça aqui?{" "}
              <a href={removal} target="_blank" rel="noopener noreferrer" className="font-medium text-foreground underline underline-offset-2">
                Peça a retirada
              </a>
              .
            </>
          ) : (
            "Se você é o criador de algum deles e prefere que não apareça aqui, fale com a gente e retiramos."
          )}
        </p>
      </aside>

      {playing && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPlaying(null)}
        >
          <div
            className="w-full max-w-3xl bg-background rounded-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="aspect-video">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${playing.youtubeId}?autoplay=1&rel=0`}
                title={playing.title}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            <div className="p-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-sm">{playing.title}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Canal{" "}
                  <a href={playing.channelUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-foreground hover:underline">
                    {playing.channel}
                  </a>
                  {" · "}
                  <a href={watchUrl(playing)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                    Assistir no YouTube <ExternalLink className="h-3 w-3" />
                  </a>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPlaying(null)}
                aria-label="Fechar vídeo"
                className="shrink-0 h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
      </PageBody>
    </PageShell>
  );
}
