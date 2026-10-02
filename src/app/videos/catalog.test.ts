import { describe, expect, it } from "vitest";
import { TRACKS, isQuick, seconds } from "./catalog";

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

  it("toda trilha tem resumos rápidos", () => {
    for (const t of TRACKS) expect(t.videos.filter(isQuick).length, t.title).toBeGreaterThanOrEqual(3);
  });
});
