/**
 * 词库读取层
 * data/cet4.js 与 data/cet6.js 为内置数据，
 * 每行格式：单词 \t 音标 \t 释义 \t 例句 \t 例句中文（音标与例句可缺省）
 */
const raw = {
  cet4: require('./cet4.js'),
  cet6: require('./cet6.js')
};

const LEVELS = [
  { key: 'cet4', name: '英语四级', short: 'CET-4' },
  { key: 'cet6', name: '英语六级', short: 'CET-6' }
];

const cache = {};

function getWords(level) {
  if (cache[level]) return cache[level];
  const src = raw[level] || '';
  const rows = src.split('\n');
  const list = [];
  for (let i = 0; i < rows.length; i++) {
    const f = rows[i].split('\t');
    if (!f[0]) continue;
    list.push({
      i: i,
      w: f[0],
      p: f[1] || '',
      m: f[2] || '',
      e: f[3] || '',
      ec: f[4] || ''
    });
  }
  cache[level] = list;
  return list;
}

function getWord(level, word) {
  const list = getWords(level);
  for (let i = 0; i < list.length; i++) {
    if (list[i].w === word) return list[i];
  }
  return null;
}

/**
 * 查词：英文前缀优先，其次英文包含，最后中文释义包含
 * @param {string} level
 * @param {string} kw 关键词
 * @param {number} [limit] 最多返回条数，默认 50
 */
function searchWords(level, kw, limit) {
  const k = (kw || '').trim().toLowerCase();
  if (!k) return [];
  const cap = limit > 0 ? limit : 50;
  const words = getWords(level);
  const out = [];
  const seen = {};
  let pass;
  for (pass = 0; pass < 3 && out.length < cap; pass++) {
    for (let i = 0; i < words.length && out.length < cap; i++) {
      const it = words[i];
      if (seen[it.i]) continue;
      const lw = it.w.toLowerCase();
      const matched =
        (pass === 0 && lw.indexOf(k) === 0) ||
        (pass === 1 && lw.indexOf(k) > 0) ||
        (pass === 2 && it.m.indexOf(kw.trim()) >= 0);
      if (matched) {
        seen[it.i] = true;
        out.push(it);
      }
    }
  }
  return out;
}

function getCount(level) {
  return getWords(level).length;
}

function getLevelName(level) {
  const lv = LEVELS.filter(function (x) { return x.key === level; })[0];
  return lv ? lv.name : level;
}

module.exports = {
  LEVELS: LEVELS,
  getWords: getWords,
  getWord: getWord,
  searchWords: searchWords,
  getCount: getCount,
  getLevelName: getLevelName
};
