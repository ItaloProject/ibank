import { describe, expect, it } from "vitest";
import { TRACKS, countVideos, groupVideos, isQuick, seconds } from "./catalog";

const all = TRACKS.flatMap((t) => t.videos);

describe("catálogo de vídeos", () => {
  it("não repete vídeos", () => {
    const ids = all.map((v) => v.youtubeId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("usa durações no formato do YouTube e códigos válidos", () => {
    for (const v of all) {
      expect(v.duration, v.title).toMatch(/^(?:\d+:)?\d{1,2}:\d{2}$/);
      expect(v.youtubeId, v.title).toMatch(/^[\w-]{11}$/);
      expect(v.channelUrl, v.title).toMatch(/^https:\/\/www\.youtube\.com\/@/);
    }
  });

  it("separa resumos de até 10 minutos das aulas", () => {
    expect(seconds("10:00")).toBe(600);
    expect(seconds("1:05:34")).toBe(3934);
    expect(isQuick({ ...all[0], duration: "10:00" })).toBe(true);
    expect(isQuick({ ...all[0], duration: "10:01" })).toBe(false);
  });

  it("tem pelo menos 100 resumos rápidos", () => {
    expect(all.filter(isQuick).length).toBeGreaterThanOrEqual(100);
  });

  it("pesquisa por assunto e por canal, sem ligar para acentos", () => {
    const titles = (q: string) => groupVideos("resumos", "tema", q).flatMap((g) => g.videos.map((v) => v.title));
    expect(titles("cartao").some((t) => /cartão/i.test(t))).toBe(true);
    expect(titles("ME POUPE").length).toBeGreaterThan(0);
    expect(groupVideos("resumos", "tema", "me poupe").flatMap((g) => g.videos).every((v) => v.channel === "Me Poupe!" || /me poupe/i.test(v.title + v.description))).toBe(true);
    expect(titles("tesouro selic")).toContain("Tesouro Selic ou fundo DI?");
    expect(countVideos("resumos", "palavra que não existe em nenhum vídeo")).toBe(0);
  });

  it("agrupa por canal sem repetir nem perder vídeos", () => {
    const groups = groupVideos("resumos", "canal");
    const ids = groups.flatMap((g) => g.videos.map((v) => v.youtubeId));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(countVideos("resumos"));
    for (const g of groups.filter((g) => g.id !== "outros-canais")) {
      expect(g.videos.length, g.title).toBeGreaterThan(1);
      expect(new Set(g.videos.map((v) => v.channel)).size, g.title).toBe(1);
    }
    expect(groups[0].videos.length).toBeGreaterThanOrEqual(groups[1].videos.length);
    const searched = groupVideos("resumos", "canal", "anbima");
    expect(searched[0].title).toBe("Anbima");
  });

  it("toda trilha tem resumos rápidos", () => {
    for (const t of TRACKS) expect(t.videos.filter(isQuick).length, t.title).toBeGreaterThanOrEqual(3);
  });
});
