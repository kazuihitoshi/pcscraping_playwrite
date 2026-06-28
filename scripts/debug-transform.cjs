/**
 * Playwright テストをステップ実行するための Babel プラグイン。
 * 各文を try/catch で包み、debugger 文を挿入する（VS Code 拡張と同じ仕組み）。
 */
module.exports = function (babel) {
  const { types: t } = babel;

  return {
    name: 'playwright-debug-transform',
    visitor: {
      ExpressionStatement(path) {
        const expression = path.node.expression;
        const isAwaitExpression = t.isAwaitExpression(expression);
        const isCallExpression = t.isCallExpression(expression);
        if (!isAwaitExpression && !isCallExpression) return;
        if (path.parentPath.isBlockStatement() && path.parentPath.parentPath.isTryStatement()) return;
        if (isAwaitExpression && !t.isCallExpression(expression.argument)) return;

        path.replaceWith(
          t.tryStatement(
            t.blockStatement([path.node]),
            t.catchClause(
              t.identifier('__playwright_error__'),
              t.blockStatement([
                t.debuggerStatement(),
                t.throwStatement(t.identifier('__playwright_error__')),
              ]),
            ),
          ),
        );

        path.node.start = expression.start;
        path.node.end = expression.end;
        path.node.loc = expression.loc;
        path.node.range = expression.range;
      },
    },
  };
};
