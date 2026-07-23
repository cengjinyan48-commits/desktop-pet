// Update Checker — GitHub Releases 版本检查
//
// 注意：macOS 上 electron-updater 的静默自动安装要求有效的 Developer ID
// 签名 + 公证；本应用是 ad-hoc 签名，走"检查 → 通知 → 打开下载页"路线。
// 将来若接入付费开发者证书，可平滑替换为 electron-updater。

const { app, dialog, shell, Notification } = require('electron');

const REPO = 'cengjinyan48-commits/desktop-pet';
const RELEASES_API = `https://api.github.com/repos/${REPO}/releases/latest`;
const RELEASES_PAGE = `https://github.com/${REPO}/releases/latest`;
const CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 每天一次

let timer = null;

function start() {
  // 启动 30 秒后首查（避开启动高峰），之后每 24h 一次
  setTimeout(() => check(false), 30 * 1000);
  timer = setInterval(() => check(false), CHECK_INTERVAL);
}

function stop() {
  if (timer) { clearInterval(timer); timer = null; }
}

// manual=true 时（托盘点击"检查更新"），没有新版本也给反馈
async function check(manual) {
  try {
    const res = await fetch(RELEASES_API, {
      headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'desktop-pet' }
    });
    if (res.status === 404) {
      // 仓库还没发布过 Release
      if (manual) {
        dialog.showMessageBox({
          type: 'info', title: '检查更新',
          message: `当前已是最新版本 v${app.getVersion()}`,
          detail: '（仓库暂无发布的新版本）'
        });
      }
      return;
    }
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);

    const release = await res.json();
    const latest = String(release.tag_name || '').replace(/^v/, '');
    const current = app.getVersion();

    if (latest && isNewer(latest, current)) {
      notifyNewVersion(latest, release.html_url || RELEASES_PAGE);
    } else if (manual) {
      dialog.showMessageBox({
        type: 'info', title: '检查更新',
        message: `当前已是最新版本 v${current} ✅`
      });
    }
  } catch (err) {
    console.error('Update check failed:', err.message);
    if (manual) {
      dialog.showMessageBox({
        type: 'warning', title: '检查更新',
        message: '检查更新失败',
        detail: err.message
      });
    }
  }
}

function notifyNewVersion(version, url) {
  const note = new Notification({
    title: `🎉 鱼烧有新版本 v${version}`,
    body: '点击查看更新内容并下载'
  });
  note.on('click', () => shell.openExternal(url));
  note.show();
}

// 简单 semver 比较："1.2.0" vs "1.10.0" 也能正确处理
function isNewer(a, b) {
  const pa = a.split('.').map(n => parseInt(n, 10) || 0);
  const pb = b.split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return true;
    if ((pa[i] || 0) < (pb[i] || 0)) return false;
  }
  return false;
}

module.exports = { start, stop, check };
