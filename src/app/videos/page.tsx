"use client";

import { useState } from "react";
import { PlayCircle, GraduationCap, Lightbulb, ImageIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Video = {
  title: string;
  description: string;
  youtubeId: string;
  duration: string;
};

type ExplanatoryImage = {
  src: string;
  caption: string;
};

// Adicione os vídeos aqui conforme forem gravados/publicados no YouTube.
// youtubeId é o código depois de "v=" no link do vídeo.
const INICIANTES: Video[] = [];

const DICAS: Video[] = [];

// Adicione imagens explicativas em /public e referencie o caminho aqui.
const EXPLANATORY_IMAGES: ExplanatoryImage[] = [];

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
  const [zoomedImage, setZoomedImage] = useState<ExplanatoryImage | null>(null);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-8 pb-8">
      <div className="border-b pb-4 flex items-center gap-2">
        <PlayCircle className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Vídeos</h1>
          <p className="text-sm text-muted-foreground">Aprenda a usar o IBANK com conteúdo gratuito</p>
        </div>
      </div>

      <VideoSection icon={GraduationCap} title="Iniciantes" videos={INICIANTES} onPlay={setPlaying} />
      <VideoSection icon={Lightbulb} title="Dicas" videos={DICAS} onPlay={setPlaying} />

      {/* Imagens explicativas */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Imagens explicativas</h2>
        </div>
        {EXPLANATORY_IMAGES.length === 0 ? (
          <div className="rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground">
            Em breve novas imagens explicativas.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {EXPLANATORY_IMAGES.map((img) => (
              <button
                key={img.src}
                type="button"
                onClick={() => setZoomedImage(img)}
                className="rounded-xl overflow-hidden border bg-card text-left hover:border-primary/50 transition-colors"
              >
                <img src={img.src} alt={img.caption} className="w-full aspect-video object-cover" />
                <p className="text-xs text-muted-foreground p-2 line-clamp-2">{img.caption}</p>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Modal de vídeo */}
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

      {/* Zoom de imagem */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setZoomedImage(null)}
        >
          <div className="max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
            <img src={zoomedImage.src} alt={zoomedImage.caption} className="w-full rounded-xl" />
            <p className="text-sm text-white/80 text-center mt-3">{zoomedImage.caption}</p>
          </div>
        </div>
      )}
    </div>
  );
}
