# AI歌詞翻訳 (YouTube) - Lyrics Translator (v2.1)

YouTube動画上で直接、歌詞とその翻訳（日本語）、および詳細な解説を表示するブラウザ拡張機能です。

[![Firefox Add-on](https://img.shields.io/badge/Firefox_Add--on-Download-orange)](https://addons.mozilla.org/ja/firefox/addon/ai%E6%AD%8C%E8%A9%9E%E7%BF%BB%E8%A8%B3-youtube/)

## 主な機能

- **歌詞オーバーレイ**: YouTube動画の上に、ドラッグ移動やサイズ変更が可能なフローティングウィンドウで歌詞を表示します。
- **AI翻訳**: Google Gemini, DeepSeek, OpenAI (ChatGPT) などの高度なAIを使用して、歌詞を文脈に合わせて日本語に翻訳します。
- **歌詞解説**: 「Explain」ボタンを押すことで、歌詞の文化的背景、スラング、意図などをAIが詳しく解説します。
- **マルチAI対応**: 以下のAIプロバイダーをサポートしています。
  - Google Gemini
  - DeepSeek
  - OpenAI (ChatGPT)
  - Hugging Face
  - OpenRouter
- **カスタマイズ**:
  - Edge (縁取り): 明るい背景でも文字がくっきり見えるよう、黒い縁取りの太さを調整可能。
  - フォントサイズ、ウィンドウの透明度、自動スクロール速度の調整。
  - 背景のぼかし効果 (Blur) のオン/オフ。
- **履歴機能**: 過去に検索・翻訳した楽曲の履歴を閲覧・管理できます。
- **キャッシュ**: 一度取得した歌詞や翻訳はローカルに保存され、次回の読み込みが高速化されます。

## インストール方法

### Firefox Add-ons からインストール (推奨)
以下のリンクから公式アドオンをインストールできます。
[**AI歌詞翻訳 (YouTube) - Firefox Add-ons**](https://addons.mozilla.org/ja/firefox/addon/ai%E6%AD%8C%E8%A9%9E%E7%BF%BB%E8%A8%B3-youtube/)

### ソースコードからインストール (開発者向け)
1. このリポジトリをダウンロード（またはClone）します。
2. Firefoxで `about:debugging` を開きます。
3. 「PC 上の Firefox (This Firefox)」 > 「一時的な拡張機能を読み込む (Load Temporary Add-on)」をクリックします。
4. フォルダ内の `manifest.json` ファイルを選択します。

## 設定 (Configuration)

利用を開始する前に、APIキーの設定が必要です。

1. ブラウザのツールバーにある拡張機能アイコンをクリックし、歯車マーク（または右クリックメニュー）から **オプション (Options)** を開きます。
2. **Genius API Token**: 歌詞を取得するために必須です。[Genius API Client Page](https://genius.com/api-clients) から取得してください。
3. **AI Provider Settings**: 使用したいAIサービスのAPIキーを入力してください (例: Gemini API Key, OpenAI API Keyなど)。
4. 「Save」をクリックして設定を保存します。

## 使い方

1. YouTubeで音楽動画を開きます。
2. 拡張機能アイコンをクリックしてポップアップを開きます。
3. 曲名・アーティスト名が自動入力されていない場合は手動で入力するか、「Free Search」欄に入力します。
4. 使用するAIプロバイダーをドロップダウンから選択します。
5. **Search & Show Overlay** ボタンをクリックします。
6. 動画上に歌詞オーバーレイが表示されます。
   - **Edgeスライダー**: 文字の縁取りを調整。
   - **Spdスライダー**: 自動スクロールの速度を調整。
   - **Explainボタン**: 歌詞の解説を表示。

## 最新アップデート (v2.1)

- **マルチAI対応**: OpenAI, Hugging Face, OpenRouter を追加サポート。
- **字幕風スタイル**: 文字に黒い縁取りを追加する「Edge」スライダーを実装し、視認性を向上。
- **表示崩れの修正**: 縁取りによる文字の痩せ（浸食）を防ぐため、描画方式を改善。
- **パッケージング**: 不要なファイルを除外したクリーンなリリースビルドに対応。
