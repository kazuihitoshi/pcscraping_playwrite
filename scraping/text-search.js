/**
 * 指定要素内のクラス一致要素ごとに、子孫の textContent を検索し名前・価格を返す
 * @param {import('@playwright/test').Locator} scope - 検索範囲の要素
 * @param {string} itemSelector - 検索対象クラス/セレクタ（1種類、複数該当可）
 * @param {string} priceSelector - 値段要素のセレクタ（item 要素と同一親内の兄弟）
 * @param {string[]} searchTexts - 部分一致検索文字列（大文字小文字無視）
 * @returns {Promise<Array<{ name: string, price: string, matched: boolean }>>}
 */
export async function findItemsByTextContent(scope, itemSelector, priceSelector, searchTexts) {
  return scope.evaluate(
    (root, { itemSelector, priceSelector, searchTexts }) => {
      const needles = searchTexts.map((t) => t.toLowerCase());
      const matchesText = (text) => {
        const lower = (text ?? '').toLowerCase();
        return needles.some((n) => lower.includes(n));
      };
      const subtreeHasMatch = (el) =>
        [el, ...el.querySelectorAll('*')].some((node) => matchesText(node.textContent));

      return Array.from(root.querySelectorAll(itemSelector)).map((itemEl) => {
        const container = itemEl.parentElement ?? itemEl;
        const priceEl = container.querySelector(priceSelector);
        return {
          name: (itemEl.textContent ?? '').trim(),
          price: (priceEl?.textContent ?? '').trim(),
          matched: subtreeHasMatch(container),
        };
      });
    },
    { itemSelector, priceSelector, searchTexts }
  );
}
