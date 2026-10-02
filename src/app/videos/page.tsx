"use client";

import { useState } from "react";
import { PlayCircle, GraduationCap, Lightbulb, X, ExternalLink, Info } from "lucide-react";
import { PageHeader, PageShell, PageBody } from "@/components/mobile";

type Video = {
  title: string;
  description: string;
  youtubeId: string;
  duration: string;
  channel: string;
  channelUrl: string;
};

// Vídeos públicos do YouTube, sempre pelo player oficial: nunca baixar nem hospedar cópias.
// Esta página fica aberta a todos (veja PUBLIC_PATHS no layout): o YouTube proíbe cobrar para assistir no player incorporado.
// youtubeId = código depois de "v=" no link do vídeo; o canal vem de youtube.com/oembed.
const INICIANTES: Video[] = [
  {
    title: "Educação financeira para iniciantes: o que é e como começar",
    description: "Pilares básicos: receitas, despesas, reserva e uso consciente do crédito.",
    youtubeId: "7NNsg7N6__Q",
    duration: "8:00",
    channel: "Alfa | Safra Financeira",
    channelUrl: "https://www.youtube.com/@AlfaConsignado",
  },
  {
    title: "Como organizar sua vida financeira em 30 dias",
    description: "Um método simples para mapear para onde o dinheiro vai.",
    youtubeId: "85NKII6eLmE",
    duration: "12:00",
    channel: "Me Poupe!",
    channelUrl: "https://www.youtube.com/@MePoupe",
  },
  {
    title: "Orçamento familiar de forma simples",
    description: "Como montar um orçamento e comparar o planejado com o realizado.",
    youtubeId: "_LetMq26HJU",
    duration: "15:00",
    channel: "Taí Souza",
    channelUrl: "https://www.youtube.com/@Taisouzaaaa",
  },
];

const DICAS: Video[] = [
  {
    title: "Guia da renda fixa: CDB, CDI, Selic, LCI e LCA",
    description: "Entenda as siglas que aparecem nos investimentos de renda fixa.",
    youtubeId: "LLG2RrpMwkA",
    duration: "18:00",
    channel: "Bruno Perini - Você MAIS Rico",
    channelUrl: "https://www.youtube.com/@brunoperini",
  },
  {
    title: "Tesouro Direto: guia completo para iniciantes",
    description: "Como funciona o Tesouro e por onde começar com segurança.",
    youtubeId: "bolG9pgxEAU",
    duration: "20:00",
    channel: "Me Poupe!",
    channelUrl: "https://www.youtube.com/@MePoupe",
  },
  {
    title: "Tesouro Selic: passo a passo para investir",
    description: "Ideal para reserva de emergência, com liquidez e baixo risco.",
    youtubeId: "9q8fWrCR2ZI",
    duration: "14:00",
    channel: "Luciana Fiaux | dominesuasfinancas",
    channelUrl: "https://www.youtube.com/@lucianafiauxdomine",
  },
  {
    title: "Aula sobre fundos imobiliários (FIIs)",
    description: "Tijolo, papel e o essencial para começar.",
    youtubeId: "xQOWiQMzq3M",
    duration: "25:00",
    channel: "POP SHOW TV",
    channelUrl: "https://www.youtube.com/@pobreshow",
  },
  {
    title: "10 anos investindo em FIIs: o que aprendi",
    description: "Lições práticas sobre carteira, vacância e tese de longo prazo.",
    youtubeId: "xOWMQloIlGM",
    duration: "21:00",
    channel: "Finclass - Aprenda a investir do zero",
    channelUrl: "https://www.youtube.com/@Finclass",
  },
];

const watchUrl = (v: Video) => `https://www.youtube.com/watch?v=${v.youtubeId}`;

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
          <span className="absolute bottom-2 right-2 text-[10px] font-medium bg-black/70 text-white px-1.5 py-0.5 rounded">
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
  const removal = removalUrl();

  return (
    <PageShell>
      <PageHeader
        title="Vídeos"
        description="Seleção gratuita de vídeos públicos do YouTube sobre educação financeira"
      />
      <PageBody width="wide" className="space-y-8">
      <VideoSection icon={GraduationCap} title="Iniciantes" videos={INICIANTES} onPlay={setPlaying} />
      <VideoSection icon={Lightbulb} title="Dicas" videos={DICAS} onPlay={setPlaying} />

      <aside className="rounded-xl border bg-muted/30 px-4 py-3 flex gap-3 text-xs text-muted-foreground leading-relaxed">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <p>
          Os vídeos são públicos, pertencem aos seus criadores e tocam pelo player oficial do YouTube. Cada visualização conta
          para o canal. O MUVO não tem parceria com esses canais, não recebe nada por eles e os vídeos não são recomendação
          de investimento.{" "}
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
