# ローカル将棋

HTML / CSS / JavaScript ES Modules だけで動く、通信なしのローカル将棋です。

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

## GitHub Pages

GitHub Pages で公開する場合は、リポジトリの Settings > Pages で Source を GitHub Actions に設定してください。
`main` ブランチへ push すると、テスト成功後にデプロイされます。
