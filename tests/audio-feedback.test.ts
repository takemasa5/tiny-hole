import { describe, expect, it } from "vitest";
import { createGrowthStage } from "../src/game/growth-stage";
import {
  objectFeedback,
  objectPickupNotes,
  PickupCombo,
} from "../src/game/object-feedback";
import { MUSIC_STYLES, musicNotes } from "../src/game/music";
import { STAGE_IDS } from "../src/game/stage";

describe("物ごとの音と連続回収", () => {
  const toys = createGrowthStage(42, "toys");
  it("ヒーローと怪獣に別の声を割り当てる", () => {
    expect(objectFeedback(toys.find((o) => o.id === "hero")!).voice).toBe(
      "hero",
    );
    expect(objectFeedback(toys.find((o) => o.id === "monster")!).voice).toBe(
      "monster",
    );
  });
  it("材質を区別し、会社のモニターを鬼と誤認しない", () => {
    const sample = toys[0];
    const materials = ["paper", "wood", "metal", "glass", "stone"] as const;
    const profiles = materials.map((material) =>
      objectFeedback({
        ...sample,
        model: "original",
        kind: "house",
        label: material,
        toyKind: undefined,
      }),
    );
    expect(profiles.map((p) => p.material)).toEqual(materials);
    expect(
      objectFeedback({
        ...sample,
        model: "district",
        toyKind: undefined,
        districtKind: "monitor",
        label: "モニター",
      }).voice,
    ).toBeUndefined();
  });
  it("閻魔の御殿を鬼と扱わず、書類棚を紙と扱わない", () => {
    const palace = createGrowthStage(42, "hell").find(
      (o) => o.hellKind === "palace",
    )!;
    expect(objectFeedback(palace).voice).toBeUndefined();
    expect(objectFeedback(palace).material).toBe("stone");
    const cabinet = createGrowthStage(42, "office").find(
      (o) => o.districtKind === "cabinet",
    )!;
    expect(objectFeedback(cabinet).material).toBe("metal");
  });
  it("連続回収の時間は物理時間で扱い、2.2秒を超えると戻る", () => {
    const combo = new PickupCombo();
    expect(combo.value(0)).toBe(0);
    expect(combo.collect(0, 2)).toBe(2);
    expect(combo.collect(1, 3)).toBe(5);
    expect(combo.value(3)).toBe(5);
    expect(combo.value(3.21)).toBe(0);
    expect(combo.collect(4)).toBe(1);
  });
  it.each(STAGE_IDS)(
    "%s: 全ての物に有限・正の音パラメータを作り、大物や長いコンボでも破綻しない",
    (stage) => {
      for (const object of createGrowthStage(42, stage)) {
        for (const combo of [1, 3, 1000]) {
          for (const note of objectPickupNotes(object, combo)) {
            expect(note.frequency).toBeGreaterThan(20);
            expect(note.frequency).toBeLessThan(10000);
            expect(note.endFrequency).toBeGreaterThan(0);
            expect(note.duration).toBeGreaterThan(0.008);
            expect(note.gain).toBeLessThanOrEqual(0.2);
            expect(Number.isFinite(note.frequency)).toBe(true);
          }
        }
      }
    },
  );
});

describe("ステージ別のオリジナルBGM", () => {
  it.each(STAGE_IDS)(
    "%s: 16小節の音域と音量に上限がありループできる",
    (stage) => {
      const notes = Array.from({ length: 128 }, (_, i) =>
        musicNotes(stage, i),
      ).flat();
      expect(notes.length).toBeGreaterThan(100);
      expect(notes.some((n) => n.voice === "bass")).toBe(true);
      expect(notes.some((n) => n.voice === "lead")).toBe(true);
      for (const n of notes) {
        expect(n.midi).toBeGreaterThanOrEqual(24);
        expect(n.midi).toBeLessThanOrEqual(100);
        expect(n.duration).toBeGreaterThan(0.06);
        expect(n.gain).toBeLessThanOrEqual(0.2);
      }
      expect(musicNotes(stage, 128)).toEqual(musicNotes(stage, 0));
    },
  );
  it("おもちゃは短調の低い旋律と玩具のベル、広場は速い旋律にする", () => {
    const toy = Array.from({ length: 16 }, (_, i) =>
      musicNotes("toys", i),
    ).flat();
    expect(toy.some((n) => n.voice === "bell")).toBe(true);
    expect(MUSIC_STYLES.toys.minor).toBe(true);
    expect(MUSIC_STYLES.toys.tempo).toBeLessThan(MUSIC_STYLES.plaza.tempo);
    expect(
      Math.max(...toy.filter((n) => n.voice === "lead").map((n) => n.midi)),
    ).toBeLessThan(75);
  });
});
