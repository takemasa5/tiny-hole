import { beforeAll, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { createGrowthStage } from "../src/game/growth-stage";
import { createFloor, updateFloor } from "../src/game/floor";
import {
  createGrowthBody,
  growthCollisionBounds,
  growthLosesSupport,
} from "../src/game/growth-physics";
import {
  createThemeMotion,
  themeVelocity,
  themeYaw,
} from "../src/game/theme-behavior";
import { growthVisual } from "../src/game/growth-visuals";
import { animateToyCharacter } from "../src/game/toy-character-visuals";
import { disposeScene } from "../src/game/visuals";

beforeAll(async () => {
  await RAPIER.init();
});

it.each(["hero", "monster"])(
  "%s: 対戦中は動かず、元の位置から25離れた境界でも相手と逆へ振り向かない",
  (id) => {
    const d = createGrowthStage(42, "toys").find((d) => d.id === id)!;
    const motion = createThemeMotion(d);
    const hole = { x: d.x - 500, z: d.z, radius: 24 };
    for (const offset of [24.9, 25.1, 24.9, 25.1, 60]) {
      const at = { x: d.x + offset, z: d.z };
      for (let tick = 0; tick < 360; tick++) {
        expect(
          themeVelocity(d, motion, at, hole, 1 / 60, { x: at.x + 10, z: at.z }),
        ).toEqual({ x: 0, z: 0 });
        expect(motion.phase).toBe("fighting");
        expect(motion.heading).toBeCloseTo(Math.PI / 2, 6);
      }
    }
  },
);

it.each(["hero", "monster"])(
  "%s: 左右の手を交互に振り、回避では両手が肩より上へ上がり、落下では両腕が通常姿勢へ戻る",
  (id) => {
    const d = createGrowthStage(42, "toys").find((d) => d.id === id)!;
    const mesh = growthVisual(d, "toys");
    try {
      const original = new THREE.Box3().setFromObject(mesh);
      const arms = [
        mesh.getObjectByName("attack-arm")!,
        mesh.getObjectByName("other-arm")!,
      ];
      const part = id === "hero" ? "fist" : "hand";
      const hands = ["right", "left"].map((side) =>
        mesh.getObjectByName(`${part}-${side}`)!,
      );
      const height = (obj: THREE.Object3D) =>
        obj.getWorldPosition(new THREE.Vector3()).y;
      const edgeLength = (obj: THREE.Object3D) => {
        const vertices = (obj as THREE.Mesh).geometry.getAttribute("position");
        obj.updateWorldMatrix(true, false);
        const a = new THREE.Vector3()
          .fromBufferAttribute(vertices, 0)
          .applyMatrix4(obj.matrixWorld);
        const b = new THREE.Vector3()
          .fromBufferAttribute(vertices, 1)
          .applyMatrix4(obj.matrixWorld);
        return a.distanceTo(b);
      };
      const originalEdges = hands.map(edgeLength);
      animateToyCharacter(
        mesh,
        { phase: "fighting", time: Math.PI / 12 },
        false,
      );
      expect(height(hands[0])).toBeLessThan(height(hands[1]));
      for (let i = 0; i < 2; i++)
        expect(edgeLength(hands[i])).toBeCloseTo(originalEdges[i], 6);
      animateToyCharacter(
        mesh,
        { phase: "fighting", time: Math.PI / 4 },
        false,
      );
      expect(height(hands[0])).toBeGreaterThan(height(hands[1]));
      for (let i = 0; i < 2; i++)
        expect(edgeLength(hands[i])).toBeCloseTo(originalEdges[i], 6);
      animateToyCharacter(mesh, { phase: "fleeing", time: 1 }, false);
      for (let i = 0; i < 2; i++)
        expect(height(hands[i]) - height(arms[i])).toBeGreaterThan(
          d.size[1] * 0.1,
        );
      animateToyCharacter(mesh, { phase: "fleeing", time: 1 }, true);
      for (const arm of arms)
        expect(arm.rotation.toArray().slice(0, 3)).toEqual([0, 0, 0]);
      const restored = new THREE.Box3().setFromObject(mesh);
      expect(restored.min.distanceTo(original.min)).toBeLessThan(1e-6);
      expect(restored.max.distanceTo(original.max)).toBeLessThan(1e-6);
    } finally {
      disposeScene(mesh);
    }
  },
);

it.each(["hero", "monster"])(
  "%s: 穴から離れた接触による沈み込みや、穴が外接箱に触れただけで直立制御を解除しない",
  (id) => {
    const d = createGrowthStage(42, "toys").find((d) => d.id === id)!;
    const rotation = {
      x: 0,
      y: Math.sin(d.yaw / 2),
      z: 0,
      w: Math.cos(d.yaw / 2),
    };
    const y = -growthCollisionBounds(d, rotation, "toys").bottom;
    const far = { x: d.x + 300, z: d.z, radius: 24 };
    expect(
      growthLosesSupport(
        d,
        { x: d.x, y: y - 1, z: d.z },
        rotation,
        far,
        "toys",
      ),
    ).toBe(false);
    const edge = { x: d.x + 25, z: d.z, radius: 24 };
    expect(
      growthLosesSupport(d, { x: d.x, y, z: d.z }, rotation, edge, "toys"),
    ).toBe(false);
    expect(
      growthLosesSupport(
        d,
        { x: d.x, y: y - 1, z: d.z },
        rotation,
        edge,
        "toys",
      ),
    ).toBe(true);
  },
);

it.each([12, 24, 48])(
  "穴が遠い対戦中に2体が転倒しない（穴半径%s、実座標・10秒）",
  (radius) => {
    const world = new RAPIER.World({ x: 0, y: -9.81 * radius, z: 0 });
    world.timestep = 1 / 60;
    try {
      const hole = { x: 200, z: -100, radius };
      const floor = createFloor(world);
      updateFloor(floor, hole.x, hole.z, radius, 6400);
      const actors = createGrowthStage(42, "toys")
        .filter((d) => d.id === "hero" || d.id === "monster")
        .map((d) => {
          const rotation = {
            x: 0,
            y: Math.sin(d.yaw / 2),
            z: 0,
            w: Math.cos(d.yaw / 2),
          };
          const y = -growthCollisionBounds(d, rotation, "toys").bottom + 0.0005;
          return {
            d,
            motion: createThemeMotion(d),
            ...createGrowthBody(
              world,
              d,
              { x: d.x, y, z: d.z },
              rotation,
              "toys",
            ),
          };
        });
      for (let tick = 0; tick < 600; tick++) {
        hole.x = 200 + Math.sin(tick / 40) * 40;
        hole.z = -100 + Math.cos(tick / 40) * 20;
        updateFloor(floor, hole.x, hole.z, radius, 6400);
        const positions = actors.map(({ body }) => body.translation());
        for (const [index, { d, body, motion }] of actors.entries()) {
          const at = body.translation();
          const bottom =
            at.y + growthCollisionBounds(d, body.rotation(), "toys").bottom;
          expect(
            growthLosesSupport(d, at, body.rotation(), hole, "toys"),
            `${d.id} tick=${tick} bottom=${bottom}`,
          ).toBe(false);
          const velocity = themeVelocity(
            d,
            motion,
            at,
            hole,
            1 / 60,
            positions[1 - index],
          );
          body.setLinvel({ ...velocity, y: body.linvel().y }, true);
          body.setAngvel({ x: 0, y: 0, z: 0 }, true);
          const yaw = themeYaw(d, motion.heading);
          body.setRotation(
            { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) },
            true,
          );
        }
        world.step();
      }
    } finally {
      world.free();
    }
  },
);

it.each(["hero", "monster"])(
  "%s: 実際に足場を失うと直立制御を解除し、レベル11の穴へ落下する",
  (id) => {
    const d = createGrowthStage(42, "toys").find((d) => d.id === id)!;
    const radius = 48;
    const world = new RAPIER.World({ x: 0, y: -9.81 * radius, z: 0 });
    try {
      const floor = createFloor(world);
      const rotation = {
        x: 0,
        y: Math.sin(d.yaw / 2),
        z: 0,
        w: Math.cos(d.yaw / 2),
      };
      const y = -growthCollisionBounds(d, rotation, "toys").bottom + 0.0005;
      const { body } = createGrowthBody(
        world,
        d,
        { x: d.x, y, z: d.z },
        rotation,
        "toys",
      );
      const hole = { x: d.x, z: d.z, radius };
      updateFloor(floor, hole.x, hole.z, radius, 6400);
      let falling = false;
      let releasedAt = -1;
      for (let tick = 0; tick < 240; tick++) {
        if (
          !falling &&
          growthLosesSupport(
            d,
            body.translation(),
            body.rotation(),
            hole,
            "toys",
          )
        ) {
          falling = true;
          releasedAt = tick;
          body.setEnabledRotations(true, true, true, true);
        }
        world.step();
      }
      expect(falling).toBe(true);
      expect(releasedAt).toBeGreaterThan(0);
      expect(
        body.translation().y +
          growthCollisionBounds(d, body.rotation(), "toys").top,
      ).toBeLessThan(-radius);
    } finally {
      world.free();
    }
  },
);
