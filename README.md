# Receipts OCR Web Application

自動由圖片讀取收據資料，並匯出 CSV 檔案。

## 功能

- 選擇資料夾並讀取所有 JPEG、JPG、PNG、BMP 收據圖片
- OCR 辨識：**貨品名稱**（第一項）、**總價錢**、**日期**
- 匯出 CSV 至瀏覽器預設「下載」資料夾
- 檔名格式：`Receipts_yyyyMMddHHmm.csv`

## 本地開發

```bash
npm install
npm run dev
```

開啟 [http://localhost:3001](http://localhost:3001)

## Docker / Zeabur 部署

```bash
docker build -t receipts-app .
docker run -p 3000:3000 receipts-app
```

Zeabur 會自動偵測 `Dockerfile` 並部署。應用程式監聽 `PORT` 環境變數（預設 3000）。

## 技術

- Next.js 15 + TypeScript
- Tesseract.js（繁體中文 + 英文 OCR）
- Tailwind CSS

## 注意事項

- 瀏覽器基於安全限制，需透過「選擇資料夾」上傳圖片至伺服器進行 OCR
- OCR 準確度視收據清晰度及排版而定；如無法辨識會顯示「（未能識別）」
- CSV 下載位置為使用者瀏覽器設定的「下載」資料夾
