# Lyrics Trancelator (YouTube)

YouTube動画上に歌詞と日本語訳を表示するFirefox向けブラウザ拡張機能です。Geniusから歌詞を取得し、Google GeminiまたはDeepSeekで行ごとに翻訳します。

## 主な機能

- YouTube動画上に歌詞・翻訳オーバーレイを表示
- オーバーレイの移動・サイズ変更
- フォントサイズと透明度の調整
- Geniusからの歌詞検索
- Google Gemini / DeepSeekによる日本語翻訳

## インストール

1. このリポジトリをcloneまたはダウンロードします。
2. Firefoxで `about:debugging` を開きます。
3. 「このFirefox」から「一時的なアドオンを読み込む」を選択します。
4. リポジトリ直下の `manifest.json` を選択します。

## 設定

拡張機能のオプション画面で、利用するAIプロバイダーのAPIキーとGenius Access Tokenを入力してください。

- Genius API Token: [Genius API Clients](https://genius.com/api-clients)
- Gemini API Key: [Google AI Studio](https://aistudio.google.com/app/apikey)
- DeepSeek API Key: [DeepSeek Platform](https://platform.deepseek.com/)

APIキーはリポジトリに保存されません。Firefoxのローカルストレージに保存されます。

## ファイル構成

- `background.js`: Geniusからの歌詞取得とAI翻訳
- `content.js`: YouTube上のオーバーレイ表示
- `popup.js`: 曲名・アーティスト名の入力と検索開始
- `options.js`: APIキーとモデル設定の保存

## ライセンス

MIT License
