# 六合彩預測引擎

基於百期滑動窗口、3σ 偏離追蹤與冷熱動態波動率的量化選號模型。

## 功能

- **號碼預測**:6 個主號 + 1 個特別號,基於統計模型生成
- **三大選號維度**:
  - 動態能量流(Momentum)— 熱者恆熱,捕捉慣性
  - 強效回歸流(Mean Reversion)— 物極必反,能量釋放
  - 拐點動態流(State Transition)— 靜態甦醒,捕捉起爆點
- **EMA 時間衰減**:近期數據權重更高,貼合最新搖珠機狀態
- **博弈論防撞網**:避開生日號、等差數列等大眾偏好組合
- **數據分析**:頻率分佈、冷熱號碼、σ 偏離視覺化
- **歷史紀錄**:2026 年真實開獎數據

## 技術棧

- React + TypeScript + Vite
- Tailwind CSS + Lucide React
- Supabase(數據存儲)
- Capacitor(Android APK 打包)

## 開發

```bash
npm install
npm run dev      # 啟動開發服務器
npm run build    # 構建生產版本
npm run typecheck # 類型檢查
```

## 發布 APK

推送 `v*` 標籤即可觸發 GitHub Actions 自動構建 APK 並發布到 Releases:

```bash
git tag v1.0.0
git push origin v1.0.0
```

## 免責聲明

本工具僅供統計研究與娛樂用途,預測結果不保證中獎。六合彩開獎結果為隨機事件,任何預測方法皆無法確切預知開獎號碼。請理性投注,量力而為。
