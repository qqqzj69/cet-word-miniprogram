# -*- coding: utf-8 -*-
"""
从开源词库 KyleBing/english-vocabulary 拉取四级/六级词表，
转换为小程序内置 JS 数据模块（TSV 字符串，体积最优）。
运行：python tools/build_dict.py
"""
import os
import re
import urllib.request

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(BASE, 'data')

SOURCES = [
    ('cet4', 'https://raw.githubusercontent.com/KyleBing/english-vocabulary/master/3%20%E5%9B%9B%E7%BA%A7-%E4%B9%B1%E5%BA%8F.txt'),
    ('cet6', 'https://raw.githubusercontent.com/KyleBing/english-vocabulary/master/4%20%E5%85%AD%E7%BA%A7-%E4%B9%B1%E5%BA%8F.txt'),
]

WORD_RE = re.compile(r'^[A-Za-z][A-Za-z\-\.\' ]*$')


def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode('utf-8')


def clip(trans, limit=160):
    """过长释义按分号边界截断，保证卡片可读。"""
    if len(trans) <= limit:
        return trans
    acc = ''
    for seg in re.split(r'[；;]', trans):
        seg = seg.strip()
        if not seg:
            continue
        candidate = (acc + '；' + seg) if acc else seg
        if len(candidate) > limit:
            break
        acc = candidate
    return acc or trans[:limit]


POS_RE = re.compile(r'^\s*(n|v|vt|vi|adj|adv|prep|conj|pron|num|art|int|aux|pl|abbr)\.\s*', re.I)


def norm_seg(s):
    """归一化释义片段用于去重：去词性前缀、去空格与标点差异。"""
    s = POS_RE.sub('', s)
    s = re.sub(r'[\s，,、\.。]+', '', s)
    return s


def merge_trans(a, b, max_seg=4):
    """同一单词在不同分册的释义可能互补，合并去重后保留。"""
    segs = []
    seen = set()
    for s in re.split(r'[；;]', a + '；' + b):
        s = s.strip().strip('。')
        if not s:
            continue
        key = norm_seg(s)
        if not key or key in seen:
            continue
        seen.add(key)
        segs.append(s)
        if len(segs) >= max_seg:
            break
    return '；'.join(segs)


def parse(raw):
    rows = []
    order = []
    index = {}
    dropped = {'no_tab': 0, 'bad_word': 0, 'too_long': 0, 'empty': 0, 'merged': 0}
    for line in raw.splitlines():
        line = line.strip()
        if not line:
            continue
        parts = line.split('\t')
        if len(parts) < 2:
            parts = re.split(r'\s{2,}', line, maxsplit=1)
        if len(parts) < 2:
            dropped['no_tab'] += 1
            continue
        word = parts[0].strip()
        trans = parts[1].strip().replace('\t', ' ').replace('\n', ' ')
        if not word or not trans:
            dropped['empty'] += 1
            continue
        if not WORD_RE.match(word):
            dropped['bad_word'] += 1
            continue
        if len(word) > 40:
            dropped['too_long'] += 1
            continue
        key = word.lower()
        if key in index:
            old = index[key]
            old[1] = clip(merge_trans(old[1], trans))
            dropped['merged'] += 1
            continue
        item = [word, clip(trans)]
        index[key] = item
        order.append(item)
    for item in order:
        rows.append((item[0], item[1]))
    return rows, dropped


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    summary = []
    for name, url in SOURCES:
        print('fetching', name, '...')
        raw = fetch(url)
        rows, dropped = parse(raw)
        print('  原始行数 %d, 过滤: %s' % (len(raw.splitlines()), dropped))
        body = '\n'.join('%s\t%s' % (w, t) for w, t in rows)
        # JS 字符串转义
        body_js = body.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n')
        content = (
            '// %s 词库 · 共 %d 词\n'
            '// 数据来源：https://github.com/KyleBing/english-vocabulary （格式：单词\\t释义）\n'
            '// 本文件由 tools/build_dict.py 自动生成，请勿手工编辑\n'
            'module.exports = "%s";\n'
        ) % (name.upper(), len(rows), body_js)
        path = os.path.join(OUT_DIR, name + '.js')
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        size_kb = os.path.getsize(path) / 1024
        summary.append((name, len(rows), size_kb))
        print('  -> %s: %d 词, %.1f KB' % (name, len(rows), size_kb))
    print('done.')
    print('total size: %.1f KB' % sum(s[2] for s in summary))


if __name__ == '__main__':
    main()
