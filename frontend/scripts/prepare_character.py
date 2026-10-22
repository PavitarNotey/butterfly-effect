"""Build the small distributable prototype from the two official CC0 archives.

Usage: python3 scripts/prepare_character.py BASE.zip ANIMATION.zip
No Blender, network, third-party Python packages or runtime retargeter required.
"""
import copy
import hashlib
import json
from pathlib import Path
import struct
import sys
import zipfile

EXPECTED = [
    'fdbf1804c90dfc1ea03e992bff7da2dfd1a79318e13270a660180f9308455f40',
    'cc73fc4e495b82958207316596317a3f40b9fa38065bde1027937452da537724',
]


def build(base_path, animation_path):
    for path, expected in zip([base_path, animation_path], EXPECTED):
        if hashlib.sha256(Path(path).read_bytes()).hexdigest() != expected:
            raise ValueError('Archive differs from the reviewed CC0 release')
    base_zip, animation_zip = zipfile.ZipFile(base_path), zipfile.ZipFile(animation_path)
    base_name = 'Universal Base Characters[Standard]/Base Characters/Godot - UE/Superhero_Male_FullBody.gltf'
    base = json.loads(base_zip.read(base_name))
    base_bin = base_zip.read(base_name.replace('.gltf', '.bin'))
    clip_glb = animation_zip.read('Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb')
    json_size = struct.unpack_from('<I', clip_glb, 12)[0]
    source = json.loads(clip_glb[20:20 + json_size])
    source_bin = clip_glb[28 + json_size:]
    result = {k: copy.deepcopy(base[k]) for k in ['asset', 'scene', 'scenes', 'nodes', 'skins']}
    result.update(bufferViews=[], accessors=[], meshes=[], animations=[], materials=[])
    result['asset']['copyright'] = 'Quaternius — CC0 1.0; Butterfly Effect kit adaptation'
    binary = bytearray()

    def append(data):
        while len(binary) % 4:
            binary.append(0)
        index = len(result['bufferViews'])
        result['bufferViews'].append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': len(data)})
        binary.extend(data)
        return index

    def accessor(g, blob, index):
        a = copy.deepcopy(g['accessors'][index])
        v = g['bufferViews'][a['bufferView']]
        assert not v.get('byteStride') and not a.get('sparse')
        start = v.get('byteOffset', 0)
        a['bufferView'] = append(blob[start:start + v['byteLength']])
        result['accessors'].append(a)
        return len(result['accessors']) - 1

    def values(g, blob, index):
        a = g['accessors'][index]
        v = g['bufferViews'][a['bufferView']]
        count = {'SCALAR': 1, 'VEC3': 3, 'VEC4': 4}[a['type']]
        fmt = {5123: 'H', 5125: 'I', 5126: 'f'}[a['componentType']]
        return list(struct.iter_unpack('<' + fmt * count, blob[v.get('byteOffset', 0) + a.get('byteOffset', 0):][:a['count'] * count * struct.calcsize(fmt)]))

    colors = [('skin', [.56, .31, .18]), ('kit', [.13, .55, .69]), ('shorts', [.009, .018, .025]),
              ('socks', [.73, .85, .9]), ('boots', [.025, .033, .04]), ('hair', [.025, .016, .012]), ('eyes', [.035, .025, .018])]
    for name, color in colors:
        result['materials'].append({'name': name, 'pbrMetallicRoughness': {'baseColorFactor': color + [1], 'metallicFactor': 0, 'roughnessFactor': .85}})
    for mesh in base['meshes']:
        primitives = []
        for primitive in mesh['primitives']:
            attributes = {name: accessor(base, base_bin, i) for name, i in primitive['attributes'].items() if name in ['POSITION', 'NORMAL', 'JOINTS_0', 'WEIGHTS_0']}
            positions = values(base, base_bin, primitive['attributes']['POSITION'])
            indices = [v[0] for v in values(base, base_bin, primitive['indices'])]
            groups = {}
            for i in range(0, len(indices), 3):
                triangle = indices[i:i + 3]
                x, y, _ = [sum(positions[j][axis] for j in triangle) / 3 for axis in range(3)]
                if primitive['material'] != 2:
                    material = 5 if primitive['material'] == 0 else 6
                elif y > 1.755:
                    material = 5  # Close cropped hair, no texture dependency.
                elif y < .115:
                    material = 4
                elif y < .43:
                    material = 3
                elif .64 < y < .96:
                    material = 2
                elif .96 <= y < 1.61 and abs(x) < .60:
                    material = 1
                else:
                    material = 0
                groups.setdefault(material, []).extend(triangle)
            for material, group in groups.items():
                view = append(struct.pack('<' + 'H' * len(group), *group))
                result['accessors'].append({'bufferView': view, 'componentType': 5123, 'count': len(group), 'type': 'SCALAR'})
                primitives.append({'attributes': attributes, 'indices': len(result['accessors']) - 1, 'material': material})
        result['meshes'].append({'name': mesh['name'], 'primitives': primitives})
    for skin in result['skins']:
        skin['inverseBindMatrices'] = accessor(base, base_bin, skin['inverseBindMatrices'])
    nodes = {node['name']: i for i, node in enumerate(base['nodes'])}
    for clip in source['animations']:
        if clip['name'] not in ['Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop']:
            continue
        output = {'name': clip['name'], 'channels': [], 'samplers': []}
        for channel in clip['channels']:
            target = channel['target']
            name = source['nodes'][target['node']]['name']
            # No root animation or bone length/scale changes. Compatible universal
            # hierarchy rotations only; preserve this character's bind lengths.
            if name == 'root' or (target['path'] != 'rotation' and not (name == 'pelvis' and target['path'] == 'translation')):
                continue
            sampler = clip['samplers'][channel['sampler']]
            time_index = accessor(source, source_bin, sampler['input'])
            if target['path'] == 'translation':
                bind = base['nodes'][nodes[name]]['translation']
                old_bind = source['nodes'][target['node']]['translation']
                # Pelvis local Z is vertical under the fixed -90deg root rotation.
                data = [v for p in values(source, source_bin, sampler['output']) for v in [bind[0], bind[1], bind[2] + p[2] - old_bind[2]]]
                view = append(struct.pack('<' + 'f' * len(data), *data))
                result['accessors'].append({'bufferView': view, 'componentType': 5126, 'count': len(data) // 3, 'type': 'VEC3'})
                value_index = len(result['accessors']) - 1
            else:
                value_index = accessor(source, source_bin, sampler['output'])
            output['channels'].append({'sampler': len(output['samplers']), 'target': {'node': nodes[name], 'path': target['path']}})
            output['samplers'].append({'input': time_index, 'output': value_index, 'interpolation': sampler.get('interpolation', 'LINEAR')})
        result['animations'].append(output)
    result['buffers'] = [{'byteLength': len(binary)}]
    encoded = json.dumps(result, separators=(',', ':')).encode()
    encoded += b' ' * (-len(encoded) % 4)
    binary.extend(b'\0' * (-len(binary) % 4))
    glb = struct.pack('<III', 0x46546C67, 2, 28 + len(encoded) + len(binary)) + struct.pack('<I4s', len(encoded), b'JSON') + encoded + struct.pack('<I4s', len(binary), b'BIN\0') + binary
    path = Path(__file__).resolve().parents[1] / 'public/characters/voss/player.glb'
    path.write_bytes(glb)
    print(f'{path}: {len(glb):,} bytes; SHA256 {hashlib.sha256(glb).hexdigest()}')


if __name__ == '__main__':
    build(*sys.argv[1:])
