"""Run through Blender MCP's execute bridge to rebuild the two toy characters.

Only the dedicated design scene is replaced. The original scene is preserved.
Blender's boxes and shoulder pivots are exported for synchronous game loading,
so rendering and the existing per-part collision builder use the same shapes.
"""

import json
from pathlib import Path

import bpy
from mathutils import Vector


PROJECT = Path(__file__).resolve().parents[2]
SCENE_NAME = "Hole - Toy Characters"
HERO_SIZE = (48, 180, 42)
MONSTER_SIZE = (80, 220, 88)
PALETTE = {
    "silver": "#c6d5d9",
    "silverLight": "#e4ece6",
    "silverDark": "#819ba6",
    "red": "#c9584c",
    "redDark": "#96483f",
    "eye": "#ffe6a0",
    "cyan": "#6dd5df",
    "ink": "#334c57",
    "skin": "#486b59",
    "skinLight": "#60806a",
    "skinDark": "#344f47",
    "belly": "#8d9b79",
    "spine": "#b4c3ad",
    "spineDark": "#748f82",
    "amber": "#efb453",
    "ivory": "#e4d7b3",
}


def linear(value):
    return value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4


def create_scene():
    previous = bpy.data.scenes.get(SCENE_NAME)
    scene = bpy.data.scenes.new(SCENE_NAME + " - building")
    bpy.context.window.scene = scene
    if previous:
        for obj in list(previous.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
        bpy.data.scenes.remove(previous)
    scene.name = SCENE_NAME
    scene.world = bpy.data.worlds.new("Toy studio")
    scene.world.color = (0.22, 0.25, 0.27)
    return scene


scene = create_scene()
materials = {}
for name, color in PALETTE.items():
    rgb = [linear(int(color[i:i + 2], 16) / 255) for i in (1, 3, 5)]
    mat = bpy.data.materials.new("Toy - " + name)
    mat.diffuse_color = (*rgb, 1)
    mat.use_nodes = True
    shader = next(node for node in mat.node_tree.nodes if node.type == 'BSDF_PRINCIPLED')
    shader.inputs["Base Color"].default_value = (*rgb, 1)
    shader.inputs["Roughness"].default_value = 0.75
    mat["game_color"] = color
    materials[name] = mat


def empty(name, parent=None, position=(0, 0, 0)):
    obj = bpy.data.objects.new(name, None)
    scene.collection.objects.link(obj)
    obj.parent = parent
    obj.location = position
    return obj


class Character:
    def __init__(self, name, size, grid, offset, center_z=0):
        self.name = name
        self.size = size
        self.grid = grid
        self.center_z = center_z
        self.root = empty(name)
        self.root.location.x = offset
        self.root.location.z = size[1] / 2 - 110
        self.root["game_size"] = size
        self.root["game_model"] = name
        self.pivots = {}

    def normalized(self, point):
        x, y, z = point
        return (x / self.grid[0], y / self.grid[1] - 0.5,
                (z - self.center_z) / self.grid[2])

    def blender_position(self, point):
        x, y, z = self.normalized(point)
        # Game is Y-up / +Z-forward; Blender is Z-up / -Y-forward.
        return (x * self.size[0], -z * self.size[2], y * self.size[1])

    def pivot(self, name, at):
        pivot = empty(self.name + " - " + name, self.root, self.blender_position(at))
        pivot["game_pivot"] = name
        self.pivots[name] = pivot

    def box(self, name, size, at, color, pivot=None):
        sx, sy, sz = [size[i] / self.grid[i] * self.size[i] for i in range(3)]
        vertices = [(x * sx / 2, y * sz / 2, z * sy / 2)
                    for x, y, z in [(-1, -1, -1), (-1, -1, 1), (-1, 1, -1),
                                    (-1, 1, 1), (1, -1, -1), (1, -1, 1),
                                    (1, 1, -1), (1, 1, 1)]]
        faces = [(0, 4, 6, 2), (1, 3, 7, 5), (0, 1, 5, 4),
                 (2, 6, 7, 3), (0, 2, 3, 1), (4, 5, 7, 6)]
        mesh = bpy.data.meshes.new(self.name + " - " + name)
        mesh.from_pydata(vertices, [], [tuple(reversed(face)) for face in faces])
        mesh.materials.append(materials[color])
        obj = bpy.data.objects.new(self.name + " - " + name, mesh)
        scene.collection.objects.link(obj)
        obj.parent = self.pivots[pivot] if pivot else self.root
        obj.location = Vector(self.blender_position(at))
        if pivot:
            obj.location -= obj.parent.location
        obj["game_part"] = name
        return obj


hero = Character("hero", HERO_SIZE, (16, 32, 10), -85)
hero.box("chest", (8, 8, 4.5), (0, 20, 0), "silver")
hero.box("waist", (6, 4, 4), (0, 14, 0), "red")
hero.box("belt", (7, 1, 4.4), (0, 12.5, 0), "silverDark")
hero.box("hips", (7, 2, 4), (0, 11, 0), "redDark")
hero.box("neck", (3, 2, 3), (0, 25, 0), "silverDark")
hero.box("helmet", (6, 5.5, 5), (0, 28, 0), "silver")
hero.box("jaw", (4.5, 1.5, 4.5), (0, 25.75, 0.2), "silverLight")
hero.box("crest", (1, 1.25, 5), (0, 31.375, -0.2), "silverLight")
hero.box("crest-step", (1, 1, 3), (0, 30.25, 1), "silverLight")
hero.box("nose", (0.8, 2, 0.8), (0, 27.8, 2.7), "silverLight")
hero.box("mouth", (2.5, 0.35, 0.3), (0, 25.8, 2.55), "ink")
hero.box("chest-point", (3, 1.5, 0.4), (0, 20.2, 2.45), "red")
hero.box("sensor-rim", (2, 1.8, 0.5), (0, 21.5, 2.7), "ink")
hero.box("sensor", (1.2, 1.1, 0.6), (0, 21.5, 2.9), "cyan")
hero.box("abdomen", (3, 4, 0.4), (0, 16, 2.1), "silverLight")
for side, suffix in [(-1, "left"), (1, "right")]:
    hero.box("chest-stripe-high-" + suffix, (2, 2, 0.4), (side * 3, 23, 2.45), "red")
    hero.box("chest-stripe-low-" + suffix, (2.5, 1.5, 0.4), (side * 2, 21.5, 2.45), "red")
    hero.box("ear-" + suffix, (0.8, 2, 2), (side * 3.3, 27.8, 0), "silverDark")
    hero.box("eye-rim-" + suffix, (2.1, 1.8, 0.4), (side * 1.7, 28.6, 2.65), "ink")
    hero.box("eye-" + suffix, (1.65, 1.15, 0.5), (side * 1.7, 28.7, 2.85), "eye")
    hero.box("eye-step-" + suffix, (0.7, 0.5, 0.45), (side * 2.1, 29.4, 2.8), "eye")
    hero.box("thigh-" + suffix, (3, 5, 3.5), (side * 2.2, 7.5, 0), "silver")
    hero.box("calf-" + suffix, (3, 3, 3.5), (side * 2.2, 3.5, 0), "red")
    hero.box("boot-" + suffix, (3.8, 2, 6), (side * 2.2, 1, 1), "silverDark")
    hero.box("knee-" + suffix, (2.3, 1.5, 0.4), (side * 2.2, 5.5, 1.9), "red")
    arm = "attack-arm" if side == 1 else "other-arm"
    hero.pivot(arm, (side * 5.8, 23, 0))
    hero.box("shoulder-" + suffix, (3.2, 2, 4.5), (side * 5.8, 23, 0), "red", arm)
    hero.box("upper-arm-" + suffix, (2.5, 4, 3.5), (side * 6, 20, 0), "silver", arm)
    hero.box("forearm-" + suffix, (2.8, 3, 3.8), (side * 6, 16.5, 0.3), "red", arm)
    hero.box("fist-" + suffix, (3, 2, 4), (side * 6, 14, 0.5), "silverLight", arm)

monster = Character("monster", MONSTER_SIZE, (24, 40, 48), 85, center_z=-6)
monster.box("hips", (14, 9, 13), (0, 13, -1), "skinDark")
monster.box("body", (15, 13, 14), (0, 21, 0), "skin")
monster.box("shoulders", (13, 7, 12), (0, 27, 1), "skin")
monster.box("neck", (9, 7, 9), (0, 31, 4), "skinLight")
monster.box("head", (12, 7, 10), (0, 35, 7), "skin")
monster.box("crown", (8, 1.5, 6), (0, 39.25, 6), "skinDark")
monster.box("snout", (11, 3.5, 8), (0, 34, 14), "skinLight")
monster.box("mouth", (10.2, 0.8, 7.5), (0, 31.95, 14), "ink")
monster.box("jaw", (10, 2.5, 8), (0, 30.3, 13), "skinDark")
monster.box("belly-low", (9, 5, 1), (0, 14, 6), "belly")
monster.box("belly-mid", (10, 5, 1), (0, 19, 7), "belly")
monster.box("belly-high", (8, 5, 1), (0, 24, 7), "belly")
monster.box("throat", (5, 4, 1), (0, 28.5, 8.5), "belly")
for i, (size, at) in enumerate([
    ((10, 8, 10), (0, 11, -10)),
    ((7, 6, 10), (0, 8, -18)),
    ((4.5, 4, 8), (0, 5.5, -25)),
    ((2.5, 2, 4), (0, 4.5, -28)),
]):
    monster.box("tail-" + str(i), size, at, "skin" if i % 2 else "skinDark")
# Three rows of stepped plates remain box-built, including the tail plates.
for i, (y, z, height, depth) in enumerate([
    (32, -2, 5, 2), (27, -6.5, 6, 3), (21, -8, 7, 3.5),
    (15.5, -9, 6, 3.5), (12.5, -15, 4, 3), (9, -22, 3, 2.5),
    (6.8, -27, 2, 2),
]):
    monster.box("spine-base-" + str(i), (2, height, depth), (0, y, z), "spineDark")
    monster.box("spine-tip-" + str(i), (1.3, height * 0.55, depth + 1.5),
                (0, y + height * 0.2, z - 1), "spine")
    if i in (1, 2, 3):
        for side in (-1, 1):
            monster.box(f"spine-side-{i}-{side}", (2, height * 0.65, depth),
                        (side * 4.5, y - 0.5, z), "spineDark")
for side, suffix in [(-1, "left"), (1, "right")]:
    monster.box("thigh-" + suffix, (7, 9, 9), (side * 5.5, 8.5, 0), "skin")
    monster.box("shin-" + suffix, (5.5, 5, 8), (side * 5.5, 4.5, 1), "skinDark")
    monster.box("foot-" + suffix, (7.5, 3, 12), (side * 5.5, 1.5, 5), "skin")
    for toe in (-1, 0, 1):
        monster.box(f"claw-{suffix}-{toe}", (1.4, 1.2, 2.5),
                    (side * 5.5 + toe * 2.2, 0.6, 11.5), "ivory")
    monster.box("eye-socket-" + suffix, (0.8, 2, 3), (side * 6.1, 35.7, 10), "skinDark")
    monster.box("eye-" + suffix, (0.9, 1.2, 2), (side * 6.3, 35.7, 10.3), "amber")
    monster.box("pupil-" + suffix, (1, 1, 0.6), (side * 6.4, 35.7, 10.6), "ink")
    monster.box("brow-" + suffix, (2.2, 1, 4), (side * 5.5, 37, 10), "skinDark")
    monster.box("nostril-" + suffix, (1.4, 0.7, 0.5), (side * 3, 34.7, 17.8), "skinDark")
    monster.box("fang-" + suffix, (1.2, 1, 1), (side * 3.4, 31.8, 17.3), "ivory")
    arm = "attack-arm" if side == 1 else "other-arm"
    monster.pivot(arm, (side * 8, 26, 3))
    monster.box("upper-arm-" + suffix, (4, 5, 5), (side * 8, 24.5, 3), "skinDark", arm)
    monster.box("forearm-" + suffix, (3.5, 3.5, 7), (side * 8.5, 21.5, 6), "skin", arm)
    monster.box("hand-" + suffix, (4, 2.5, 4), (side * 8.5, 20.3, 9.5), "skinLight", arm)
    for finger in (-1, 1):
        monster.box(f"hand-claw-{suffix}-{finger}", (1, 1, 2),
                    (side * 8.5 + finger, 20, 11.5), "ivory", arm)


def game_vector(vector, size):
    return [round(vector.x / size[0], 7), round(vector.z / size[1], 7),
            round(-vector.y / size[2], 7)]


def export_character(character):
    pivots, parts = [], []
    for obj in character.root.children:
        if "game_pivot" in obj:
            pivots.append({"name": obj["game_pivot"], "at": game_vector(obj.location, character.size)})
    for obj in scene.objects:
        if "game_part" not in obj:
            continue
        ancestor = obj.parent
        if ancestor != character.root and ancestor.parent != character.root:
            continue
        dimensions = [round(obj.dimensions.x / character.size[0], 7),
                      round(obj.dimensions.z / character.size[1], 7),
                      round(obj.dimensions.y / character.size[2], 7)]
        part = {"name": obj["game_part"], "size": dimensions,
                "at": game_vector(obj.location, character.size),
                "color": obj.data.materials[0]["game_color"]}
        if "game_pivot" in obj.parent:
            part["pivot"] = obj.parent["game_pivot"]
        parts.append(part)
    return {"pivots": pivots, "parts": parts}


bpy.context.view_layer.update()
models = {c.name: export_character(c) for c in (hero, monster)}
target = PROJECT / "src/game/models/toy-characters.json"
target.write_text(json.dumps(models, indent=2) + "\n")

# The review scene presents the exact in-game proportions, with +Z as front.
floor_mesh = bpy.data.meshes.new("Studio ground")
floor_mesh.from_pydata([(-250, -250, -111), (250, -250, -111),
                       (250, 250, -111), (-250, 250, -111)], [], [(0, 1, 2, 3)])
floor = bpy.data.objects.new("Studio ground", floor_mesh)
scene.collection.objects.link(floor)
floor.data.materials.append(materials["silverLight"])

camera_data = bpy.data.cameras.new("Character review")
camera = bpy.data.objects.new("Character review", camera_data)
scene.collection.objects.link(camera)
camera.location = (340, -600, 230)
direction = Vector((0, 0, 0)) - camera.location
camera.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 440
scene.camera = camera
for name, location, energy, size in [
    ("Key", (-180, -250, 350), 1800000, 250),
    ("Fill", (250, -100, 150), 900000, 200),
    ("Rim", (50, 200, 300), 1600000, 180),
]:
    data = bpy.data.lights.new(name, 'AREA')
    data.energy, data.shape, data.size = energy, 'DISK', size
    light = bpy.data.objects.new(name, data)
    scene.collection.objects.link(light)
    light.location = location
    light.rotation_euler = (-light.location).to_track_quat('-Z', 'Y').to_euler()

scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.render.resolution_x = 1400
scene.render.resolution_y = 1000
scene.render.resolution_percentage = 100
scene.view_settings.view_transform = 'Standard'
scene.render.filepath = str(PROJECT / "reports/toy-characters-2026-11-14/blender-preview.png")
for area in bpy.context.screen.areas:
    if area.type == 'VIEW_3D':
        area.spaces.active.region_3d.view_perspective = 'CAMERA'
        area.spaces.active.shading.color_type = 'MATERIAL'
bpy.ops.wm.save_as_mainfile(filepath=str(PROJECT / "assets/blender/toy-characters.blend"))
result = {"scene": scene.name, "parts": {k: len(v["parts"]) for k, v in models.items()},
          "blend": bpy.data.filepath, "game_data": str(target)}
