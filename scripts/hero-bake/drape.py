# Drapes a showroom figure's cloth over its posed body with a cloth simulation and writes it back in bone space.
# usage: blender -b --python drape.py -- <bare posed dir> <out dir> <drape name> [--preview <dir>]
import bpy, sys, json, os, math
import numpy as np
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
src, out, name = args[0], args[1], args[2]
preview = args[args.index('--preview') + 1] if '--preview' in args else None

lerp = lambda a, b, t: a + (b - a) * t
def smoothstep(x, a, b):
    t = min(1, max(0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)

# Each sheet: `at(u, v)` is where it starts, in its bone's space (u across, v from the pinned top down), cut like the
# game's own piece but swept clear of the body so it swings in to rest. `bands` recolour rows of the outer face.

def moss_cloak():
    def at(u, v):
        x = u * 2 - 1
        # Two layers of folds: broad ones from the shoulders and narrow ones between them, deepening toward the hem.
        pleat = math.cos(x * math.pi * 3.5 + 0.6 * math.sin(v * 3)) + 0.4 * math.cos(x * math.pi * 7.5 + 1.3 + v)
        w = 0.21 + 0.22 * v ** 0.8  # cut wider than it hangs, so it gathers into folds
        y = -0.07 - v * 0.7 * (1 - 0.06 * x * x) + 0.02 * pleat * v
        return [x * w, y - 0.02, 0.022 - (0.05 + 0.08 * v) * x * x + 0.5 * v + (0.008 + 0.065 * v ** 1.2) * pleat]
    return dict(character='moss', bone='dangleBack', frames=240, cloth=dict(bending=0.6),
                sheets=[dict(nu=36, nv=40, at=at, pin=2, thick=0.026, hem=(0.93, 0.985, 0.4), outer='outer', inner='lining', bands=[(0.9, 0.975, 'trim')])])

def vega_scarf():
    # characters/designs/vega-trim.ts LONG and SHORT: knitted tails that leave the knot behind her left shoulder
    # (vega-kit.ts scarf) gathered into creases, widen, then taper to a ribbed end. They hang down her left shoulder
    # blade, clear of the ponytail down the middle of her back, the short one further out.
    tails = [dict(x=(-0.045, -0.008), length=0.46, width=(0.04, 0.094, 0.052), twist=0.3, phase=0.4, creases=1.5, outer='long', inner='longInner', bands=[(0.8, 0.835, 'stripe'), (0.87, 0.905, 'stripe')]),
             dict(x=(-0.085, -0.15), length=0.3, width=(0.036, 0.082, 0.046), twist=-0.35, phase=2.3, creases=1.25, outer='short', inner='shortInner', bands=[(0.84, 0.88, 'shortStripe')])]
    def sheet(t):
        def at(u, v):
            across = u - 0.5
            w0, w1, w2 = t['width']
            width = lerp(w0, w1, smoothstep(v, 0, 0.3)) + (w2 - w1) * smoothstep(v, 0.4, 1)
            turn = t['twist'] * smoothstep(v, 0.15, 0.95)
            x = lerp(t['x'][0], t['x'][1], v) + 0.01 * math.sin(v * 5 + t['phase']) * v
            z = lerp(-0.016, 0.03, smoothstep(v, 0, 0.12)) + 0.18 * v
            # Creases the knot pressed in, deep where it gathers the tail and easing out toward the end; the knitted
            # edges roll over a little.
            crease = (0.004 + 0.016 * (1 - smoothstep(v, 0.04, 0.85))) * math.cos(across * math.pi * 2 * t['creases'] + t['phase'])
            roll = 0.009 * (2 * across) ** 6
            return [x + across * width * math.cos(turn), 0.012 - t['length'] * v, z + crease + roll + across * width * math.sin(turn)]
        return dict(nu=10, nv=max(14, round(t['length'] / 0.012)), at=at, pin=2, thick=0.015, hem=(0.9, 0.98, 0.8), outer=t['outer'], inner=t['inner'], bands=t['bands'], outward=(0, 0, 1), reach=0.05)
    return dict(character='vega', bone='dangleBack', frames=160, sheets=[sheet(t) for t in tails],
                cloth=dict(mass=0.15, bending=0.9, self=0.0015), gravity=(0.7, -9.7, 0.9))  # hanging down the back, leaning a little in a light breeze; self
    # stays under the cell size where the tails gather at the knot (a larger one blows the sheet apart)

def clack_tabard():
    # characters/designs/clack-armor.ts skirt(): s -1 front, 1 back
    def sheet(s):
        def at(u, v):
            x = u * 2 - 1
            hem = (-0.25 if s < 0 else -0.235) - 0.03 * (1 - abs(x))
            gather = 0.45 + 0.55 * min(1, v * 5)
            # Heavy wool pleated into the belt, so it falls in folds from the waist to the hem: three broad ones with
            # narrower ones between, deepening toward the hem; the panel is cut wider at the hem than it hangs.
            pleat = 0.6 * math.cos(x * math.pi * 3 + 0.5 * s) + 0.4 * math.cos(x * math.pi * 5 + 1.2)
            if s > 0:
                wide = x * (0.085 + 0.045 * v) + 0.006 * v * v
                return [wide, lerp(0.03, hem, v), 0.13 + 0.02 * gather + (0.011 + 0.02 * v) * gather * pleat + 0.004 * v * math.sin(x * 2.2 + 0.6)]
            wide = x * (0.1 + 0.04 * v)
            rounded = (1 - (abs(x) * 0.5) ** 2.5) ** 0.4
            reach = 0.136 + 0.02 * gather + (0.012 + 0.02 * v) * gather * pleat
            return [wide, lerp(0.03, hem, v), s * reach * rounded]
        # Both shaped (`hang`): simulated, the heavy pleats crumple against the forward thigh.
        return dict(nu=36, nv=26, at=at, pin=2, thick=0.02, hem=(0.86, 0.95, 0.4), outer='panel', inner='lining', bands=[(0.86, 1.01, 'hem')], outward=(0, 0, s), hang=0.16)
    return dict(character='clack', bone='dangleHip', frames=10, sheets=[sheet(-1), sheet(1)])

spec = {'moss-cloak': moss_cloak, 'vega-scarf': vega_scarf, 'clack-tabard': clack_tabard}[name]()
if '--frames' in args: spec['frames'] = int(args[args.index('--frames') + 1])
cid = spec['character']
spec_friction = spec.get('cloth', {}).get('friction', 4)
os.makedirs(out, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
T = np.array([[1, 0, 0], [0, 0, -1], [0, 1, 0]], dtype='f8')  # three (x, y, z) -> Blender (x, -z, y); orthonormal
to_b = lambda p: p @ T.T

def add_mesh(label, pos, faces, colors=None):
    mesh = bpy.data.meshes.new(label)
    mesh.from_pydata(pos.tolist(), [], faces if isinstance(faces, list) else faces.tolist()); mesh.update()
    if colors is not None:
        attr = mesh.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
        attr.data.foreach_set('color', np.concatenate([colors, np.ones((len(colors), 1))], axis=1).ravel())
    ob = bpy.data.objects.new(label, mesh); scene.collection.objects.link(ob)
    return ob

def material(label, color=None, rough=0.85):
    mat = bpy.data.materials.new(label)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = rough
    if color is None:
        attr = mat.node_tree.nodes.new('ShaderNodeVertexColor'); attr.layer_name = 'Col'
        mat.node_tree.links.new(attr.outputs['Color'], bsdf.inputs['Base Color'])
    else:
        bsdf.inputs['Base Color'].default_value = (*color, 1)
    return mat

meta = json.load(open(f'{src}/{cid}.json'))
bones = json.load(open(f'{src}/{cid}-bones.json'))
body_mat = material('body')
soup_v, soup_f, base = [], [], 0
for k, m in enumerate(meta):
    pos = to_b(np.fromfile(f'{src}/{cid}-{k}.pos', dtype='<f4').reshape(-1, 3).astype('f8'))
    idx = np.fromfile(f'{src}/{cid}-{k}.idx', dtype='<u4').reshape(-1, 3)
    col = np.fromfile(f'{src}/{cid}-{k}.col', dtype='<f4').reshape(-1, 3) if os.path.exists(f'{src}/{cid}-{k}.col') else None
    ob = add_mesh(f'body{k}', pos, idx, col)
    ob.data.materials.append(body_mat if col is not None else material(f'plain{k}', (0.6, 0.6, 0.62), 0.5))
    soup_v.append(pos); soup_f.append(idx + base); base += len(pos)

# The figure is a soup of overlapping parts, which a cloth ratchets up and crumples against: collide with one watertight shell of it.
shell = add_mesh('shell', np.concatenate(soup_v), np.concatenate(soup_f))
remesh = shell.modifiers.new('remesh', 'REMESH'); remesh.mode = 'VOXEL'; remesh.voxel_size = 0.01; remesh.adaptivity = 0
bpy.context.view_layer.objects.active = shell
bpy.ops.object.modifier_apply(modifier='remesh')
shell.modifiers.new('col', 'COLLISION')
shell.collision.thickness_outer = 0.008
shell.collision.cloth_friction = spec_friction
shell.hide_render = True

M = np.array(bones[spec['bone']], dtype='f8').reshape(4, 4).T
Minv = np.linalg.inv(M)
group_names, cloths = [], []
def group_id(label):
    if label not in group_names: group_names.append(label)
    return group_names.index(label)

PALETTE = [(0.2, 0.5, 0.2), (0.1, 0.25, 0.1), (0.85, 0.6, 0.1), (0.8, 0.3, 0.1), (0.5, 0.2, 0.1), (0.3, 0.3, 0.6)]
for n, sh in enumerate(spec['sheets']):
    nu, nv = sh['nu'], sh['nv']
    local = np.array([sh['at'](i / nu, j / nv) for j in range(nv + 1) for i in range(nu + 1)])
    world = (np.concatenate([local, np.ones((len(local), 1))], axis=1) @ M.T)[:, :3]
    start = to_b(world)
    if sh.get('hang'):
        # Shaped instead of simulated (a short panel over a wide stance knots in the solver): the cut hangs plumb from
        # the belt, pulled taut over whatever the body pushes out beneath it, and plumb again below that.
        o = Vector(to_b((np.array([sh['outward']]) @ M[:3, :3].T))[0]).normalized()
        plumb = Vector(to_b((np.array([[0, -1, 0]]) @ M[:3, :3].T))[0]).rotation_difference(Vector((0, 0, -1))).to_matrix()
        grid = start.reshape(nv + 1, nu + 1, 3)
        top = grid[sh['pin'] - 1].copy()
        for j in range(sh['pin'], nv + 1):
            grid[j] = top + lerp(grid[j] - top, (grid[j] - top) @ np.array(plumb).T, smoothstep(j / nv, 0, 0.3))
        need = np.zeros((nv + 1, nu + 1))
        for j in range(nv + 1):
            for i in range(nu + 1):
                p = Vector(grid[j, i])
                hit, at, _, _ = shell.ray_cast(p + o * 0.6, -o)
                if hit and j / nv >= sh['hang'] and (at - p) @ o > -0.012: need[j, i] = min((at - p) @ o + 0.012, 0.12)
        for _ in range(3): need = np.maximum(need, (np.roll(need, 1, 1) + np.roll(need, -1, 1) + 2 * need) / 4)
        for i in range(nu + 1):
            col = need[:, i]; k = int(np.argmax(col)); hull = [0]
            for j in range(1, k + 1):
                while len(hull) > 1 and (col[hull[-1]] - col[hull[-2]]) * (j - hull[-2]) <= (col[j] - col[hull[-2]]) * (hull[-1] - hull[-2]): hull.pop()
                hull.append(j)
            col[:k + 1] = np.interp(range(k + 1), hull, col[hull]); col[k:] = col[k]
        start = (grid + need[:, :, None] * np.array(o)).reshape(-1, 3)
    elif 'outward' in sh:
        # A sheet that leaves the body through other parts (from under a belt, out of a scarf's wrap) would fight the
        # shell all the way down: start every point on or outside the shell's surface instead.
        o = Vector(to_b((np.array([sh['outward']]) @ M[:3, :3].T))[0]).normalized()
        push = np.zeros(len(start))
        for i, p in enumerate(start):
            p = Vector(p)
            hit, at, _, _ = shell.ray_cast(p + o * 0.6, -o)
            if hit and (at - p) @ o > -0.012: push[i] = min((at - p) @ o + 0.012, sh.get('reach', 1))
        if sh.get('rows'):
            # A wide panel keeps its cut: every row moves out as one, far enough for most of it (a strap or a
            # scabbard under one corner must not knot the row).
            push = np.repeat(np.minimum(np.percentile(push.reshape(nv + 1, nu + 1), 70, axis=1), sh['rows']), nu + 1)
        start += np.outer(push, np.array(o))
    cells = [(i, j) for j in range(nv) for i in range(nu) if not ('fringe' in sh and (j + 0.5) / nv >= sh['fringe'] and i % 2)]
    quads = [[j * (nu + 1) + i, j * (nu + 1) + i + 1, (j + 1) * (nu + 1) + i + 1, (j + 1) * (nu + 1) + i] for i, j in cells]
    ob = add_mesh(f'sheet{n}', start, quads)
    mesh = ob.data
    # Outer faces look away from the body: along `outward`, else toward the sheet's own swept start.
    away = to_b(((np.array([sh['outward']] if 'outward' in sh else [sh['at'](0.5, 0.6)]) - (0 if 'outward' in sh else np.array([sh['at'](0.5, 0.0)]))) @ M[:3, :3].T))[0]
    if sum((p.normal @ Vector(away) for p in mesh.polygons)) < 0: mesh.flip_normals()
    ob.vertex_groups.new(name='pin').add(list(range((nu + 1) * sh['pin'])), 1.0, 'REPLACE')
    if 'hem' in sh:
        # A turned hem: the cloth thickens over the last rows (`thick` there, `hem[2]` of it above).
        hem = ob.vertex_groups.new(name='hem')
        for j in range(nv + 1):
            hem.add(list(range(j * (nu + 1), (j + 1) * (nu + 1))), smoothstep(j / nv, sh['hem'][0], sh['hem'][1]), 'REPLACE')
    # Slots: the outer face and its bands, then the inner face last (solidify's offset is clamped to the last slot).
    slots = [sh['outer']] + [b[2] for b in sh['bands']] + [sh['inner']]
    slots = list(dict.fromkeys(slots))
    for label in slots: mesh.materials.append(material(f'{n}-{label}', PALETTE[group_id(label) % len(PALETTE)]))
    for poly in mesh.polygons:
        v = (cells[poly.index][1] + 0.5) / nv
        band = next((b[2] for b in sh['bands'] if b[0] <= v < b[1]), sh['outer'])
        poly.material_index = slots.index(band); poly.use_smooth = True
    cloths.append((ob, sh, slots))
    if sh.get('hang'): continue
    cl = ob.modifiers.new('cloth', 'CLOTH')
    s, o = cl.settings, {**spec.get('cloth', {}), **sh.get('cloth', {})}
    s.quality = 12; s.mass = o.get('mass', 0.15)
    s.tension_stiffness = 80; s.compression_stiffness = 80; s.shear_stiffness = 20; s.bending_stiffness = o.get('bending', 1.5)
    s.tension_damping = 6; s.compression_damping = 6; s.bending_damping = 0.6; s.air_damping = o.get('air', 3)
    s.vertex_group_mass = 'pin'
    c = cl.collision_settings
    c.use_collision = True; c.distance_min = 0.005; c.collision_quality = 4
    c.use_self_collision = True; c.self_distance_min = o.get('self', 0.004)
    cl.point_cache.frame_start = 1; cl.point_cache.frame_end = spec['frames']

if 'gravity' in spec:
    # A steady breeze: gravity leaning the way the wind blows, in the bone's frame.
    scene.gravity = Vector(to_b((np.array([spec['gravity']]) @ M[:3, :3].T))[0])
if 'wind' in spec:
    w = spec['wind']
    d = Vector(to_b((np.array([w['direction']]) @ M[:3, :3].T))[0]).normalized()
    bpy.ops.object.effector_add(type='WIND', location=(0, 0, 1.2))
    field = bpy.context.object
    field.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    field.field.strength = w['strength']; field.field.noise = w.get('noise', 0); field.field.flow = 0

scene.frame_start = 1; scene.frame_end = spec['frames']
for f in range(1, spec['frames'] + 1):
    scene.frame_set(f)
    if f % 10 == 0 or f == spec['frames']:
        deps = bpy.context.evaluated_depsgraph_get()
        print('FRAME', f, 'lowest', [round(min(v.co.z for v in ob.evaluated_get(deps).data.vertices), 3) for ob, _, _ in cloths], flush=True)

positions, normals, tri_groups, tris, base = [], [], [], [], 0
for ob, sh, slots in cloths:
    smooth = ob.modifiers.new('smooth', 'SMOOTH'); smooth.factor = 0.5; smooth.iterations = 3
    sub = ob.modifiers.new('sub', 'SUBSURF'); sub.levels = 1; sub.render_levels = 1
    solid = ob.modifiers.new('solid', 'SOLIDIFY')
    solid.thickness = sh['thick']; solid.offset = -1; solid.material_offset = len(slots) - 1; solid.material_offset_rim = 0; solid.use_rim = True
    if 'hem' in sh: solid.vertex_group = 'hem'; solid.thickness_vertex_group = sh['hem'][2]
    deps = bpy.context.evaluated_depsgraph_get()
    em = bpy.data.meshes.new_from_object(ob.evaluated_get(deps), depsgraph=deps)
    em.calc_loop_triangles()
    n = len(em.loop_triangles)
    tv = np.zeros(n * 3, dtype='i4'); em.loop_triangles.foreach_get('vertices', tv)
    tm = np.zeros(n, dtype='i4'); em.loop_triangles.foreach_get('material_index', tm)
    co = np.zeros(len(em.vertices) * 3, dtype='f8'); em.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
    vn = np.zeros(len(em.vertices) * 3, dtype='f8'); em.vertex_normals.foreach_get('vector', vn); vn = vn.reshape(-1, 3)
    positions.append((np.concatenate([co @ T, np.ones((len(co), 1))], axis=1) @ Minv.T)[:, :3])
    normals.append((vn @ T) @ Minv[:3, :3].T)
    tris.append(tv.reshape(-1, 3) + base); base += len(co)
    tri_groups.append(np.array([group_id(slots[i]) for i in tm]))
positions, normals, tris, tri_groups = np.concatenate(positions), np.concatenate(normals), np.concatenate(tris), np.concatenate(tri_groups)
assert len(positions) < 65536
with open(f'{out}/{name}.bin', 'wb') as f:
    f.write(positions.astype('<f4').tobytes())
    f.write(np.concatenate([np.clip(np.round(normals * 127), -127, 127), np.zeros((len(positions), 1))], axis=1).astype('i1').tobytes())
    for g in range(len(group_names)): f.write(tris[tri_groups == g].astype('<u2').tobytes())
json.dump({'name': name, 'vertices': len(positions), 'groups': [{'name': label, 'indices': int((tri_groups == g).sum()) * 3} for g, label in enumerate(group_names)]}, open(f'{out}/{name}.drape.json', 'w'))
print('DRAPE', name, 'tris', len(tris), 'verts', len(positions), 'groups', group_names)
if not preview: sys.exit(0)

os.makedirs(preview, exist_ok=True)
scene.render.engine = 'CYCLES'; scene.cycles.samples = 24; scene.cycles.device = 'CPU'
scene.render.resolution_x, scene.render.resolution_y = 640, 860
world_ = bpy.data.worlds.new('w'); scene.world = world_; world_.use_nodes = True
world_.node_tree.nodes['Background'].inputs[0].default_value = (0.55, 0.6, 0.7, 1)
world_.node_tree.nodes['Background'].inputs[1].default_value = 0.7
bpy.ops.object.light_add(type='SUN', rotation=(math.radians(50), 0, math.radians(140))); bpy.context.object.data.energy = 3.5
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); scene.collection.objects.link(cam); scene.camera = cam
cam.data.lens = 60
P = np.array(bones['pelvis'], dtype='f8').reshape(4, 4).T
back = math.atan2(P[0, 2], P[2, 2])  # the figure's own +Z (its back), as a heading in three's XZ plane
# `--zoom <m>` frames the drape's own bone from that distance instead of the whole figure.
zoom = float(args[args.index('--zoom') + 1]) if '--zoom' in args else None
aim = Vector(to_b(M[:3, 3])) - Vector((0, 0, 0.12)) if zoom else Vector((0, 0, 0.95))
for label, angle in (('back', 0), ('side', 80), ('front', 180), ('q', -45)):
    a = math.radians(angle) + back
    d = Vector((math.sin(a), -math.cos(a), 0))
    cam.location = aim + d * zoom + Vector((0, 0, 0.1)) if zoom else Vector((0, 0, 1.0)) + d * 4.2 + Vector((0, 0, 0.35))
    cam.rotation_euler = (aim - cam.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = f'{preview}/{name}-{label}.png'
    bpy.ops.render.render(write_still=True)
