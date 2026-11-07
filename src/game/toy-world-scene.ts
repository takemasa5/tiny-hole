import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { GROUND_PAINT_RENDER_ORDER } from "./ground-geometry";
import {
  TOY_SPACES,
  TOY_CITY_ROADS,
  toyWallParts,
  toySpaceFootprint,
  toyBlockingWalls,
  insideToyRect,
  constrainToyStep,
  type ToyWall,
} from "./toy-world";

interface Frame {
  roof?: THREE.Mesh;
  group: THREE.Group;
  body: RAPIER.RigidBody;
  colliders: RAPIER.Collider[];
  floor: THREE.Mesh;
  falling: boolean;
  collected: boolean;
  previousPosition: THREE.Vector3;
  previousRotation: THREE.Quaternion;
}
interface Door {
  wall: ToyWall;
  pivot: THREE.Group;
  collider: RAPIER.Collider;
  amount: number;
}
export class ToyWorldScene {
  readonly group = new THREE.Group();
  private frames: Frame[] = [];
  private doors: Door[] = [];
  private hole = { value: new THREE.Vector2() };
  private radius = { value: 0.08 };
  private level = 1;
  private openedArea = 0;
  private bounds = new THREE.Box3();
  constructor(
    private world: RAPIER.World,
    private belowFloor: Set<number>,
  ) {
    const walls = toyWallParts();
    TOY_SPACES.forEach((space, index) => {
      const b = space.bounds;
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(b.maxX - b.minX, b.maxZ - b.minZ),
        this.paint(space.floor),
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.set((b.minX + b.maxX) / 2, 0.001, (b.minZ + b.maxZ) / 2);
      floor.renderOrder =
        GROUND_PAINT_RENDER_ORDER + 1 + TOY_SPACES.length - index;
      floor.name = `${space.id}-floor`;
      this.group.add(floor);
      if (!space.height) return;
      const group = new THREE.Group();
      group.userData.objectId = `world-${space.id}`;
      const cx = (b.minX + b.maxX) / 2,
        cz = (b.minZ + b.maxZ) / 2;
      group.position.set(cx, 0, cz);
      this.group.add(group);
      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(cx, 0, cz),
      );
      const colliders: RAPIER.Collider[] = [];
      for (const wall of walls.filter((w) => w.space === index)) {
        const width = wall.maxX - wall.minX,
          depth = wall.maxZ - wall.minZ;
        const x = (wall.minX + wall.maxX) / 2,
          z = (wall.minZ + wall.maxZ) / 2;
        const collider = world.createCollider(
          RAPIER.ColliderDesc.cuboid(width / 2, wall.height / 2, depth / 2)
            .setTranslation(x - cx, wall.height / 2, z - cz)
            .setFriction(0.7)
            .setActiveHooks(RAPIER.ActiveHooks.FILTER_CONTACT_PAIRS),
          body,
        );
        colliders.push(collider);
        if (wall.door) {
          const pivot = new THREE.Group();
          const east = space.gate!.side === "east";
          pivot.position.set(
            east ? x - cx : wall.minX - cx,
            0,
            east ? wall.minZ - cz : z - cz,
          );
          const mesh = this.box(
            [width, wall.height, depth],
            wall.space < 2 ? space.color : "#a67951",
          );
          mesh.name = `${space.id}-door-surface`;
          mesh.position.set(
            east ? 0 : width / 2,
            wall.height / 2,
            east ? depth / 2 : 0,
          );
          pivot.add(mesh);
          group.add(pivot);
          const knob = new THREE.Mesh(
            new THREE.SphereGeometry(space.thickness * 0.7, 8, 6),
            new THREE.MeshStandardMaterial({ color: "#e9c56b" }),
          );
          knob.position.set(
            east ? space.thickness : width * 0.8,
            wall.height * 0.45,
            east ? depth * 0.8 : space.thickness,
          );
          pivot.add(knob);
          this.doors.push({ wall, pivot, collider, amount: 0 });
        } else {
          const mesh = this.box([width, wall.height, depth], wall.color);
          mesh.name = wall.id;
          mesh.position.set(x - cx, wall.height / 2, z - cz);
          group.add(mesh);
          if (index < 2) {
            const rim = this.box(
              [
                width + space.thickness * 0.2,
                space.thickness * 0.6,
                depth + space.thickness * 0.2,
              ],
              index === 0 ? "#e7b4b0" : "#e8cd8e",
            );
            rim.position.set(x - cx, wall.height, z - cz);
            rim.name = `${wall.id}-rim`;
            group.add(rim);
          }
        }
      }
      if (index < 2) {
        const lid = new THREE.Group();
        lid.position.set(b.minX - cx, space.height, b.minZ - cz);
        lid.rotation.x = -1.35;
        const mesh = this.box(
          [b.maxX - b.minX, space.thickness * 0.6, b.maxZ - b.minZ],
          index ? "#659d9c" : "#e7b4b0",
        );
        mesh.position.set((b.maxX - b.minX) / 2, 0, (b.maxZ - b.minZ) / 2);
        mesh.name = `${space.id}-lid`;
        lid.add(mesh);
        group.add(lid);
      }
      let roof: THREE.Mesh | undefined;
      if (index === 3) {
        roof = new THREE.Mesh(
          new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4),
          new THREE.MeshStandardMaterial({ color: "#bf7d6c", roughness: 0.9 }),
        );
        roof.scale.set(b.maxX - b.minX, 16, b.maxZ - b.minZ);
        roof.position.y = space.height + 8;
        roof.visible = false;
        group.add(roof);
      }
      this.frames.push({
        roof,
        group,
        body,
        colliders,
        floor,
        falling: false,
        collected: false,
        previousPosition: group.position.clone(),
        previousRotation: group.quaternion.clone(),
      });
      group.traverse((part) => {
        if (part instanceof THREE.Mesh)
          part.userData.objectId = group.userData.objectId;
      });
    });
    const roadMaterial = this.paint("#788b91");
    const dashMaterial = this.paint("#f2e8cf");
    const markings: { x: number; z: number; vertical: boolean }[] = [];
    for (const road of TOY_CITY_ROADS) {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(road.width, road.depth),
        roadMaterial,
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(road.x, 0.001, road.z);
      mesh.renderOrder = GROUND_PAINT_RENDER_ORDER + 21;
      this.group.add(mesh);
      const vertical = road.depth > road.width;
      const length = vertical ? road.depth : road.width;
      const count = Math.floor(length / 30);
      for (let i = 0; i < count; i++)
        markings.push({
          x:
            road.x + (vertical ? 0 : ((i + 0.5) * length) / count - length / 2),
          z:
            road.z + (vertical ? ((i + 0.5) * length) / count - length / 2 : 0),
          vertical,
        });
    }
    const dashes = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1),
      dashMaterial,
      markings.length,
    );
    dashes.frustumCulled = false;
    dashes.renderOrder = GROUND_PAINT_RENDER_ORDER + 23;
    const dummy = new THREE.Object3D();
    markings.forEach((p, i) => {
      dummy.position.set(p.x, 0.001, p.z);
      dummy.rotation.set(-Math.PI / 2, 0, p.vertical ? Math.PI / 2 : 0);
      dummy.scale.set(14, 0.9, 1);
      dummy.updateMatrix();
      dashes.setMatrixAt(i, dummy.matrix);
    });
    this.group.add(dashes);
    // The house is connected on one floor; these coloured patches identify its rooms.
    for (const [x, z, width, depth, color] of [
      [65, 6, 53, 56, "#e5dece"],
      [64, 61, 55, 49, "#c5bfa3"],
      [76, 96, 34, 18, "#aaa89e"],
    ] as const) {
      const patch = new THREE.Mesh(
        new THREE.PlaneGeometry(width, depth),
        this.paint(color),
      );
      patch.rotation.x = -Math.PI / 2;
      patch.position.set(x, 0.001, z);
      patch.renderOrder = GROUND_PAINT_RENDER_ORDER + 3;
      this.group.add(patch);
    }
    // Floorboards provide familiar size references, without a repeating grid of props.
    const seam = this.paint("#b6906b");
    for (let row = 0; row < 36; row++) {
      const z = -3.5 + row;
      const spans =
        z > -2.6 && z < 2.6
          ? [
              [-4.4, -3.3],
              [3.3, 31.6],
            ]
          : [[-4.4, 31.6]];
      for (const [left, right] of spans) {
        const mesh = new THREE.Mesh(
          new THREE.PlaneGeometry(right - left, 0.025),
          seam,
        );
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set((left + right) / 2, 0.001, z);
        mesh.renderOrder = GROUND_PAINT_RENDER_ORDER + 6;
        this.group.add(mesh);
      }
    }
  }
  private box(size: [number, number, number], color: string) {
    return new THREE.Mesh(
      new THREE.BoxGeometry(...size),
      new THREE.MeshStandardMaterial({ color, roughness: 0.85 }),
    );
  }
  private paint(color: string) {
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 1,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: false,
    });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.toyHole = this.hole;
      shader.uniforms.toyRadius = this.radius;
      shader.vertexShader =
        "varying vec2 toyXZ;\n" +
        shader.vertexShader.replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\n#ifdef USE_INSTANCING\n toyXZ = (modelMatrix * instanceMatrix * vec4(position,1.0)).xz;\n#else\n toyXZ = (modelMatrix * vec4(position,1.0)).xz;\n#endif",
        );
      shader.fragmentShader =
        "varying vec2 toyXZ; uniform vec2 toyHole; uniform float toyRadius;\n" +
        shader.fragmentShader.replace(
          "#include <clipping_planes_fragment>",
          "#include <clipping_planes_fragment>\nif(distance(toyXZ,toyHole)<toyRadius) discard;",
        );
    };
    return material;
  }
  update(
    level: number,
    area: number,
    hole: { x: number; z: number; radius: number },
    delta: number,
  ) {
    this.level = level;
    this.openedArea = area;
    this.hole.value.set(hole.x, hole.z);
    this.radius.value = hole.radius;
    for (const door of this.doors) {
      if (this.frames[door.wall.space].collected) continue;
      if (door.wall.space < area)
        door.amount = Math.min(1, door.amount + delta * 1.8);
      const side = TOY_SPACES[door.wall.space].gate!.side;
      door.pivot.rotation.y =
        ((door.amount * Math.PI) / 2) * (side === "east" ? 1 : -1);
      door.collider.setEnabled(door.amount < 0.95);
    }
    for (const [index, frame] of this.frames.entries()) {
      if (frame.collected) continue;
      if (delta > 0) {
        frame.previousPosition.copy(frame.body.translation());
        frame.previousRotation.copy(frame.body.rotation());
      }
      const space = TOY_SPACES[index],
        b = space.bounds;
      if (frame.roof)
        frame.roof.visible = level >= 9 && !insideToyRect(hole, b);
      const cx = (b.minX + b.maxX) / 2,
        cz = (b.minZ + b.maxZ) / 2;
      const outgrownDoor =
        index < area && space.gate && hole.radius * 2 > space.gate.width;
      if (
        !frame.falling &&
        (outgrownDoor ||
          Math.hypot(hole.x - cx, hole.z - cz) + toySpaceFootprint(space) <
            hole.radius * 0.98)
      ) {
        frame.falling = true;
        frame.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
        frame.body.enableCcd(true);
      }
      if (frame.falling) {
        frame.group.position.copy(frame.body.translation());
        frame.group.quaternion.copy(frame.body.rotation());
      }
    }
  }
  afterStep(holeRadius: number) {
    const collected: { id: string; value: number }[] = [];
    for (const [index, frame] of this.frames.entries()) {
      if (!frame.falling || frame.collected) continue;
      frame.group.position.copy(frame.body.translation());
      frame.group.quaternion.copy(frame.body.rotation());
      frame.group.updateMatrixWorld(true);
      this.bounds.setFromObject(frame.group);
      if (this.bounds.max.y < -holeRadius * 0.02)
        for (const collider of frame.colliders)
          this.belowFloor.add(collider.handle);
      if (this.bounds.max.y >= -Math.max(0.06, holeRadius * 0.35)) continue;
      frame.collected = true;
      frame.floor.visible = false;
      frame.group.visible = false;
      for (const collider of frame.colliders)
        this.belowFloor.delete(collider.handle);
      this.world.removeRigidBody(frame.body);
      collected.push({
        id: `world-${TOY_SPACES[index].id}`,
        value: 4 ** (TOY_SPACES[index].level - 1),
      });
    }
    return collected;
  }
  render(hole: { x: number; z: number; radius: number }, alpha: number) {
    this.hole.value.set(hole.x, hole.z);
    this.radius.value = hole.radius;
    for (const frame of this.frames) {
      if (!frame.falling || frame.collected) continue;
      frame.group.position
        .copy(frame.body.translation())
        .lerp(frame.previousPosition, 1 - alpha);
      frame.group.quaternion
        .copy(frame.body.rotation())
        .slerp(frame.previousRotation, 1 - alpha);
    }
  }
  walls(radius: number) {
    const openDoors = new Set(
      this.doors.filter((d) => d.amount >= 0.95).map((d) => d.wall.id),
    );
    return toyBlockingWalls(this.openedArea, radius, openDoors);
  }
  constrain(
    previous: { x: number; z: number },
    next: { x: number; z: number },
    radius: number,
  ) {
    return constrainToyStep(previous, next, radius, this.walls(radius));
  }
  occluders() {
    return this.frames.flatMap((frame, index) =>
      frame.collected
        ? []
        : [
            {
              object: frame.group,
              footprint: toySpaceFootprint(TOY_SPACES[index]),
              fadeSurfaces: true,
            },
          ],
    );
  }
  guide(hole: { x: number; z: number; radius: number }) {
    const door = this.doors.find((d) => d.wall.space === this.openedArea);
    const gate = TOY_SPACES[this.openedArea].gate;
    const position = door
      ? {
          x: (door.wall.minX + door.wall.maxX) / 2,
          z: (door.wall.minZ + door.wall.maxZ) / 2,
        }
      : undefined;
    return {
      visible:
        !!position &&
        Math.hypot(position.x - hole.x, position.z - hole.z) < hole.radius * 4,
      label: gate
        ? `レベル${gate.level}になると${this.openedArea < 2 ? "箱の側面" : this.openedArea === 2 ? "ドア" : "玄関"}が開きます`
        : "",
      level: gate?.level ?? 0,
      posts: 0,
      radius: hole.radius,
      anchors: [],
    };
  }
  snapshot(hole: { x: number; z: number; radius: number }) {
    return {
      label: TOY_SPACES[this.openedArea].label,
      level: this.level,
      openedArea: this.openedArea,
      spaces: TOY_SPACES,
      walls: this.walls(hole.radius),
      doors: this.doors.map((d) => ({
        id: d.wall.id,
        requiredLevel: TOY_SPACES[d.wall.space].gate!.level,
        open: d.amount >= 0.95,
        amount: d.amount,
        x: (d.wall.minX + d.wall.maxX) / 2,
        z: (d.wall.minZ + d.wall.maxZ) / 2,
        side: TOY_SPACES[d.wall.space].gate!.side,
        width: TOY_SPACES[d.wall.space].gate!.width,
      })),
      frames: this.frames.map((f, i) => ({
        id: TOY_SPACES[i].id,
        falling: f.falling,
        collected: f.collected,
        position: {
          x: f.group.position.x,
          y: f.group.position.y,
          z: f.group.position.z,
        },
        rotation: {
          x: f.group.quaternion.x,
          y: f.group.quaternion.y,
          z: f.group.quaternion.z,
          w: f.group.quaternion.w,
        },
      })),
    };
  }
}
