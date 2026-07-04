/** Windows 向け Chrome の User-Agent（必要に応じて変更） */
export const CHROME_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36';

/**
 * @param {{ useChromeChannel?: boolean }} [options]
 * - useChromeChannel: true ならローカルにインストール済みの Google Chrome を使用
 *   Docker など Chrome 未インストール環境では false
 */
export function getBrowserUse({ useChromeChannel = true } = {}) {
  return {
    ...(useChromeChannel ? { channel: 'chrome' } : {}),
    userAgent: CHROME_USER_AGENT,
  };
}
