// ============================================================
// import-seo.mjs —— 把 chapters/ 的书稿导入为 nimbus 站点页面
// 用法：site/ 目录下 node scripts/import-seo.mjs
// 由 `prebuild` 自动调用，保证构建永远用最新书稿
// 输出 40 页：落地页 1 + 前言 1 + 篇页 7 + 31 章（每章一页）
// 章节按篇分文件夹（part1…part7），Nimbus 侧边栏按文件夹分组，
// 分组名取篇文件夹 index 页（篇页）的标题——没有篇页时组名会是文件夹名（Part1…）。
// 图片：仓库根 images/ → site/public/images/，正文 ../images/ 改写为 <base>images/
// ============================================================
import { readdirSync, readFileSync, writeFileSync, rmSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHAPTERS_DIR = join(ROOT, '..', 'chapters');
const OUT_DIR = join(ROOT, 'src', 'content', 'docs');
const IMAGES_DIR = join(ROOT, '..', 'images');
const PUBLIC_IMAGES_DIR = join(ROOT, 'public', 'images');

// 站点 base 路径（astro.config.ts 里的 base: "..."），图片引用要带上它，
// 否则部署到 GitHub Pages 项目路径下时图片 404
function readBase() {
  const cfg = readFileSync(join(ROOT, 'astro.config.ts'), 'utf8');
  const m = cfg.match(/base:\s*["']([^"']+)["']/);
  let b = m ? m[1] : '/';
  if (!b.endsWith('/')) b += '/';
  return b;
}
const SITE_BASE = readBase();

// 正文图片：仓库根 images/ → site/public/images/（public 映射到站点根，
// 构建后位于 <base>/images/，与 fixImagePaths 改写的路径对应）
function copyImages() {
  if (!existsSync(IMAGES_DIR)) return;
  mkdirSync(PUBLIC_IMAGES_DIR, { recursive: true });
  let n = 0;
  for (const f of readdirSync(IMAGES_DIR)) {
    if (/\.(svg|png|jpe?g|webp|gif)$/i.test(f)) {
      copyFileSync(join(IMAGES_DIR, f), join(PUBLIC_IMAGES_DIR, f));
      n++;
    }
  }
  console.log(`import-seo: 拷贝图片 ${n} 张`);
}

// 正文标题处理：书稿第一行 `# 第 X 章 ……` 与 frontmatter 标题重复，导入时去掉；
// 其余一级标题降为二级，避免一页两个 H1
const stripTitleH1 = (body) => body.replace(/^\s*# .*\r?\n/, '');
const demoteH1 = (body) => body.replace(/^# /gm, '## ');
// 正文里的 ../images/xxx 改写为 <base>/images/xxx（Astro 不会自动给
// markdown 里的根绝对路径加 base，必须手动带上）
const fixImagePaths = (body) => body.replace(/\.\.\/images\//g, `${SITE_BASE}images/`);

function frontmatter({ title, description, order, label, group }) {
  const esc = (s) => `"${String(s ?? '').replace(/"/g, '\\"')}"`;
  return [
    '---',
    `title: ${esc(title)}`,
    `description: ${esc(description)}`,
    'sidebar:',
    `  order: ${order}`,
    `  label: ${esc(label || title)}`,
    '  group:',
    `    label: ${esc(group)}`,
    '---',
    '',
  ].join('\n');
}

// 篇定义：文件夹、分组名、章号范围、一句话导读（标题以 outline/OUTLINE.md 为准）
const PARTS = [
  { dir: 'part1', label: '第一篇 先弄懂搜索引擎在想什么', lo: 1, hi: 3, intro: '搜索引擎干的活，拆开就是爬取、收录、排名三件事。先把这张总图装进脑子，后面的技巧才不会学成一地散沙。' },
  { dir: 'part2', label: '第二篇 选词定生死', lo: 4, hi: 8, intro: 'SEO 的胜负手不在写，而在选。这一篇讲怎么找词、验词、给每个词算一笔账，外加追新词的时间窗口。' },
  { dir: 'part3', label: '第三篇 把站搭对', lo: 9, hi: 13, intro: '词选好了，站要搭对：结构、页面基本功、速度与手机、一词一页还是一词一站、多语言，这一决定怎么搭。' },
  { dir: 'part4', label: '第四篇 内容怎么写才有排名', lo: 14, hi: 17, intro: '页面有了，怎么写才有排名。先对意图，再谈文采；程序化造页、内容集群、AI 写稿的边界都在这一篇。' },
  { dir: 'part5', label: '第五篇 外链与权重', lo: 18, hi: 20, intro: '内容解决"值得排"，外链解决"排多前"。这一篇讲外链为什么是投票、正经拿链的办法、捷径的真实代价。' },
  { dir: 'part6', label: '第六篇 看数据过日子', lo: 21, hi: 23, intro: '站上了线，日子要靠数据过。Search Console 只看五个数，出了问题按顺序排查，流量最后还要变成钱。' },
  { dir: 'part7', label: '第七篇 AI 搜索时代：从"排上去"到"被引用"', lo: 24, hi: 31, intro: '搜索正在被 AI 改写：点击在消失，目标从"排上去"变成"被引用"。这一篇讲 GEO 的证据、打法与监测。' },
];
const partOf = (n) => PARTS.find((p) => n >= p.lo && n <= p.hi);

// 章名（outline/OUTLINE.md 的短标题）
const TITLES = {
  1: '搜索引擎是个图书管理员',
  2: '关键词的本质',
  3: '排名排的是什么',
  4: '先看对手',
  5: '长尾词',
  6: '一个词值不值得做',
  7: '追新词',
  8: 'Trends 不说谎',
  9: '网站结构',
  10: '页面基本功',
  11: '速度与手机',
  12: '一词一页还是一词一站',
  13: '多语言站',
  14: '先对意图，再谈文采',
  15: '程序化 SEO',
  16: '内容集群',
  17: 'AI 写稿的边界',
  18: '外链就是投票',
  19: '正经拿外链',
  20: '捷径的代价',
  21: 'Search Console 只看五个数',
  22: '故障排查顺序表',
  23: '流量变现',
  24: '点击正在消失',
  25: 'AI 怎么挑答案',
  26: '被引用的内容长什么样',
  27: '段落为王',
  28: '别人嘴里的你',
  29: '机器可读的迷信与真相',
  30: '量不了就管不了',
  31: 'SEO 死了吗',
};
const chapterTitle = (n) => `第 ${n} 章 ${TITLES[n]}`;

function main() {
  copyImages();
  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });

  let pages = 0;
  const write = (relPath, fm, body) => {
    const full = join(OUT_DIR, relPath);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, fm + demoteH1(stripTitleH1(fixImagePaths(body))).replace(/\s+$/, '') + '\n');
    pages++;
  };
  const readChapter = (name) => readFileSync(join(CHAPTERS_DIR, name), 'utf8');

  // 前言
  write(
    'preface/index.md',
    frontmatter({
      title: '前言',
      description: '《白话 SEO》前言：流量不是玄学',
      order: 5,
      group: '开篇',
    }),
    readChapter('ch00-preface.md'),
  );

  // 篇页：文件夹 index 即侧边栏分组头（标题即分组名），正文列本篇章节
  for (const [i, part] of PARTS.entries()) {
    const items = [];
    for (let n = part.lo; n <= part.hi; n++) {
      items.push(`- [${chapterTitle(n)}](./ch${String(n).padStart(2, '0')}/)`);
    }
    write(
      `${part.dir}/index.md`,
      frontmatter({
        title: part.label,
        description: `《白话 SEO》${part.label}`,
        order: (i + 1) * 100,
        label: part.label,
        group: part.label,
      }),
      [part.intro, '', ...items, ''].join('\n'),
    );
  }

  // 31 章
  for (let n = 1; n <= 31; n++) {
    const part = partOf(n);
    const file = `ch${String(n).padStart(2, '0')}.md`;
    write(
      `${part.dir}/ch${String(n).padStart(2, '0')}/index.md`,
      frontmatter({
        title: chapterTitle(n),
        description: `《白话 SEO》${chapterTitle(n)}`,
        order: n * 10,
        group: part.label,
      }),
      readChapter(file),
    );
  }

  // 落地页 index.md（order 最小，排最前），按篇分组列出全部章节
  const partList = (part) => {
    const items = [];
    for (let n = part.lo; n <= part.hi; n++) {
      items.push(`- [${chapterTitle(n)}](./${part.dir}/ch${String(n).padStart(2, '0')}/)`);
    }
    return [`## ${part.label}`, '', ...items, ''].join('\n');
  };
  write(
    'index.md',
    frontmatter({
      title: '白话 SEO',
      description: '写给独立开发者和站长的搜索流量课',
      order: -100,
      label: '全书导读',
      group: '开篇',
    }),
    [
      '写给独立开发者和站长的搜索流量课。作者：Tony Wu。',
      '',
      'SEO 不是玄学，也不是黑话。这本书用大白话讲透搜索引擎的朴素逻辑：先弄懂它在想什么，再依次解决选词、建站、内容、外链、看数据这五件大事，最后一篇专门讲 AI 搜索时代的新打法 GEO——从"排上去"变成"被引用"。',
      '',
      '全书跟着一个贯穿案例走：独立开发者阿哲，从挖到一个词开始，做一个小工具站，一路做到有稳定搜索流量和第一笔收入。每章都是白话讲解、阿哲的站、翻车现场、要点回顾，再加 3 道 Kata 练手。',
      '',
      '## 开篇',
      '',
      '- [前言](./preface/)',
      '',
      ...PARTS.map(partList),
    ].join('\n'),
  );

  console.log(`import-seo: 导入完成，31 章，共 ${pages} 页`);
  // 落地页 1 + 前言 1 + 篇页 7 + 31 章 = 40
  if (pages !== 40) {
    console.error(`页数不对：期望 40，实际 ${pages}`);
    process.exit(1);
  }
}

main();
