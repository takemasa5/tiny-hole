# 音声素材

更新日: 2026-10-15

`public/audio/american-fall.wav` は、オーナーが指定した「Damn it!」をmacOS標準の男性音声合成（Daniel / en_GB）で生成した試作用の声。モノラル・44,100Hz・16bit PCM、約0.70秒。外部サービスや追加依存は使わない。

生成コマンド:

```sh
say -v Daniel -r 125 -o public/audio/american-fall.wav --file-format=WAVE --data-format=LEI16@44100 'Damn it!'
```

ゲーム内では子音を切らないように前後の余白を保ってWeb Audioで再生する。セリフの前半は音量を保ち、後半で下げる。同じ波形をブラウザへ配布するため、プレイ中に端末の読み上げ機能は使わない。

初版はFred / en_US・145語/分・22,050Hzで生成した。オーナーから「Damn it!と聞こえない」との評価があったため、声を替えて125語/分で再作成し、英語用の減衰を遅らせた。
