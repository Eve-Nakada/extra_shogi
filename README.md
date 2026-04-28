# ローカル将棋

HTML / CSS / JavaScript ES Modules だけで動く、通信なしのローカル将棋です。

## 現在の実装範囲

- 本将棋のローカル対局
- 合法手ハイライト
- 駒取り、持ち駒、駒打ち
- 成り、強制成り
- 王手、王手放置禁止、詰み
- 投了、初期化
- 棋譜ログ表示
- 1手戻す
- 棋譜再生
- JSON書き出し / JSON読み込み
- localStorageへのローカル保存 / 読み込み
- 11x11の拡張検証ルールセット
- 追加駒のデータ定義検証

## ローカル起動

```bash
python3 -m http.server 8000
```

ブラウザで以下を開きます。

```text
http://localhost:8000
```

## テスト

```bash
npm test
```

Node.js の組み込みテストランナーを使います。追加の npm パッケージは不要です。

## ルールセット

### 本将棋

通常の9x9将棋です。

### 拡張検証将棋 11x11

盤面サイズ可変と駒定義データ駆動を検証するためのルールセットです。
標準駒に加えて以下の追加駒を持ちます。

- 麒麟: 8方向1マス + 縦横2マスジャンプ
- 銅将: 前3方向 + 真後ろ1マス。成ると金相当
- 走兵: 前方スライド + 左右1マス。成ると金相当

## 保存形式

JSON書き出しでは、盤面HTMLではなく以下を保存します。

- rulesetId
- turn
- status
- history
- move
- captured
- pieceBefore / pieceAfter

将来の通信対戦では、この `history` または `move` を共有する方針にできます。

## GitHub Pages

GitHub Pages で公開する場合は、リポジトリの Settings > Pages で Source を GitHub Actions に設定してください。
`main` ブランチへ push すると、テスト成功後にデプロイされます。
