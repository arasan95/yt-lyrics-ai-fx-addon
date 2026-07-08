# AI歌詞翻訳 (YouTube) - Lyrics Translator

YouTube動画上に歌詞、和訳、解説を表示するFirefox向けブラウザ拡張機能です。Geniusから歌詞を取得し、選択したAIプロバイダーで翻訳や解説を生成します。

[![Firefox Add-on](https://img.shields.io/badge/Firefox_Add--on-Download-orange)](https://addons.mozilla.org/ja/firefox/addon/ai%E6%AD%8C%E8%A9%9E%E7%BF%BB%E8%A8%B3-youtube/)

## 主な機能

- YouTube動画上に、移動やサイズ変更ができる歌詞オーバーレイを表示
- 英語歌詞と日本語訳を行ごとに並べて表示
- 歌詞の文化的背景、スラング、文脈、ダブルミーニングなどを日本語で解説
- 過去に検索・翻訳した楽曲の履歴を保存
- 取得済みの歌詞や翻訳をローカルキャッシュし、同じ動画で再表示
- フォントサイズ、透明度、自動スクロール速度、文字の影・縁取り、背景ぼかしを調整

## 対応AIプロバイダー

- Google Gemini
- DeepSeek
- OpenAI
- Hugging Face
- OpenRouter

DeepSeekはAPIのOpenAI互換エンドポイントを使い、`deepseek-v4-flash` を指定します。

## インストール

### Firefox Add-onsからインストール

Firefox Add-onsからインストールできます。

[AI歌詞翻訳 (YouTube) - Firefox Add-ons](https://addons.mozilla.org/ja/firefox/addon/ai%E6%AD%8C%E8%A9%9E%E7%BF%BB%E8%A8%B3-youtube/)

### ソースコードから読み込む

1. このリポジトリをcloneまたはダウンロードします。
2. Firefoxで `about:debugging` を開きます。
3. 「このFirefox」から「一時的なアドオンを読み込む」を選択します。
4. このリポジトリ内の `manifest.json` を選択します。

## 設定

利用前に、拡張機能のオプション画面でAPIキーを保存してください。

1. Firefoxのツールバーから拡張機能のポップアップを開きます。
2. オプション画面を開きます。
3. Genius API Tokenを入力します。
4. 使用するAIプロバイダーのAPIキーを入力します。
5. 必要に応じてGemini、OpenAI、Hugging Face、OpenRouterのモデル名を指定します。
6. 「Save」をクリックします。

Genius API Tokenは [Genius API Clients](https://genius.com/api-clients) から取得できます。

## 使い方

1. YouTubeで音楽動画を開きます。
2. 拡張機能アイコンをクリックします。
3. 曲名・アーティスト名を確認し、必要に応じて修正します。
4. 使用するAIプロバイダーを選択します。
5. 「Search & Show Overlay」をクリックします。
6. 動画上に表示されたオーバーレイで表示やスクロールを調整します。
7. 「Explain」をクリックすると歌詞解説を表示します。

## 開発メモ

- `background.js`: Genius取得、AI翻訳、解説生成、履歴・キャッシュ保存
- `content.js`: YouTubeページ上のオーバーレイ表示
- `popup.js`: 検索フォーム、履歴表示、プロバイダー選択
- `options.js`: APIキーとモデル設定の保存
