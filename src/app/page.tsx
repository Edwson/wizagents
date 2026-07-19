import { platformStats } from "@/lib/data";
import { getLocale, pick } from "@/lib/locale";
import { Btn, SectionLabel, Reveal, GradientText, Magnetic } from "@/components/ui";
import { IconArrowRight, IconArrowUpRight, IconShieldLock, IconRefresh, IconFileCertificate, IconChartLine } from "@tabler/icons-react";

export default async function Landing() {
  const [s, locale] = await Promise.all([platformStats(), getLocale()]);
  const P = (en: string, ja: string, zh: string) => pick(locale, en, ja, zh);

  const premises = [
    { num: "01", icon: IconRefresh, zh: P("Living knowledge, not static files", "生きた知識、静的ファイルではない", "活的知識，不是靜態檔案"), desc: P("Prompts go stale; continuously-updated expert knowledge appreciates. Stop paying, stop service — you buy the latest.", "プロンプトは陳腐化するが、更新され続ける専門知識は価値を増す。支払いを止めればサービスも止まる。", "提示詞會過時，但持續更新的專家知識會增值。停止付費就停止服務——你買的是「最新」。") },
    { num: "02", icon: IconShieldLock, zh: P("The expert's core never leaks", "専門家のコアは決して漏れない", "專家的核心永不外流"), desc: P("Prompts and knowledge stay on the server — you only get an execution endpoint. The only architecture that protects the expert and reassures you.", "プロンプトと知識はサーバーに残り、実行エンドポイントだけを渡す。専門家を守る唯一のアーキテクチャ。", "提示詞與知識庫留在伺服器端，你只拿到一個執行端點——這是唯一能保護專家、也讓你安心的架構。") },
    { num: "03", icon: IconChartLine, zh: P("Renewal rate never lies", "継続率は嘘をつかない", "續訂率不會說謊"), desc: P("Ratings can be gamed, downloads bought — but nobody renews something useless. We put renewal rates in the sunlight.", "評価は操作でき、DLは買えるが、無駄なものは誰も継続しない。継続率を公開する。", "評分可以刷、下載可以買，但沒人會為沒用的東西續訂。我們把續訂率攤在陽光下。") },
  ];

  const loop = [
    { icon: IconArrowUpRight, t: P("Human escalation", "人へエスカレーション", "真人升級"), d: P("Beyond the confidence threshold or on request, seamlessly escalate to the expert, answered within SLA and fed back into the knowledge base.", "信頼閾値を超える、または要求時に専門家へシームレスにエスカレーション。SLA内に回答し知識ベースへ還元。", "超出信心閾值或你主動要求時，無縫升級給專家本人，於 SLA 內回覆並回灌知識庫。") },
    { icon: IconFileCertificate, t: P("Signed answers", "署名付き回答", "實名簽核"), d: P("Request a named sign-off with professional credentials and a timestamp — ready for audit files.", "職業資格とタイムスタンプ付きの署名回答を要求でき、監査文書に利用可能。", "針對高風險判斷申請專家實名簽核，帶執業身分背書與時間戳，可放入稽核文件。") },
    { icon: IconShieldLock, t: P("Provenance", "来歴トレース", "版本溯源"), d: P("Every answer traces back to that day's knowledge-base snapshot — a full evidence chain for regulators.", "すべての回答はその日の知識ベーススナップショットまで遡れる。規制当局への完全な証跡。", "每個答案可回溯到當天的知識庫版本快照——監管質詢時拿得出完整證據鏈。") },
  ];

  return (
    <div>
      {/* ---------- HERO ---------- */}
      <section className="relative -mx-6 overflow-hidden px-6 pb-16 pt-10">
        <div className="animate-fadeup">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-glassborder/40 bg-panel/40 px-3 py-1.5 text-[11px] text-muted backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-green animate-pulsedot" />
            <span>wizagents://mcp.marketplace/<span className="text-grad-neon font-semibold">home</span></span>
          </div>
          <h1 className="max-w-4xl font-display text-[clamp(38px,6vw,68px)] font-bold leading-[1.05]">
            {P("Subscribe to a top expert's ", "トップ専門家の", "訂閱一位頂尖專家的")}
            <GradientText neon>{P("brain", "頭脳", "大腦")}</GradientText>
            {P(", not a ", "を購読する — ", "，而不是雇一位 ")}
            <span className="text-amber">$150/hr</span>
            {P(" consultant.", "コンサルではなく。", " 顧問。")}
          </h1>
          <p className="mt-6 max-w-2xl text-[15px] leading-8 text-muted">
            {P("Every Agent is a verified expert who packages continuously-maintained private knowledge into a 24/7 advisor. When rules change, your Agent knows the next day. Built on the open MCP protocol — paste one URL into Claude, Cursor, or any AI tool.",
               "各Agentは、継続的に維持される専門知識を24/7のアドバイザーに封じ込めた認証済み専門家。ルールが変われば翌日には対応。オープンなMCPプロトコル上に構築され、URL一つでどのAIツールにも接続。",
               "每個 Agent 都是一位受驗證的專家，把持續維護的私有知識封裝成 24/7 隨時可用的顧問。法規一變，你的 Agent 隔天就懂。建立在開放 MCP 協定之上——貼一條 URL 就能接進 Claude、Cursor 或任何 AI 工具。")}
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Magnetic><Btn href="/market" variant="amber" size="lg">{P("Browse the marketplace", "マーケットを見る", "瀏覽專家市集")} <IconArrowRight size={16} stroke={2} /></Btn></Magnetic>
            <Btn href="/login?mode=register" variant="outline" size="lg">{P("Become a creator", "クリエイターになる", "成為創作者")}</Btn>
            <Btn href="/mcp" variant="ghost" size="lg">{P("MCP access", "MCP接続", "MCP 接入")} <IconArrowUpRight size={15} stroke={2} /></Btn>
          </div>

          {/* stats */}
          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { v: s.creators, l: P("verified experts", "認証済み専門家", "位受驗證專家") },
              { v: s.subs.toLocaleString(), l: P("paid subscribers", "有料購読者", "位付費訂閱者") },
              { v: P("Weekly", "毎週", "每週"), l: P("knowledge updates", "知識更新頻度", "知識更新頻率") },
            ].map((x, i) => (
              <Reveal key={i} delay={i * 90} className="glass-card p-6">
                <div className="font-display text-[34px] font-bold text-grad">{x.v}</div>
                <div className="mt-1 text-[12px] text-muted">{x.l}</div>
                <div className="mt-2 text-[9.5px] uppercase tracking-[0.14em] text-faint">{P("illustrative until measured", "計測まで参考値", "實測前為示意")}</div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- WHY IT MATTERS ---------- */}
      <section className="mt-10">
        <Reveal><SectionLabel>{P("WHY IT MATTERS", "なぜ重要か", "為何重要")}</SectionLabel></Reveal>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {premises.map((p, i) => (
            <Reveal key={p.num} delay={i * 100}>
              <div className="glass-card border-grad h-full p-6">
                <div className="flex items-center justify-between">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-panel2/70 text-violet"><p.icon size={18} stroke={1.8} /></span>
                  <span className="font-display text-[13px] font-bold text-faint">{p.num}</span>
                </div>
                <div className="mt-4 font-display text-[17px] font-semibold leading-6">{p.zh}</div>
                <div className="mt-2 text-[13px] leading-7 text-muted">{p.desc}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------- EXPERT LOOP ---------- */}
      <section className="mt-16">
        <Reveal><SectionLabel>{P("THE EXPERT LOOP", "エキスパートループ", "專家迴圈")}</SectionLabel></Reveal>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {loop.map((x, i) => (
            <Reveal key={x.t} delay={i * 100}>
              <div className="glass-card h-full p-5">
                <div className="mb-3 flex items-center gap-2 text-[14px] font-semibold text-purple"><x.icon size={17} stroke={1.8} />{x.t}</div>
                <div className="text-[13px] leading-7 text-muted">{x.d}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------- AVATAR MODES ---------- */}
      <section className="mt-16">
        <Reveal><SectionLabel>{P("FOUR WAYS AN EXPERT SHOWS UP", "専門家の4つの現れ方", "專家的四種現身方式")}</SectionLabel></Reveal>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { g: "師匠", t: P("Mentor","師匠","師匠"), d: P("A master's judgment, on call — to guide a decision, not just answer it.","師の判断をオンデマンドで — 答えるだけでなく決断を導く。","隨時可召的大師判斷力——引導一個決定，而不只是回答它。") },
            { g: "助手", t: P("Assistant","助手","助手"), d: P("The expert's method applied to your task, with their standards baked in.","専門家の手法をあなたのタスクに適用。基準はそのまま。","把專家的方法用在你的任務上，標準內建其中。") },
            { g: "対話", t: P("Conversation","対話","對話"), d: P("Someone to think out loud with, who has actually been there.","実際に経験した人と、声に出して考える相手。","一個能一起把想法說出來、真的走過那條路的人。") },
            { g: "探究", t: P("Discussion","探究","探究"), d: P("A sparring partner for the hard, open questions — pressure-tested by a human.","難しく開かれた問いのための壁打ち相手 — 人によって鍛えられる。","面對困難開放題的思辨對手——由真人壓力測試過。") },
          ].map((x, i) => (
            <Reveal key={x.g} delay={i * 80}>
              <div className="glass-card h-full p-5">
                <div className="font-display text-[22px] font-semibold text-purple">{x.g}</div>
                <div className="mt-1 font-display text-[15px] font-semibold">{x.t}</div>
                <div className="mt-2 text-[12.5px] leading-6 text-muted">{x.d}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------- COMPARISON ---------- */}
      <section className="mt-16">
        <Reveal><SectionLabel>{P("A REAL EXPERT LAYER BEATS THE ALTERNATIVES", "本物の専門家レイヤーは代替を上回る", "真正的專家層勝過其他選項")}</SectionLabel></Reveal>
        <Reveal>
          <div className="glass-card overflow-hidden !p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-[12.5px]">
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase tracking-[0.08em] text-faint">
                    <th className="px-4 py-3 font-medium">{P("","","")}</th>
                    <th className="px-4 py-3 font-medium">{P("A raw LLM","素のLLM","純大型模型")}</th>
                    <th className="px-4 py-3 font-medium">{P("Unverified agent","未検証エージェント","未驗證代理")}</th>
                    <th className="px-4 py-3 font-medium">{P("$300/hr consultant","時給$300のコンサル","時薪$300顧問")}</th>
                    <th className="px-4 py-3 font-semibold text-purple">WizAgents</th>
                  </tr>
                </thead>
                <tbody className="text-muted">
                  {[
                    { r: P("Verified expertise","検証済みの専門性","經驗證的專業"), a: P("Averaged","平均化","被平均"), b: P("Unproven","未証明","未證實"), c: P("Yes","あり","有"), d: P("Reviewed & credentialed","審査・資格確認済み","經審核與資格認證") },
                    { r: P("Always available","常時利用可能","隨時可用"), a: P("Yes","あり","有"), b: P("Yes","あり","有"), c: P("By appointment","予約制","需預約"), d: P("24/7","24/7","24/7") },
                    { r: P("Stays current","最新維持","保持最新"), a: P("Frozen","凍結","凍結於訓練"), b: P("Unmaintained","放置","無維護"), c: P("Yes","あり","有"), d: P("Dated snapshots","日付付き","日期化快照") },
                    { r: P("Traceable provenance","来歴の追跡","可追溯來源"), a: P("None","なし","無"), b: P("None","なし","無"), c: P("Verbal","口頭","口頭"), d: P("Dated + sourced","日付+出典","日期+來源") },
                    { r: P("A human accountable","人が責任を負う","有真人負責"), a: P("No","なし","無"), b: P("No","なし","無"), c: P("Yes","あり","有"), d: P("Named + SLA","実名+SLA","具名+SLA") },
                    { r: P("Cost","コスト","成本"), a: P("Low","低","低"), b: P("Free","無料","免費"), c: P("$$$ / hour","$$$ / 時","$$$ / 小時"), d: P("Monthly subscription","月額","月訂閱") },
                  ].map((row) => (
                    <tr key={row.r} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-3 font-medium text-text">{row.r}</td>
                      <td className="px-4 py-3">{row.a}</td>
                      <td className="px-4 py-3">{row.b}</td>
                      <td className="px-4 py-3">{row.c}</td>
                      <td className="px-4 py-3 font-medium text-text">{row.d}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Reveal>
        <div className="mt-3 text-center text-[12px] text-faint">{P("For the basics, a big model. For the decision, WizAgents.","基本は大型モデルを。決断はWizAgentsを。","基本問題交給大模型；真正的決定，交給 WizAgents。")}</div>
      </section>

      {/* ---------- CTA ---------- */}
      <section className="mt-16">
        <Reveal>
          <div className="glass-card border-grad relative overflow-hidden p-10 text-center">
            <div className="shimmer pointer-events-none absolute inset-0 opacity-60" aria-hidden />
            <div className="relative">
              <div className="font-display text-[24px] font-bold">{P("Turn your expertise into 24/7 income.", "あなたの専門性を24/7の収入に。", "把你的專業變成 24/7 的收入。")}</div>
              <p className="mx-auto mt-3 max-w-lg text-[13px] leading-7 text-muted">{P("The first 30 experts get concierge onboarding: our team packages and lists your knowledge for you.", "最初の30名の専門家にはコンシェルジュ導入を提供。私たちがあなたの知識を代わりに整えて公開します。", "前 30 位專家享「禮賓上線」：我們的團隊親自協助你把知識打包上架。")}</p>
              <div className="mt-6 flex justify-center gap-3">
                <Magnetic><Btn href="/login?mode=register" variant="amber" size="lg">{P("Start free", "無料で始める", "免費開始")} <IconArrowRight size={16} stroke={2} /></Btn></Magnetic>
                <Btn href="/market" variant="ghost" size="lg">{P("Browse first", "先に見る", "先逛市集")}</Btn>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
