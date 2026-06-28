# DELL スクレイピング

- ページ内の商品リストは、以下jsで取得可能
  document.querySelectorAll('#sr-product-stacks article')
- 詳細ページ（カスタムページ）への遷移
  document.querySelectorAll('#sr-product-stacks article')[0].querySelectorAll('a.variant-customize-button')

- ページネイション　戻るボタンの無効
  document.querySelectorAll('#sr-dds-pagination button.dds__pagination__prev-page')[0].getAttribute('aria-disabled')

- ページネイション　次へボタンの無効
  document.querySelectorAll('#sr-dds-pagination button.dds__pagination__next-page')[0].getAttribute('aria-disabled')

- cookie プライバシーボタン すべて同意
  document.getElementById('onetrust-accept-btn-handler')

- 今すぐ登録を closeボタン
  #email-capture-container
  document.querySelector('#email-capture-container button[aria-label="close"]')

- アンケート 実行しない
  Array.from(document.querySelectorAll('.QSIWebResponsive-creative-container-fade button')).filter(button => button.textContent.trim() === '実行しない');
  

- 詳細ページ（カスタムページ）に基本構成がある場合
  a.base-config-option
  span.btn btn-outline-primary 今すぐカスタマイズ

- 詳細ページ（カスタマイズページ）に詳細商品の選択肢がある場合
　こちらはカートに入れるか入れないかの選択肢であるため、無視

  - 商品名
    #page-title span.page-title 
    div.model-id 

  - 詳細ページの選択肢一覧
    document.querySelectorAll('.card-deck-item')
    - 中の商品スペック
      card-specs
    - 値段
      document.querySelector(".sale-price")
  - ページング 次無効
    document.querySelector('button[aria-label="Next page"]').disabled


  - オプション抽出
    ux-cell-options