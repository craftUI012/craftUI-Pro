# Renders the Studio's phone mockup with Blender (Cycles), from code: no
# downloaded models. A generic modern phone (no brand marks): titanium band,
# black glass front, a camera pill and side buttons, around a screen shaped
# like a 390x844 phone viewport.
#
# The screen is a holdout, so it renders fully transparent: the Studio lays
# the video under the PNG and it shows through. The shadow is added by
# build.mjs from the phone's silhouette (Cycles' shadow catcher left
# speckles in the transparency that denoising doesn't clean).
#
# For each view it writes <out>/phone-<view>.png and <out>/phone-<view>.json
# with the screen's four corners in image pixels (top-left, top-right,
# bottom-right, bottom-left), which the Studio maps the video onto.
#
# Run it through scripts/studio-devices/build.mjs, or by hand:
#   Blender -b -P scripts/studio-devices/phone.py -- --out <dir> [--views front,three-quarter] [--samples 256] [--finish titanium]

import argparse
import json
import math
import os
import sys

import bmesh
import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Euler, Vector

# ── Inputs ─────────────────────────────────────────────────────────────────

argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
parser = argparse.ArgumentParser()
parser.add_argument("--out", required=True)
parser.add_argument("--views", default="front,three-quarter")
parser.add_argument("--samples", type=int, default=256)
parser.add_argument("--finish", default="titanium")
parser.add_argument("--height", type=int, default=2600, help="image height, px")
args = parser.parse_args(argv)

# ── The phone, in centimetres (1 Blender unit = 1 cm) ─────────────────────
# The screen matches a 390x844 viewport (aspect 2.164); the bezel and band
# are thin, like current phones.

SCREEN_W = 6.46
SCREEN_H = SCREEN_W * 844 / 390
SCREEN_R = 0.86  # corner radius
BEZEL = 0.17
BODY_W = SCREEN_W + BEZEL * 2 + 0.12
BODY_H = SCREEN_H + BEZEL * 2 + 0.12
BODY_R = SCREEN_R + BEZEL + 0.06
BODY_D = 0.78  # thickness
EDGE = 0.16  # how round the band's front and back edges are
PILL = {"w": 2.1, "h": 0.6, "top": 0.36}  # camera pill, from the screen top

FINISHES = {
    # base colour (linear), roughness
    "titanium": ((0.36, 0.35, 0.33), 0.32),
    "black": ((0.035, 0.035, 0.04), 0.3),
    "silver": ((0.78, 0.78, 0.8), 0.25),
}

VIEWS = {
    # rotation of the phone (degrees), camera lens (mm), orthographic?
    "front": {"rot": (0, 0, 0), "ortho": True},
    "three-quarter": {"rot": (8, -30, 2), "ortho": False, "lens": 135},
}


# ── Helpers ────────────────────────────────────────────────────────────────


def rounded_rect(w, h, r, segments=24):
    """Outline of a rounded rectangle centred on 0, counter-clockwise."""
    points = []
    corners = [
        (w / 2 - r, h / 2 - r, 0),
        (-w / 2 + r, h / 2 - r, 90),
        (-w / 2 + r, -h / 2 + r, 180),
        (w / 2 - r, -h / 2 + r, 270),
    ]
    for cx, cy, start in corners:
        for i in range(segments + 1):
            a = math.radians(start + 90 * i / segments)
            points.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return points


def slab(name, w, h, r, depth, z, segments=24):
    """A rounded-rectangle slab from z to z + depth."""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    verts = [bm.verts.new((x, y, z)) for x, y in rounded_rect(w, h, r, segments)]
    face = bm.faces.new(verts)
    if depth:
        result = bmesh.ops.extrude_face_region(bm, geom=[face])
        moved = [v for v in result["geom"] if isinstance(v, bmesh.types.BMVert)]
        bmesh.ops.translate(bm, verts=moved, vec=(0, 0, depth))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return obj


def smooth(obj, bevel=0.0, segments=10):
    if bevel:
        mod = obj.modifiers.new("Bevel", "BEVEL")
        mod.width = bevel
        mod.segments = segments
        mod.limit_method = "ANGLE"
        mod.angle_limit = math.radians(60)
        mod.harden_normals = True
    obj.modifiers.new("Normals", "WEIGHTED_NORMAL").keep_sharp = True
    for poly in obj.data.polygons:
        poly.use_smooth = True


def principled(name, color, roughness, metallic=0.0, coat=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if coat:
        bsdf.inputs["Coat Weight"].default_value = coat
        bsdf.inputs["Coat Roughness"].default_value = 0.02
    return mat


def holdout(name):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    nodes.clear()
    out = nodes.new("ShaderNodeOutputMaterial")
    hold = nodes.new("ShaderNodeHoldout")
    mat.node_tree.links.new(hold.outputs[0], out.inputs["Surface"])
    return mat


def studio_hdri():
    """One of Blender's own studio lights, for reflections on metal and glass."""
    root = os.path.dirname(bpy.app.binary_path)
    version = f"{bpy.app.version[0]}.{bpy.app.version[1]}"
    folder = os.path.join(root, "..", "Resources", version, "datafiles", "studiolights", "world")
    for name in ("studio.exr", "city.exr", "interior.exr"):
        path = os.path.normpath(os.path.join(folder, name))
        if os.path.exists(path):
            return path
    return None


# ── Scene ──────────────────────────────────────────────────────────────────


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = args.samples
    scene.cycles.use_denoising = True
    # Clamp stray bright samples (fireflies) on the shadow wall and glass.
    scene.cycles.sample_clamp_indirect = 1.0
    # No caustics: light bouncing off the polished band onto the shadow wall
    # shows up as specks.
    scene.cycles.caustics_reflective = False
    scene.cycles.caustics_refractive = False
    scene.render.film_transparent = True
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        prefs.compute_device_type = "METAL"
        prefs.get_devices()
        for device in prefs.devices:
            device.use = True
        scene.cycles.device = "GPU"
    except Exception:  # noqa: BLE001 - fall back to the CPU
        scene.cycles.device = "CPU"
    return scene


def world(scene):
    """Blender's studio HDRI, seen only in reflections (glossy rays), so the
    metal and glass look studio-lit; everything else sees an even grey,
    which gives a soft contact shadow instead of the HDRI's hard one."""
    world = bpy.data.worlds.new("World")
    scene.world = world
    world.use_nodes = True
    tree = world.node_tree
    nodes = tree.nodes
    nodes.clear()
    out = nodes.new("ShaderNodeOutputWorld")
    ambient = nodes.new("ShaderNodeBackground")
    ambient.inputs["Color"].default_value = (0.8, 0.8, 0.8, 1)
    ambient.inputs["Strength"].default_value = 0.35
    reflect = nodes.new("ShaderNodeBackground")
    reflect.inputs["Strength"].default_value = 1.5
    path = studio_hdri()
    if path:
        env = nodes.new("ShaderNodeTexEnvironment")
        env.image = bpy.data.images.load(path)
        mapping = nodes.new("ShaderNodeMapping")
        coord = nodes.new("ShaderNodeTexCoord")
        tree.links.new(coord.outputs["Generated"], mapping.inputs["Vector"])
        tree.links.new(mapping.outputs["Vector"], env.inputs["Vector"])
        mapping.inputs["Rotation"].default_value = (0, 0, math.radians(200))
        tree.links.new(env.outputs["Color"], reflect.inputs["Color"])
    else:
        reflect.inputs["Color"].default_value = (0.8, 0.8, 0.8, 1)
    path_info = nodes.new("ShaderNodeLightPath")
    mix = nodes.new("ShaderNodeMixShader")
    tree.links.new(path_info.outputs["Is Glossy Ray"], mix.inputs["Fac"])
    tree.links.new(ambient.outputs["Background"], mix.inputs[1])
    tree.links.new(reflect.outputs["Background"], mix.inputs[2])
    tree.links.new(mix.outputs["Shader"], out.inputs["Surface"])


def lights():
    """A big soft key from top-left-front, a rim from the right, a fill."""

    def area(name, location, rotation, size, energy, shadow=True):
        data = bpy.data.lights.new(name, "AREA")
        data.shape = "RECTANGLE"
        data.size = size[0]
        data.size_y = size[1]
        data.energy = energy
        # Only the key casts a shadow, so the wall gets one soft shadow.
        data.use_shadow = shadow
        obj = bpy.data.objects.new(name, data)
        obj.location = location
        obj.rotation_euler = Euler([math.radians(a) for a in rotation])
        bpy.context.collection.objects.link(obj)

    # Big softboxes: on polished metal a light is only seen in reflection,
    # so their size is what draws the band's long highlights.
    area("Key", (-14, 18, 30), (-30, -22, 0), (24, 24), 9000)
    area("Rim", (22, 4, 6), (0, 75, 0), (8, 34), 3400, shadow=False)
    area("RimLeft", (-22, -2, 6), (0, -75, 0), (8, 34), 2600, shadow=False)
    area("Fill", (6, -20, 22), (40, 12, 0), (30, 12), 1400, shadow=False)


def build_phone(finish):
    color, roughness = FINISHES[finish]
    band = principled("Band", color, roughness, metallic=1.0)
    glass = principled("Glass", (0.006, 0.006, 0.007), 0.04, coat=1.0)
    pill_mat = principled("Pill", (0.002, 0.002, 0.002), 0.08, coat=1.0)
    screen_mat = holdout("Screen")

    parts = []
    body = slab("Body", BODY_W, BODY_H, BODY_R, BODY_D, -BODY_D, 32)
    body.data.materials.append(band)
    smooth(body, bevel=EDGE, segments=12)
    parts.append(body)

    # Front glass sits a hair proud of the band, inside its rounded edge.
    front = slab("Front", BODY_W - 0.1, BODY_H - 0.1, BODY_R - 0.05, 0.03, -0.01, 32)
    front.data.materials.append(glass)
    smooth(front, bevel=0.012, segments=4)
    parts.append(front)

    screen = slab("Screen", SCREEN_W, SCREEN_H, SCREEN_R, 0, 0.0215, 32)
    screen.data.materials.append(screen_mat)
    parts.append(screen)

    pill_y = SCREEN_H / 2 - PILL["top"] - PILL["h"] / 2
    pill = slab("Pill", PILL["w"], PILL["h"], PILL["h"] / 2, 0.004, 0.022, 16)
    pill.location.y = pill_y
    pill.data.materials.append(pill_mat)
    parts.append(pill)

    # Side buttons: power on the right, two volume and an action on the left.
    def button(name, x, y, length):
        obj = slab(name, 0.12, length, 0.06, BODY_D * 0.42, -BODY_D * 0.71, 8)
        obj.location = (x, y, 0)
        obj.data.materials.append(band)
        smooth(obj)
        parts.append(obj)

    side = BODY_W / 2 + 0.035
    button("Power", side, 2.2, 1.6)
    button("VolumeUp", -side, 2.6, 1.15)
    button("VolumeDown", -side, 1.15, 1.15)
    button("Action", -side, 4.15, 0.55)

    rig = bpy.data.objects.new("Phone", None)
    bpy.context.collection.objects.link(rig)
    for part in parts:
        part.parent = rig
    return rig, screen


def camera(scene, view):
    cam_data = bpy.data.cameras.new("Camera")
    cam = bpy.data.objects.new("Camera", cam_data)
    bpy.context.collection.objects.link(cam)
    scene.camera = cam
    cam.location = (0, 0, 120)
    cam.rotation_euler = (0, 0, 0)
    if view["ortho"]:
        cam_data.type = "ORTHO"
        cam_data.ortho_scale = BODY_H * 1.08
    else:
        cam_data.type = "PERSP"
        cam_data.lens = view["lens"]
        cam_data.sensor_fit = "VERTICAL"
        # Frame the phone's height with the same margin as the front view.
        cam_data.sensor_height = 2 * view["lens"] * math.tan(
            math.atan((BODY_H * 1.08) / 2 / 120)
        )
    cam_data.clip_end = 1000
    return cam


def screen_corners(scene, cam, screen):
    """Screen corners in image pixels: TL, TR, BR, BL."""
    w, h = SCREEN_W / 2, SCREEN_H / 2
    local = [Vector((-w, h, 0.0215)), Vector((w, h, 0.0215)), Vector((w, -h, 0.0215)), Vector((-w, -h, 0.0215))]
    res_x = scene.render.resolution_x
    res_y = scene.render.resolution_y
    out = []
    for point in local:
        world = screen.parent.matrix_world @ point
        ndc = world_to_camera_view(scene, cam, world)
        out.append([round(ndc.x * res_x, 2), round((1 - ndc.y) * res_y, 2)])
    return out


def render(name, view):
    scene = reset()
    world(scene)
    lights()
    rig, screen = build_phone(args.finish)
    rig.rotation_euler = Euler([math.radians(a) for a in view["rot"]])
    cam = camera(scene, view)
    scene.render.resolution_y = args.height
    # Wide enough for the phone, its rotation and its shadow.
    scene.render.resolution_x = round(args.height * (0.56 if view["ortho"] else 0.7))
    if not view["ortho"]:
        cam.data.sensor_fit = "VERTICAL"
    bpy.context.view_layer.update()
    corners = screen_corners(scene, cam, screen)
    os.makedirs(args.out, exist_ok=True)
    base = os.path.join(args.out, f"phone-{name}")
    scene.render.filepath = base + ".png"
    bpy.ops.render.render(write_still=True)
    with open(base + ".json", "w") as handle:
        json.dump(
            {
                "finish": args.finish,
                "height": scene.render.resolution_y,
                "screen": corners,
                # Corner radius of the screen, as a share of its width: the
                # video is rounded by this before it's mapped in.
                "screenRadius": round(SCREEN_R / SCREEN_W, 4),
                "view": name,
                "viewport": {"height": 844, "width": 390},
                "width": scene.render.resolution_x,
            },
            handle,
            indent=2,
        )
    print(f"wrote {base}.png")


for view_name in [v.strip() for v in args.views.split(",") if v.strip()]:
    render(view_name, VIEWS[view_name])
