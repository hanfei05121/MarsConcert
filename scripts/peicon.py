import struct, sys

path = sys.argv[1]
d = open(path, 'rb').read()
pe_off = struct.unpack('<I', d[0x3c:0x40])[0]
assert d[pe_off:pe_off + 4] == b'PE\0\0', 'not PE'
machine, nsec, _, _, _, opt_size, _ = struct.unpack('<HHIIIHH', d[pe_off + 4:pe_off + 24])
opt = pe_off + 24
magic = struct.unpack('<H', d[opt:opt + 2])[0]
is64 = magic == 0x20b
dd_off = opt + (112 if is64 else 96)
res_rva, res_size = struct.unpack('<II', d[dd_off + 16:dd_off + 24])

sec_off = opt + opt_size
secs = []
for i in range(nsec):
    o = sec_off + i * 40
    name = d[o:o + 8].rstrip(b'\0').decode('latin1')
    vsize, vaddr, rsize, raddr = struct.unpack('<IIII', d[o + 8:o + 24])
    secs.append((name, vaddr, vsize, raddr, rsize))

def rva2off(rva):
    for n, va, vs, ra, rs in secs:
        if va <= rva < va + max(vs, rs):
            return ra + (rva - va)
    return None

def entries(off):
    _, _, _, _, nname, nid = struct.unpack('<IIHHHH', d[off:off + 16])
    out = []
    for i in range(nname + nid):
        e = off + 16 + i * 8
        name_or_id, data_off = struct.unpack('<II', d[e:e + 8])
        out.append((name_or_id, data_off))
    return out

base = rva2off(res_rva)
leaves = []
def walk(off, path):
    for name_or_id, data_off in entries(off):
        if data_off & 0x80000000:
            walk(base + (data_off & 0x7fffffff), path + [name_or_id])
        else:
            e = base + data_off
            data_rva, size, _, _ = struct.unpack('<IIII', d[e:e + 16])
            leaves.append((tuple(path), name_or_id, data_rva, size, rva2off(data_rva)))

walk(base, [])

groups = [l for l in leaves if l[0] and l[0][0] == 14]
icons = [l for l in leaves if l[0] and l[0][0] == 3]
print('文件:', path)
print('RT_GROUP_ICON 组数:', len(groups), '| RT_ICON 个数:', len(icons))
for p, nid, rva, size, fo in groups:
    data = d[fo:fo + size]
    _, typ, cnt = struct.unpack('<HHH', data[:6])
    print(f'  组 {p} id={nid} 含 {cnt} 个尺寸:')
    o = 6
    for i in range(cnt):
        w, h, cc, rsv, pl, bc, sz, id2 = struct.unpack('<BBBBHHHI', data[o:o + 14])
        print(f'     {w or 256}x{h or 256} bpp={bc} bytes={sz} iconId={id2}')
        o += 14
print('RT_ICON 尺寸字节数:', sorted(i[3] for i in icons))
