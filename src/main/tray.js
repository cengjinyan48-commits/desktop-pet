// System Tray — Menu bar icon & context menu

const { Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const windows = require('./window-manager');

let tray = null;

function create() {
  // Create a simple 16x16 pixel art cat face icon programmatically
  const icon = createTrayIcon();
  tray = new Tray(icon);
  tray.setToolTip('桌面小橘 — Desktop Pet');

  // Context menu
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示/隐藏小橘',
      click: () => {
        const pw = windows.getPetWindow();
        if (pw && pw.isVisible()) {
          pw.hide();
        } else {
          windows.createPetWindow();
        }
      }
    },
    {
      label: '任务面板',
      click: () => windows.toggleTaskPanel()
    },
    { type: 'separator' },
    {
      label: '偏好设置…',
      click: () => windows.createSettingsWindow()
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        windows.setAppIsQuitting(true);
        require('electron').app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  // Left-click also toggles pet visibility
  tray.on('click', () => {
    const pw = windows.getPetWindow();
    if (pw && pw.isVisible()) {
      pw.hide();
    } else {
      windows.createPetWindow();
    }
  });

  console.log('📎 Tray icon ready');
}

function createTrayIcon() {
  // 18x36 @2x = 36x36 visible px — bigger, clearer menu bar icon
  const size = 36;
  const buffer = Buffer.alloc(size * size * 4, 0);

  const ORANGE = [0x2A, 0x98, 0xF0, 0xFF];  // BGRA: #F0982A
  const DARK   = [0x20, 0x70, 0xC8, 0xFF];  // #C87020
  const WHITE  = [0xFF, 0xFF, 0xFF, 0xFF];
  const BLACK  = [0x10, 0x20, 0x3A, 0xFF];  // #3A2010
  const PINK   = [0xA0, 0xB0, 0xFF, 0xFF];  // #FFB0A0

  function setP(x, y, c) {
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const o = (y * size + x) * 4;
    buffer[o]=c[0]; buffer[o+1]=c[1]; buffer[o+2]=c[2]; buffer[o+3]=c[3];
  }
  function fill(x, y, w, h, c) {
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) setP(x+dx, y+dy, c);
  }

  // Ears
  fill(13, 4, 10, 8, ORANGE);
  fill(5, 4, 10, 8, ORANGE);
  fill(7, 7, 6, 4, PINK);
  fill(23, 7, 6, 4, PINK);

  // Head (round-ish)
  for (let y = 8; y <= 26; y++) {
    const w = y <= 12 ? 16 + (y-8)*2 : y >= 22 ? 28 - (y-22)*2 : 28;
    const x = (size - w) / 2;
    fill(x, y, w, 1, ORANGE);
  }
  // Head outline
  fill(9, 8, 2, 18, DARK); fill(25, 8, 2, 18, DARK);

  // Eyes (鱼烧风格：半耷拉眼皮)
  fill(10, 14, 6, 1, DARK); fill(20, 14, 6, 1, DARK); // 上眼皮
  fill(10, 15, 6, 2, BLACK); fill(20, 15, 6, 2, BLACK); // 眼珠
  fill(12, 15, 2, 1, WHITE); fill(22, 15, 2, 1, WHITE); // 高光
  fill(10, 17, 6, 1, DARK); fill(20, 17, 6, 1, DARK); // 下眼皮

  // Nose & mouth
  fill(16, 21, 4, 2, PINK);
  fill(15, 24, 2, 1, DARK); fill(19, 24, 2, 1, DARK);

  // Chin highlight
  fill(14, 22, 8, 2, WHITE); // white muzzle

  const img = nativeImage.createFromBuffer(buffer, {
    width: size,
    height: size,
    scaleFactor: 2.0
  });
  img.setTemplateImage(false); // keep orange color visible

  return img;
}

function destroy() {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}

module.exports = { create, destroy };
