# -*- coding: utf-8 -*-
"""
纯 Python 生成 tabBar 图标（81x81 RGBA PNG），4x4 超采样抗锯齿。
零第三方依赖，避免为了几张图标引入 Pillow。
运行：python tools/build_icons.py
"""
import os
import struct
import zlib

SIZE = 81
SS = 4  # supersample factor

# 浅色底栏配色：未选中为灰，选中为 Apple blue
NORMAL = (142, 142, 147)   # #8E8E93
ACTIVE = (10, 132, 255)    # #0A84FF


def inside_house(x, y):
    """房子：三角屋顶 + 方形主体（归一化坐标 0..1）"""
    # 屋顶：顶点 (0.5, 0.16)，底边 y=0.54 时横跨 0.10..0.90
    if 0.16 <= y <= 0.54:
        t = (y - 0.16) / 0.38
        half = 0.03 + t * 0.37
        if abs(x - 0.5) <= half:
            return True
    # 主体
    if 0.22 <= x <= 0.78 and 0.50 <= y <= 0.86:
        return True
    return False


def inside_bars(x, y):
    """柱状图：三根高度不同的柱子"""
    specs = [(0.18, 0.36, 0.52), (0.40, 0.58, 0.30), (0.62, 0.80, 0.66)]
    for x0, x1, top in specs:
        if x0 <= x <= x1 and top <= y <= 0.84:
            return True
    # 基线
    if 0.12 <= x <= 0.88 and 0.84 <= y <= 0.90:
        return True
    return False


def inside_person(x, y):
    """人像：圆头 + 肩部（归一化坐标 0..1）"""
    dx, dy = x - 0.5, y - 0.30
    if dx * dx + dy * dy <= 0.155 * 0.155:
        return True
    if 0.55 <= y <= 0.90:
        dx2, dy2 = (x - 0.5) / 0.33, (y - 0.92) / 0.42
        if dx2 * dx2 + dy2 * dy2 <= 1.0:
            return True
    return False


SHAPES = {
    'home': inside_house,
    'stats': inside_bars,
    'mine': inside_person,
}


def render(shape_fn, color):
    rows = []
    step = 1.0 / (SIZE * SS)
    for py in range(SIZE):
        row = bytearray()
        for px in range(SIZE):
            hits = 0
            for sy in range(SS):
                for sx in range(SS):
                    x = (px * SS + sx + 0.5) * step
                    y = (py * SS + sy + 0.5) * step
                    if shape_fn(x, y):
                        hits += 1
            cov = hits / float(SS * SS)
            if cov <= 0:
                row += bytes([0, 0, 0, 0])
            else:
                a = int(round(255 * min(1.0, cov * 1.15)))
                row += bytes([color[0], color[1], color[2], a])
        rows.append(bytes(row))
    return rows


def write_png(path, w, h, rows):
    raw = b''.join(b'\x00' + r for r in rows)

    def chunk(tag, data):
        c = struct.pack('>I', len(data)) + tag + data
        return c + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)

    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(raw, 9))
    png += chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(png)


def main():
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'assets', 'tabbar')
    os.makedirs(out, exist_ok=True)
    for name, fn in SHAPES.items():
        write_png(os.path.join(out, '%s.png' % name), SIZE, SIZE, render(fn, NORMAL))
        write_png(os.path.join(out, '%s_on.png' % name), SIZE, SIZE, render(fn, ACTIVE))
        print('generated', name)
    print('done ->', out)


if __name__ == '__main__':
    main()
