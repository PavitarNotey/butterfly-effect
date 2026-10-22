"""Merge the already licensed 3B.1 GLB into one skinned draw primitive.

No new asset or motion data. Preserve the original skin and animation channels.
Kit colors and numbers are applied on the body surface by the runtime material.
Run from any directory: python3 frontend/scripts/optimize_character.py
"""
import copy
import hashlib
import json
from pathlib import Path
import struct


def build():
    public = Path(__file__).resolve().parents[1] / 'public/characters'
    data = (public / 'voss/player.glb').read_bytes()
    assert hashlib.sha256(data).hexdigest() == '4fd5b79211ca0b659f8a84fb1013949fe1ffc6d4c2ec4c802d4fe11d4fce303c'
    size = struct.unpack_from('<I', data, 12)[0]
    source = json.loads(data[20:20 + size])
    blob = data[28 + size:]
    result = {k: copy.deepcopy(source[k]) for k in ['asset', 'scene', 'scenes', 'nodes', 'skins', 'animations']}
    result.update(accessors=[], bufferViews=[], buffers=[], meshes=[], materials=[])
    binary = bytearray()

    def append(raw):
        binary.extend(b'\0' * (-len(binary) % 4))
        result['bufferViews'].append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': len(raw)})
        binary.extend(raw)
        return len(result['bufferViews']) - 1

    def values(index):
        a = source['accessors'][index]
        view = source['bufferViews'][a['bufferView']]
        components = {'SCALAR': 1, 'VEC3': 3, 'VEC4': 4}[a['type']]
        fmt = {5121: 'B', 5123: 'H', 5125: 'I', 5126: 'f'}[a['componentType']]
        offset = view.get('byteOffset', 0) + a.get('byteOffset', 0)
        return list(struct.iter_unpack('<' + fmt * components, blob[offset:offset + a['count'] * components * struct.calcsize(fmt)]))

    def attribute(data, kind, component=5126):
        flat = [v for row in data for v in row]
        view = append(struct.pack('<' + ('f' if component == 5126 else 'H') * len(flat), *flat))
        a = {'bufferView': view, 'componentType': component, 'count': len(data), 'type': kind}
        if kind == 'VEC3':
            a.update(min=[min(v[i] for v in data) for i in range(3)], max=[max(v[i] for v in data) for i in range(3)])
        result['accessors'].append(a)
        return len(result['accessors']) - 1

    positions, normals, joints, weights, colors, indices = [], [], [], [], [], []
    seen = {}
    for mesh in source['meshes']:
        for p in mesh['primitives']:
            key = p['attributes']['POSITION']
            if key not in seen:
                seen[key] = len(positions)
                pos = values(key)
                positions.extend(pos)
                normals.extend(values(p['attributes']['NORMAL']))
                joints.extend(values(p['attributes']['JOINTS_0']))
                weights.extend(values(p['attributes']['WEIGHTS_0']))
                # Surface parts retain a small color marker: white=body, dark=face detail.
                face = mesh['name'].startswith('Face')
                colors.extend([(0.035, 0.025, 0.018) if face else (1., 1., 1.)] * len(pos))
            indices.extend((row[0] + seen[key],) for row in values(p['indices']))
    attributes = {name: attribute(data, kind, component) for name, data, kind, component in [
        ('POSITION', positions, 'VEC3', 5126), ('NORMAL', normals, 'VEC3', 5126),
        ('JOINTS_0', joints, 'VEC4', 5123), ('WEIGHTS_0', weights, 'VEC4', 5126), ('COLOR_0', colors, 'VEC3', 5126),
    ]}
    result['meshes'] = [{'name': 'Footballer', 'primitives': [{'attributes': attributes, 'indices': attribute(indices, 'SCALAR', 5123), 'material': 0}]}]
    # Retain the base skeleton exactly; replace three mesh nodes with one skin.
    for node in result['nodes']:
        if 'mesh' in node:
            if node['mesh'] == 2:
                node['mesh'] = 0
                node['name'] = 'Footballer'
            else:
                node.pop('mesh')
                node.pop('skin', None)
    cache = {}

    def copy_accessor(index):
        if index not in cache:
            a = copy.deepcopy(source['accessors'][index])
            view = source['bufferViews'][a['bufferView']]
            start = view.get('byteOffset', 0)
            a['bufferView'] = append(blob[start:start + view['byteLength']])
            cache[index] = len(result['accessors'])
            result['accessors'].append(a)
        return cache[index]

    for skin in result['skins']:
        skin['inverseBindMatrices'] = copy_accessor(skin['inverseBindMatrices'])
    for clip in result['animations']:
        for sampler in clip['samplers']:
            sampler['input'] = copy_accessor(sampler['input'])
            sampler['output'] = copy_accessor(sampler['output'])
    result['materials'] = [{'name': 'FootballKit', 'pbrMetallicRoughness': {'metallicFactor': 0, 'roughnessFactor': .88}}]
    result['asset']['copyright'] += '; single-primitive surface-kit adaptation'
    result['buffers'] = [{'byteLength': len(binary)}]
    encoded = json.dumps(result, separators=(',', ':')).encode()
    encoded += b' ' * (-len(encoded) % 4)
    binary.extend(b'\0' * (-len(binary) % 4))
    glb = struct.pack('<III', 0x46546C67, 2, 28 + len(encoded) + len(binary)) + struct.pack('<I4s', len(encoded), b'JSON') + encoded + struct.pack('<I4s', len(binary), b'BIN\0') + binary
    target = public / 'football-player.glb'
    target.write_bytes(glb)
    print(f'{target}: {len(glb):,} bytes, {len(indices) // 3:,} triangles; SHA256 {hashlib.sha256(glb).hexdigest()}')


if __name__ == '__main__':
    build()
