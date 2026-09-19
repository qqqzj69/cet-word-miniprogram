/**
 * 词库读取层
 * data/cet4.js 与 data/cet6.js 由 tools/build_dict.py 生成，
 * 内容为 "单词\t释义" 以 \n 连接的字符串，运行时按需解析并缓存。
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
    const tab = rows[i].indexOf('\t');
    if (tab <= 0) continue;
    list.push({
      i: i,
      w: rows[i].slice(0, tab),
      m: rows[i].slice(tab + 1)
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
  getCount: getCount,
  getLevelName: getLevelName
};
