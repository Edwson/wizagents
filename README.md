# WizAgents

**Subscribe to an expert, not a prompt.** A marketplace where verified human experts publish protected avatar Agents that buyers subscribe to over MCP — with an anti-distillation shield, provenance receipts, KYC-verified experts, enterprise seats & governance, and a community forum.

🔗 https://wiz-agents.com &nbsp;·&nbsp; 🛡️ Proprietary — All rights reserved &nbsp;·&nbsp; 🔒 Private repository

> Built with Next.js 15 (App Router), React 19, TypeScript, Prisma, and Tailwind. Self-hostable via Docker.

---

# WizAgents — 專家 Agent 訂閱市集（可運行全端產品）

> 訂閱一位專家，而不是買一段提示詞。建立在開放 MCP 協定之上的付費專家 Agent 訂閱平台。

這是一個**真的能跑**的全端 Next.js 應用：真實資料庫、登入、訂閱、金流（測試）、
Agent 串流對話、每個 Agent 一個授權式 MCP 端點、Expert Loop（真人升級／實名簽核／版本溯源），
以及買家 / 創作者 / 企業三端完整介面。

---

## 快速開始

```bash
git clone https://github.com/Edwson/wizagents.git
cd wizagents
npm install          # 安裝相依套件
npm run setup        # 產生 Prisma client、建立 SQLite 資料庫、灌入 122 個示範 Agent
npm run dev          # 啟動開發伺服器 → http://localhost:3000
```

打開 http://localhost:3000 ，用下方任一示範帳號登入（密碼皆為 `demo1234`）：

| 角色 | Email | 進入 |
|---|---|---|
| 買家 | `buyer@wiz-agents.com` | 市集、訂閱、對話、真人升級 |
| 創作者 | `creator@wiz-agents.com` | 工作室、上架、收益、Expert Loop 收件匣 |
| 企業 | `enterprise@wiz-agents.com` | 席位、審計日誌、黑名單 |

> 登入頁也有「示範帳號一鍵登入」按鈕。任何頁面按 **⌘K / Ctrl+K** 可快速搜尋。

---

## 技術棧

- **Next.js 15**（App Router, React 19, TypeScript）
- **Prisma + SQLite**（零設定即可跑；可換 Postgres 上正式環境）
- **JWT Cookie 認證**（`jose` + `bcryptjs`，多角色）
- **Tailwind CSS**（深色終端機風設計系統）
- 內建**專家對話引擎**：未設定 LLM 金鑰時走決定式專家回覆（離線也完整可用）；
  設定金鑰後改用真 LLM。回覆以 SSE 串流逐字顯示。

---

## 三端功能

**買家**：市集（搜尋／排序／分類＋數量／通行證／為你推薦）、Agent 詳情、免費試用沙盒
（串流對話）、Stripe 風格結帳、我的訂閱儀表板（MCP 端點＋Token、續約管理、真人升級紀錄、帳務）。

**創作者**：工作室儀表板（訂閱數／MRR／續訂率／收益）、四步零代碼上架精靈、
Agent 編輯、知識庫版本推送（稽核級溯源）、實名認證、Expert Loop 升級收件匣（回覆／簽核）、
公開店面 `/creator/[id]`。

**企業**：團隊席位管理、完整審計日誌、合規黑名單、組織訂閱總覽。

**Expert Loop**：真人升級（SLA 佇列）、實名簽核（責任轉移）、知識版本溯源。

---

## 每個 Agent = 一個授權式 MCP 端點

訂閱後你會拿到一個端點與 Token。可用標準 MCP JSON-RPC 呼叫：

```bash
# 取得公開 manifest（無需 token）
curl http://localhost:3000/api/mcp/kyc-aml

# 呼叫 Agent（需要有效訂閱 token）
curl -X POST http://localhost:3000/api/mcp/kyc-aml \
  -H "Authorization: Bearer <你的訂閱-token>" \
  -H "Content-Type: application/json" \
  -d '{"id":1,"method":"tools/call","params":{"name":"ask_expert","arguments":{"question":"跨轄區 KYC 差異?"}}}'
```

無 token 呼叫 `tools/call` 會回 401——這就是「Prompt 永不離開伺服器」的執行層護城河。
正式部署時把 `mcp.wiz-agents.com/a/{slug}` 對應到這個 route 即可。

---

## 接上真 LLM（可選）

編輯 `.env`（可從 `.env.example` 複製）：

```
LLM_API_KEY=sk-...              # 任何 OpenAI 相容端點
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
```

留空則使用內建專家引擎（所有功能照常運作）。

---

## 常用指令

```bash
npm run dev      # 開發模式
npm run build    # 正式建置
npm run start    # 正式伺服器
npm run setup    # 重新產生 client + 建庫 + 灌種子
npm run seed     # 只重跑種子資料
```

---

## 上正式環境的下一步

1. **資料庫**：把 `prisma/schema.prisma` 的 `provider` 改為 `postgresql`，`DATABASE_URL` 指向雲端 Postgres。
2. **金流**：`/api/subscribe` 與結帳目前為測試流程，接上真正的 Stripe（訂閱＋webhook）。
3. **安全**：更新 `AUTH_SECRET`；並將 Next.js 升級到最新修補版（`npm i next@latest`）。
4. **部署**：Vercel 一鍵部署；MCP 端點網域對應到 `/api/mcp/[slug]`。

---

## v1.1 更新（體驗強化）

- **串流對話**：Agent 回覆逐字串流顯示，對話更即時有感。
- **⌘K 指令面板**：任何頁面快速搜尋 Agent 或跳轉頁面。
- **創作者公開店面** `/creator/[id]`：專家的所有 Agent、認證、續訂率一頁看完。
- **全域 Toast 通知**：訂閱、評價、席位、黑名單等操作即時回饋。
- **行動版導覽**：漢堡選單，手機也好用。
- **載入骨架與 404 頁**、市集「為你推薦」與分類數量。

---

## v1.2 更新（有意義的功能 + 邏輯一致性）

- **跨角色通知系統**：訂閱→通知創作者、升級回覆→通知買家、知識推送→通知所有訂閱者、評價→通知創作者。Nav 鈴鐺顯示未讀數。
- **帳號設定頁** `/settings`：編輯名稱、一鍵「升級為創作者」、認證狀態。
- **創作者收益明細** `/studio/revenue`：每 Agent 分潤、take-rate 拆分、月收入趨勢、Expert Loop 加值收入。
- **角色感知導覽**：企業分頁僅企業角色可見。
- **邏輯一致性修正**：升級回覆/簽核僅限該 Agent 的專家；評價僅限訂閱者且防重複、動態重算 Agent 評分；取消訂閱正確遞減訂閱數。
---

## v1.3 更新（平台化：Admin · 規則 · 用量 · MCP）

- **Admin 管理後台** `/admin`（管理員專用）：平台 KPI 總覽（GMV/收入/訂閱/用量）、Agent 上下架審核、使用者角色管理、創作者認證審核、交易帳本、平台設定編輯、派生資料一鍵重算。
- **平台設定規則引擎**：抽成比例、通行證月費、預設試用數、每日用量上限、Expert Loop 抽成，全部由 admin 即時調整並驅動全平台邏輯（分潤、定價、限流）。
- **用量計量與速率限制**：每次對話/MCP 呼叫都計量，超過每日上限回 429；買家/創作者/admin 皆可見用量。
- **MCP 強化**：新增 `resources/list`（知識庫版本溯源）、用量計量、更完整 manifest；公開 **`/mcp` 接入頁**含 Claude Desktop / Cursor / cURL 設定產生器。
- 新增管理員示範帳號 `admin@wiz-agents.com`（密碼 demo1234）。
---

## v1.4 更新（並行開發：內容擴充 + 探索/分析/收藏）

- **Agent 擴充至 180 個**（跨 30 個垂直分類：新增資料科學、稅務、資安、DevOps、留學、職涯、材料、太空等）。
- **進階搜尋** `/search`：關鍵字 + 分類多選（含數量）+ 價格區間 + 最低續訂率 + 通行證篩選 + 多維排序。
- **Agent 比較** `/compare`：2-3 個 Agent 並排比較（價格/續訂/評分/能力/費用），逐列標示最佳值。
- **收藏/願望清單** `/favorites`：Agent 詳情頁一鍵收藏（♥），集中管理。
- **創作者深度分析** `/studio/analytics`：近 14 天用量、訂閱成長曲線、每 Agent 表現拆分。
- 市集頂部與 ⌘K 面板皆可快速進入上述功能。
- 本輪以「主控 + 3 個並行子代理」同步開發後統一整合。
---

## v1.5 (Internationalization + Tabler icons)

- **Trilingual UI**: English (default), 日本語, 中文 — switch from the globe menu in the top nav; the choice is saved to a cookie and applied server-side with no flash.
- **i18n architecture**: `src/lib/i18n.tsx` (client `useI18n().t(en,ja,zh)`) + `src/lib/locale.ts` (server `getLocale()` / `pick()`). English is the default fallback.
- **Tabler icons** (`/icons-react`) replace all emoji across the product for a consistent, professional icon set.
---

## 專案結構

```
app/
├── prisma/
│   ├── schema.prisma        # 15 個資料模型
│   ├── seed.ts              # 122 Agent + 60 創作者 + 各角色資料
│   └── data/                # 種子來源 JSON
├── src/
│   ├── app/                 # 頁面與 API routes（App Router）
│   │   ├── market/ agent/ creator/ dashboard/ studio/ enterprise/ login/
│   │   └── api/             # auth, chat(+stream), subscribe, escalation, mcp, creator, enterprise, agents…
│   ├── components/          # UI 元件（市集卡、串流對話框、指令面板、Toast、儀表板…）
│   └── lib/                 # db, auth, session, agent-engine, categories…
└── .env
```
