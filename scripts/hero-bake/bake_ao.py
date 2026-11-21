# Bakes ambient occlusion for a posed showroom figure into one byte per vertex.
# usage: blender -b --python bake_ao.py -- <posed dir> <id> <out dir> [samples] [distance]
import bpy, sys, json, os
import numpy as np

args = sys.argv[sys.argv.index('--') + 1:]
src, cid, out = args[0], args[1], args[2]
samples = int(args[3]) if len(args) > 3 else 96
distance = float(args[4]) if len(args) > 4 else 0.35

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = samples
world = bpy.data.worlds.new('w'); scene.world = world
world.light_settings.distance = distance

def y_up(p):  # three.js (x, y, z) -> Blender (x, -z, y)
    return np.stack([p[:, 0], -p[:, 2], p[:, 1]], axis=1)

meta = json.load(open(f'{src}/{cid}.json'))
objs = []
for k, m in enumerate(meta):
    pos = y_up(np.fromfile(f'{src}/{cid}-{k}.pos', dtype='<f4').reshape(-1, 3))
    idx = np.fromfile(f'{src}/{cid}-{k}.idx', dtype='<u4').reshape(-1, 3)
    mesh = bpy.data.meshes.new(f'm{k}')
    mesh.from_pydata(pos.tolist(), [], idx.tolist())
    mesh.update()
    assert len(mesh.vertices) == len(pos), 'validate changed the vertex count'
    ob = bpy.data.objects.new(f'o{k}', mesh); scene.collection.objects.link(ob)
    objs.append((ob, m, pos))

# The stand under the feet occludes too.
bpy.ops.mesh.primitive_circle_add(radius=2.2, fill_type='NGON', location=(0, 0, 0))
ground = bpy.context.object

result, strength = [], []
for ob, m, pos in objs:
    if not m['skinned']:
        continue
    mesh = ob.data
    attr = mesh.color_attributes.new('ao', 'FLOAT_COLOR', 'POINT')
    mesh.color_attributes.active_color = attr
    mat = bpy.data.materials.new('bake')
    mesh.materials.append(mat)
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True); bpy.context.view_layer.objects.active = ob
    scene.render.bake.target = 'VERTEX_COLORS'
    bpy.ops.object.bake(type='AO')
    col = np.zeros(len(mesh.vertices) * 4, dtype='f4')
    mesh.color_attributes['ao'].data.foreach_get('color', col)
    ao = col.reshape(-1, 4)[:, 0].astype('f8')
    # The figure's triangles share no vertices: average coincident corners so neighbours agree.
    keys = np.round(pos * 5000).astype(np.int64)
    _, inverse = np.unique(keys, axis=0, return_inverse=True)
    inverse = inverse.ravel()
    weld = lambda a: (np.bincount(inverse, weights=a) / np.bincount(inverse))[inverse]
    ao = weld(ao)
    # A corner buried under another part is never seen, but it would shade the visible rest of its triangle:
    # give it what its triangle's open corners have.
    tri = ao.reshape(-1, 3).copy()
    for _ in range(3):
        open_ = tri > 0.12
        n = open_.sum(axis=1)
        fill = np.where(n > 0, (tri * open_).sum(axis=1) / np.maximum(n, 1), tri.mean(axis=1))
        tri = np.where(open_ | (n == 0)[:, None], tri, fill[:, None])
    ao = weld(tri.ravel())
    # Faces carry the character: shade the head (neck, head, hat bones) far less than the body.
    bone = np.fromfile(f'{src}/{cid}-{objs.index((ob, m, pos))}.bone', dtype='<u2')
    strength.append(np.where((bone >= 3) & (bone <= 5), 0.35, 0.8))
    result.append(ao)

ao = np.concatenate(result)
print('PCT', [round(float(np.percentile(ao, p)), 2) for p in (10, 25, 50, 75, 90)])
print('AO', cid, 'verts', len(ao), 'min %.3f mean %.3f p10 %.3f' % (ao.min(), ao.mean(), np.percentile(ao, 10)))
os.makedirs(out, exist_ok=True)
# Open surfaces bake to ~0.9, not 1: stretch them to full brightness, and keep the darkest crevice from going black.
shade = 1 - np.concatenate(strength) * (1 - np.minimum(1, ao / 0.9))
# Sixteen levels, two vertices per byte (low nibble first).
q = np.clip(np.round(shade * 15), 0, 15).astype('u1')
if len(q) % 2: q = np.append(q, 15)
(q[0::2] | (q[1::2] << 4)).astype('u1').tofile(f'{out}/{cid}.ao')
json.dump({'vertices': int(len(ao))}, open(f'{out}/{cid}.ao.json', 'w'))
