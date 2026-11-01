import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Windows 向け Chrome の User-Agent（必要に応じて変更） */
export const CHROME_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36';

const WINDOWS_CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
];

function findWindowsChrome() {
  return WINDOWS_CHROME_PATHS.find((p) => p && fs.existsSync(p)) ?? null;
}

/**
 * @param {{ useChromeChannel?: boolean }} [options]
 * - useChromeChannel: true ならローカルにインストール済みの Google Chrome を使用
 *   Docker など Chrome 未インストール環境では false
 */
export function getBrowserUse({ useChromeChannel = true } = {}) {
  const use = { userAgent: CHROME_USER_AGENT };
  if (!useChromeChannel) return use;

  if (process.platform === 'win32') {
    const exe = findWindowsChrome();
    if (exe) {
      use.launchOptions = { executablePath: exe };
    } else {
      use.channel = 'chrome';
    }
  } else {
    use.channel = 'chrome';
  }
  return use;
}

/** U: (WSL マウント) では test-results の削除に失敗しやすいので、Windows はローカル temp を使う */
export function getOutputDir() {
  if (process.platform === 'win32') {
    return path.join(os.tmpdir(), 'pcscraping-playwright-results');
  }
  return 'test-results';
}
