"use client";

import { useState } from "react";
import { PlayCircle, GraduationCap, Lightbulb, X } from "lucide-react";
import { ContributionSimulator } from "@/components/videos/contribution-simulator";
import { PageHeader, PageShell, PageBody } from "@/components/mobile";

type Video = {
  title: string;
  description: string;
  youtubeId: string;
  duration: string;
};

// Curadoria pública do YouTube (educação financeira).
// Substitua por tutoriais oficiais do IBANK quando forem publicados.
// youtubeId = código depois de "v=" no link do vídeo.
const INICIANTES: Video[] = [
  {
    title: "Educação financeira para iniciantes: o que é e como começar",
    description: "Pilares básicos: receitas, despesas, reserva e uso consciente do crédito.",
    youtubeId: "7NNsg7N6__Q",
    duration: "8:00",
  },
  {
    title: "Como organizar sua vida financeira em 30 dias",
    description: "Método simples de Me Poupe! para mapear para onde o dinheiro vai.",
    youtubeId: "85NKII6eLmE",
    duration: "12:00",
  },
  {
    title: "Orçamento familiar de forma simples",
    description: "Como montar um orçamento e comparar o planejado com o realizado.",
    youtubeId: "_LetMq26HJU",
    duration: "15:00",
  },
];

const DICAS: Video[] = [
  {
    title: "Guia da renda fixa: CDB, CDI, Selic, LCI e LCA",
    description: "Entenda as siglas que aparecem nos seus investimentos e no IBANK.",
    youtubeId: "LLG2RrpMwkA",
    duration: "18:00",
  },
  {
    title: "Tesouro Direto: guia completo para iniciantes",
    description: "Como funciona o Tesouro e por onde começar com segurança.",
    youtubeId: "bolG9pgxEAU",
    duration: "20:00",
  },
  {
    title: "Tesouro Selic: passo a passo para investir",
    description: "Ideal para reserva de emergência — liquidez e baixo risco.",
    youtubeId: "9q8fWrCR2ZI",
    duration: "14:00",
  },
  {
    title: "Aula sobre fundos imobiliários (FIIs)",
    description: "Com Primo Pobre: tijolo, papel e o essencial para começar.",
    youtubeId: "xQOWiQMzq3M",
    duration: "25:00",
  },
  {
    title: "10 anos investindo em FIIs — o que aprendi",
    description: "Lições práticas sobre carteira, vacância e tese de longo prazo.",
    youtubeId: "xOWMQloIlGM",
    duration: "21:00",
  },
];

function VideoCard({ video, onPlay }: { video: Video; onPlay: () => void }) {
  return (
    <button
      type="button"
      onClick={onPlay}
      className="group text-left rounded-xl overflow-hidden border bg-card hover:border-primary/50 transition-colors"
    >
      <div className="relative aspect-video bg-muted overflow-hidden">
        <img
          src={`https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg`}
          alt={video.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/35 transition-colors flex items-center justify-center">
          <PlayCircle className="h-12 w-12 text-white drop-shadow-lg" />
        </div>
        <span className="absolute bottom-2 right-2 text-[10px] font-medium bg-black/70 text-white px-1.5 py-0.5 rounded">
          {video.duration}
        </span>
      </div>
      <div className="p-3">
        <p className="text-sm font-semibold leading-snug line-clamp-2">{video.title}</p>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{video.description}</p>
      </div>
    </button>
  );
}

function VideoSection({
  icon: Icon,
  title,
  videos,
  onPlay,
}: {
  icon: React.ElementType;
  title: string;
  videos: Video[];
  onPlay: (v: Video) => void;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="text-xs text-muted-foreground">({videos.length})</span>
      </div>
      {videos.length === 0 ? (
        <div className="rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground">
          Em breve novos vídeos nesta seção.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {videos.map((v) => (
            <VideoCard key={v.youtubeId} video={v} onPlay={() => onPlay(v)} />
          ))}
        </div>
      )}
    </section>
  );
}

export default function VideosPage() {
  const [playing, setPlaying] = useState<Video | null>(null);

  return (
    <PageShell>
      <PageHeader
        title="Vídeos"
        description="Educação financeira gratuita para usar melhor o IBANK"
      />
      <PageBody width="wide" className="space-y-8">
      <VideoSection icon={GraduationCap} title="Iniciantes" videos={INICIANTES} onPlay={setPlaying} />
      <VideoSection icon={Lightbulb} title="Dicas" videos={DICAS} onPlay={setPlaying} />

      <ContributionSimulator />

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
                src={`https://www.youtube-nocookie.com/embed/${playing.youtubeId}?autoplay=1`}
                title={playing.title}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            <div className="p-4 flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-sm">{playing.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{playing.description}</p>
              </div>
              <button
                type="button"
                onClick={() => setPlaying(null)}
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
