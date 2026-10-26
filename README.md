# HOLE

穴をドラッグして物を飲み込み、段階的に成長するブラウザゲームの試作。
TypeScript / React / Three.js / Rapier / Vite。

[遊ぶ・端末に保存する](https://takemasa5.github.io/tiny-hole/)

ドラッグ・WASD・矢印キーで操作。8段階の成長演出と効果音、穴から逃げる人、20段積みの箱を含む。
効果音は最初の操作から有効になり、右上でON/OFFを切り替えられる。

```sh
npm install
npm run dev -- --port 5173
```

[試作仕様・操作・検証方法](docs/prototype.md) / [仕様と全体計画](docs/README.md)

オフライン保存用の配布版は `npm run build` で作成する。HTTPSで開き、「オフライン準備完了」を確認してからiPhoneの「ホーム画面に追加」、PCのアプリとしてのインストールで保存できる。[保存手順と配信条件](docs/offline.md)

初回は `brew install gitleaks` と `npm run hooks:install` でコミット前・push前の検査を有効にする。[検査の対象と限界](docs/security.md)
