// Sprite Generator — 像素风网红橘猫"鱼烧"
// 特征：半耷拉眼皮、鄙视眼神、微微下撇嘴角、圆脸橘虎斑
// 32x32 像素, 4x 放大至 128px

const S = 32;

// 鱼烧配色 (default: orange tabby)
const SKINS = {
  orange: { body:'#F0982A', dark:'#C87020', light:'#FFF0D0', pink:'#FFB0A0', eye:'#3A2010', shine:'#FFFFFF', nose:'#FF7070', mouth:'#5A3020' },
  white:  { body:'#F5F0EB', dark:'#D5CFC8', light:'#FFFFFF', pink:'#FFD0C8', eye:'#3A3028', shine:'#FFFFFF', nose:'#FF9090', mouth:'#5A4030' },
  black:  { body:'#4A4040', dark:'#2A2020', light:'#6A6060', pink:'#8A7070', eye:'#F0E8A0', shine:'#FFFFFF', nose:'#5A4040', mouth:'#1A1010' },
};
let C = SKINS.orange;
let currentSkin = 'orange';

function setSkin(skin) {
  if (SKINS[skin]) { C = SKINS[skin]; currentSkin = skin; }
  else { C = SKINS.orange; currentSkin = 'orange'; }
  return currentSkin;
}

function rect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

// ── 鱼烧基础形象 ──────────────────────────────────────

function drawYushao(ctx, offY, eyeType, mouthType, tailWag) {
  const oy = offY || 0;
  const tw = tailWag || 0;

  // === 尾巴 ===
  rect(ctx, 24+tw, 17+oy, 3, 1, C.dark);
  rect(ctx, 25+tw, 16+oy, 2, 2, C.body);
  rect(ctx, 26+tw, 15+oy, 2, 1, C.body);
  rect(ctx, 27+tw, 14+oy, 1, 1, C.body);
  if (tw > 0) {
    rect(ctx, 24, 17+oy, 2, 1, C.body);
    rect(ctx, 23, 16+oy, 1, 1, C.body);
  }

  // === 身体（圆胖型） ===
  rect(ctx, 7, 16+oy, 18, 3, C.body);
  rect(ctx, 6, 17+oy, 20, 5, C.body);
  rect(ctx, 6, 18+oy, 20, 4, C.body);
  rect(ctx, 7, 22+oy, 18, 3, C.body);
  rect(ctx, 8, 23+oy, 16, 2, C.body);

  // 身体轮廓
  rect(ctx, 6, 17+oy, 1, 3, C.dark);
  rect(ctx, 25, 17+oy, 1, 3, C.dark);
  rect(ctx, 7, 22+oy, 1, 2, C.dark);
  rect(ctx, 24, 22+oy, 1, 2, C.dark);

  // 白肚子
  rect(ctx, 12, 19+oy, 8, 3, C.light);

  // 虎斑纹
  rect(ctx, 9, 17+oy, 2, 1, C.dark);
  rect(ctx, 14, 17+oy, 2, 1, C.dark);
  rect(ctx, 20, 18+oy, 2, 1, C.dark);

  // === 前爪 ===
  rect(ctx, 9, 25+oy, 5, 3, C.body);
  rect(ctx, 18, 25+oy, 5, 3, C.body);
  rect(ctx, 8, 27+oy, 7, 2, C.light);
  rect(ctx, 17, 27+oy, 7, 2, C.light);

  // === 头（又大又圆） ===
  // 头顶
  rect(ctx, 9,  4+oy,  14, 1, C.body);
  rect(ctx, 8,  5+oy,  16, 1, C.body);
  rect(ctx, 6,  6+oy,  20, 1, C.body);
  rect(ctx, 5,  7+oy,  22, 2, C.body);  // 最宽处——大圆脸
  rect(ctx, 5,  8+oy,  22, 2, C.body);
  rect(ctx, 5,  9+oy,  22, 2, C.body);
  rect(ctx, 6,  10+oy, 20, 1, C.body);
  rect(ctx, 6,  11+oy, 20, 1, C.body);
  rect(ctx, 7,  12+oy, 18, 1, C.body);
  rect(ctx, 8,  13+oy, 16, 1, C.body);

  // 脸两侧腮帮子（圆脸关键）
  rect(ctx, 5, 7+oy, 1, 1, C.dark);   rect(ctx, 26, 7+oy, 1, 1, C.dark);
  rect(ctx, 4, 8+oy, 1, 3, C.dark);   rect(ctx, 27, 8+oy, 1, 3, C.dark);
  rect(ctx, 5, 11+oy, 1, 1, C.dark);  rect(ctx, 26, 11+oy, 1, 1, C.dark);
  rect(ctx, 6, 12+oy, 1, 1, C.dark);  rect(ctx, 25, 12+oy, 1, 1, C.dark);

  // === 耳朵 ===
  // 左耳
  rect(ctx, 7, 1+oy, 5, 3, C.body);
  rect(ctx, 6, 2+oy, 6, 2, C.body);
  rect(ctx, 7, 1+oy, 1, 1, C.dark);
  rect(ctx, 11, 1+oy, 1, 1, C.dark);
  rect(ctx, 6, 2+oy, 1, 1, C.dark);
  rect(ctx, 9, 2+oy, 2, 2, C.pink);  // 内耳
  // 右耳
  rect(ctx, 20, 1+oy, 5, 3, C.body);
  rect(ctx, 20, 2+oy, 6, 2, C.body);
  rect(ctx, 20, 1+oy, 1, 1, C.dark);
  rect(ctx, 24, 1+oy, 1, 1, C.dark);
  rect(ctx, 25, 2+oy, 1, 1, C.dark);
  rect(ctx, 21, 2+oy, 2, 2, C.pink);

  // === 额头虎斑 M ===
  rect(ctx, 11, 5+oy, 2, 1, C.dark);
  rect(ctx, 15, 5+oy, 2, 1, C.dark);
  rect(ctx, 18, 5+oy, 2, 1, C.dark);
  rect(ctx, 10, 6+oy, 1, 1, C.dark);
  rect(ctx, 14, 6+oy, 1, 1, C.dark);
  rect(ctx, 17, 6+oy, 1, 1, C.dark);
  rect(ctx, 21, 6+oy, 1, 1, C.dark);

  // === 鱼烧标志性眼睛 ===
  drawEyes(ctx, oy, eyeType);

  // === 粉色鼻头 ===
  rect(ctx, 13, 10+oy, 6, 2, C.nose);

  // === 嘴——关键表情 ===
  drawMouth(ctx, oy, mouthType);

  // 白色下巴/嘴套
  rect(ctx, 10, 10+oy, 12, 2, C.light);
  rect(ctx, 11, 12+oy, 10, 1, C.light);
}

// ── 鱼烧眼睛 —— 核心灵魂 ─────────────────────────────

function drawEyes(ctx, oy, type) {
  // 鱼烧标志：半耷拉眼皮，不屑眼神
  if (type === 'closed') {
    // 睡觉 / 闭眼
    rect(ctx, 8,  9+oy, 6, 1, C.dark);
    rect(ctx, 18, 9+oy, 6, 1, C.dark);
  } else if (type === 'smug') {
    // 鄙视/judge 脸 —— 半耷拉眼皮
    // 左眼：上眼皮下压
    rect(ctx, 8,  7+oy, 6, 1, C.dark);   // 上眼皮线（压低）
    rect(ctx, 8,  8+oy, 6, 2, C.eye);    // 眼珠
    rect(ctx, 10, 8+oy, 2, 1, C.shine);  // 高光
    // 右眼：同样半耷拉
    rect(ctx, 18, 7+oy, 6, 1, C.dark);
    rect(ctx, 18, 8+oy, 6, 2, C.eye);
    rect(ctx, 20, 8+oy, 2, 1, C.shine);
    // 下眼皮
    rect(ctx, 8,  10+oy, 6, 1, C.dark);
    rect(ctx, 18, 10+oy, 6, 1, C.dark);
  } else if (type === 'sideeye') {
    // 斜眼/侧目 —— 眼珠偏向一边（鱼烧经典）
    // 左眼珠靠右
    rect(ctx, 8,  8+oy, 6, 2, C.eye);
    rect(ctx, 12, 8+oy, 2, 1, C.shine);  // 高光在右边
    rect(ctx, 8,  7+oy, 6, 1, C.dark);   // 上眼皮
    // 右眼珠靠右
    rect(ctx, 18, 8+oy, 6, 2, C.eye);
    rect(ctx, 22, 8+oy, 2, 1, C.shine);
    rect(ctx, 18, 7+oy, 6, 1, C.dark);
    // 下眼皮略重
    rect(ctx, 8,  10+oy, 6, 1, C.dark);
    rect(ctx, 18, 10+oy, 6, 1, C.dark);
  } else if (type === 'happy') {
    // 开心时微微眯眼（但还是有点拽）
    rect(ctx, 8,  8+oy, 2, 1, C.dark);  // 左眼内侧
    rect(ctx, 12, 8+oy, 2, 1, C.dark);  // 左眼外侧
    rect(ctx, 9,  7+oy, 4, 1, C.dark);  // 上弧
    rect(ctx, 18, 8+oy, 2, 1, C.dark);
    rect(ctx, 22, 8+oy, 2, 1, C.dark);
    rect(ctx, 19, 7+oy, 4, 1, C.dark);
    // 眼缝中露出眼珠
    rect(ctx, 9,  8+oy, 4, 1, C.eye);
    rect(ctx, 19, 8+oy, 4, 1, C.eye);
  } else {
    // 默认：鱼烧日常鄙视脸
    rect(ctx, 8,  7+oy, 6, 1, C.dark);   // 上眼皮
    rect(ctx, 8,  8+oy, 6, 2, C.eye);
    rect(ctx, 10, 8+oy, 2, 1, C.shine);
    rect(ctx, 18, 7+oy, 6, 1, C.dark);
    rect(ctx, 18, 8+oy, 6, 2, C.eye);
    rect(ctx, 20, 8+oy, 2, 1, C.shine);
    rect(ctx, 8,  10+oy, 6, 1, C.dark);  // 下眼皮（比普通猫更重）
    rect(ctx, 18, 10+oy, 6, 1, C.dark);
  }
}

// ── 鱼烧嘴巴 —— 不屑嘴角 ────────────────────────────

function drawMouth(ctx, oy, type) {
  if (type === 'grumpy') {
    // 嫌弃撇嘴 —— 嘴角下弯
    rect(ctx, 14, 13+oy, 1, 1, C.mouth);
    rect(ctx, 17, 13+oy, 1, 1, C.mouth);
    // 下撇的嘴角
    rect(ctx, 13, 14+oy, 1, 1, C.mouth);
    rect(ctx, 18, 14+oy, 1, 1, C.mouth);
    // 人中竖线
    rect(ctx, 15, 12+oy, 2, 1, C.mouth);
  } else if (type === 'smile') {
    // 难得微笑（还是有点拽）
    rect(ctx, 14, 13+oy, 4, 1, C.mouth);
    rect(ctx, 15, 14+oy, 2, 1, C.mouth);
  } else if (type === 'open') {
    // 张嘴（说话/打哈欠）
    rect(ctx, 13, 13+oy, 6, 2, C.eye);  // 深色口腔
    rect(ctx, 14, 13+oy, 4, 1, C.body);
  } else {
    // 默认：微妙的嫌弃嘴角
    rect(ctx, 15, 13+oy, 2, 1, C.mouth);
    rect(ctx, 14, 14+oy, 1, 1, C.mouth);
    rect(ctx, 17, 14+oy, 1, 1, C.mouth);
  }
}

// ── 帧生成 ────────────────────────────────────────────

function generateFrame(state, fi) {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = S; canvas.height = S;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, S, S);

    switch (state) {
      case 'idle':
        // 日常鄙视脸 + 微微呼吸起伏 + 偶尔闭眼
        if (fi === 3) drawYushao(ctx, 0, 'closed', 'grumpy', 0);
        else if (fi === 2) drawYushao(ctx, 0, 'sideeye', 'grumpy', 0); // 斜眼看你
        else drawYushao(ctx, [0,-1,0,-1][fi], 'smug', 'grumpy', 0);
        break;

      case 'walk':
        // 走起来也要保持不屑
        drawYushao(ctx, [1,0,1,0,-1,0][fi], 'smug', 'grumpy', fi % 3);
        break;

      case 'sleep':
        // 睡觉——闭眼闭嘴，安逸但依然有点拽
        drawYushao(ctx, 5, 'closed', 'grumpy', 0);
        // Zzz
        if (fi < 3) {
          ctx.fillStyle = `rgba(200,200,255,${0.3+fi*0.2})`;
          ctx.font = '6px monospace';
          ctx.fillText('z', 22, 4 - fi*2);
          if (fi >= 1) ctx.fillText('z', 24, 2 - fi*2);
        }
        break;

      case 'happy':
        drawYushao(ctx, [-2,0,-1,0][fi], 'happy', 'smile', (fi%2)*2);
        break;

      case 'stretch':
        // 伸懒腰：身体拉长+前爪向前伸
        drawYushao(ctx, fi===0?-1:fi===1?-2:fi===2?-1:0, 'closed', 'grumpy', 0);
        if (fi === 1) { // stretch arms
          rect(ctx, 4, 24+[-1,0,-1,0][fi], 4, 1, C.body);
          rect(ctx, 3, 23+[-1,0,-1,0][fi], 2, 1, C.dark);
        }
        break;

      case 'yawn':
        // 打哈欠：嘴巴张大
        if (fi === 1) {
          drawYushao(ctx, 0, 'closed', 'open', 0);
        } else if (fi === 2) {
          drawYushao(ctx, 1, 'closed', 'open', 0);
        } else {
          drawYushao(ctx, 0, 'smug', 'grumpy', 0);
        }
        break;

      case 'eat':
        // 吃东西：头微微下点
        drawYushao(ctx, [1,2,1,0][fi], 'happy', 'smile', 0);
        // 小碗/食物
        rect(ctx, 12, 26+oy(0,fi), 8, 2, C.dark);
        rect(ctx, 13, 25+oy(0,fi), 6, 1, C.body);
        break;

      case 'pet':
        // 被摸头：眯眼开心+爱心
        drawYushao(ctx, 0, 'happy', 'smile', 0);
        if (fi % 2 === 0) {
          // 小爱心漂浮
          ctx.fillStyle = '#FF6B8A';
          ctx.fillRect(24, 2, 2, 2);
          ctx.fillRect(26, 0, 2, 2);
          ctx.fillRect(22, 0, 2, 2);
        }
        break;

      default:
        drawYushao(ctx, 0, 'smug', 'grumpy', 0);

      function oy(base, fi) { return base + [0,-1,0,-1][fi]; }
    }
    return canvas;
  } catch (err) {
    console.error('Sprite error:', state, fi, err);
    const canvas = document.createElement('canvas');
    canvas.width = S; canvas.height = S;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = C.body;
    ctx.fillRect(4, 4, 24, 24);
    ctx.fillStyle = C.eye;
    ctx.fillRect(8, 10, 4, 2); ctx.fillRect(18, 10, 4, 2);
    return canvas;
  }
}

function generateAllFrames(state) {
  const c = { idle:4, walk:6, sleep:4, happy:4, stretch:4, yawn:4, eat:4, pet:2 }[state] || 4;
  const frames = [];
  for (let i = 0; i < c; i++) frames.push(generateFrame(state, i));
  return frames;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { generateFrame, generateAllFrames, S, setSkin, getCurrentSkin: () => currentSkin };
}
