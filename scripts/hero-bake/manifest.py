# Writes manifest.json for the showroom assets found in a folder. usage: python3 manifest.py <dir>
import json, os, sys
d = sys.argv[1]
occlusion = [{'id': f[:-8], **json.load(open(f'{d}/{f}'))} for f in sorted(os.listdir(d)) if f.endswith('.ao.json')]
drapes = [json.load(open(f'{d}/{f}')) for f in sorted(os.listdir(d)) if f.endswith('.drape.json')]
json.dump({'occlusion': occlusion, 'drapes': drapes}, open(f'{d}/manifest.json', 'w'))
print('manifest', [o['id'] for o in occlusion], [x['name'] for x in drapes])
