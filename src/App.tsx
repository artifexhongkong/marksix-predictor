import { useEffect, useMemo, useState } from 'react';
import {
  Sparkles,
  BarChart3,
  History,
  TrendingUp,
  Flame,
  Snowflake,
  RefreshCw,
  Save,
  Target,
  Hash,
  Info,
  Loader2,
  Zap,
  RotateCcw,
  Activity,
  Shield,
} from 'lucide-react';
import {
  DEFAULT_PARAMS,
  predict,
  analyze,
  type EngineParams,
  type PredictionResult,
  type Stream,
} from './lib/engine';
import { fetchDraws, savePrediction, fetchRecentPredictions } from './lib/data';
import type { Draw, Prediction } from './lib/supabase';
import Ball from './components/Ball';

type Tab = 'predict' | 'stats' | 'history';

const STREAM_META: Record<Stream, { label: string; icon: typeof Zap; color: string }> = {
  momentum: { label: '動態能量流', icon: Zap, color: 'text-orange-400' },
  reversion: { label: '強效回歸流', icon: RotateCcw, color: 'text-blue-400' },
  transition: { label: '拐點動態流', icon: Activity, color: 'text-emerald-400' },
};

export default function App() {
  const [tab, setTab] = useState<Tab>('predict');
  const [draws, setDraws] = useState<Draw[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useState<EngineParams>(DEFAULT_PARAMS);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saved, setSaved] = useState(false);
  const [recentPreds, setRecentPreds] = useState<Prediction[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [d, p] = await Promise.all([fetchDraws(), fetchRecentPredictions()]);
        setDraws(d);
        setRecentPreds(p);
      } catch (e) {
        setError(e instanceof Error ? e.message : '載入資料失敗');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const analysis = useMemo(
    () => (draws.length ? analyze(draws, params) : null),
    [draws, params]
  );

  async function handleGenerate() {
    if (draws.length === 0) return;
    setGenerating(true);
    setSaved(false);
    await new Promise((r) => setTimeout(r, 400));
    const nextParams = { ...params, seed: Math.floor(Math.random() * 1e9) };
    const r = predict(draws, nextParams);
    setResult(r);
    setGenerating(false);
  }

  async function handleSave() {
    if (!result) return;
    try {
      const next = draws.length
        ? Math.max(...draws.map((d) => d.draw_number)) + 1
        : null;
      const saved_ = await savePrediction(
        result.numbers,
        result.specialNumber,
        'rolling-100-3sigma',
        result.analysis.params,
        next
      );
      setRecentPreds((prev) => [saved_, ...prev].slice(0, 20));
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : '儲存失敗');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 bg-grid relative">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-600/20 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <Header drawsCount={draws.length} />

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-200 text-sm">
            {error}
          </div>
        )}

        <Tabs tab={tab} setTab={setTab} />

        <div className="mt-6">
          {tab === 'predict' && (
            <PredictTab
              result={result}
              generating={generating}
              onGenerate={handleGenerate}
              onSave={handleSave}
              saved={saved}
              params={params}
              setParams={setParams}
              drawsCount={draws.length}
            />
          )}
          {tab === 'stats' && <StatsTab analysis={analysis} />}
          {tab === 'history' && (
            <HistoryTab draws={draws} predictions={recentPreds} />
          )}
        </div>

        <Footer />
      </div>
    </div>
  );
}

function Header({ drawsCount }: { drawsCount: number }) {
  return (
    <header className="mb-8 animate-fade-up">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-400 to-blue-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            六合彩預測引擎
          </h1>
          <p className="text-slate-400 text-sm">
            百期滑動窗口 · 3σ 偏離追蹤 · 冷熱動態波動率模型 · 已載入 {drawsCount} 期
          </p>
        </div>
      </div>
    </header>
  );
}

function Tabs({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const items: { key: Tab; label: string; icon: typeof Sparkles }[] = [
    { key: 'predict', label: '號碼預測', icon: Target },
    { key: 'stats', label: '數據分析', icon: BarChart3 },
    { key: 'history', label: '歷史紀錄', icon: History },
  ];
  return (
    <div className="inline-flex gap-1 p-1 rounded-2xl bg-slate-900/70 border border-slate-800 backdrop-blur">
      {items.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          onClick={() => setTab(key)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            tab === key
              ? 'bg-gradient-to-br from-emerald-500 to-blue-500 text-white shadow-lg shadow-emerald-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Icon className="w-4 h-4" />
          {label}
        </button>
      ))}
    </div>
  );
}

function PredictTab({
  result,
  generating,
  onGenerate,
  onSave,
  saved,
  params,
  setParams,
  drawsCount,
}: {
  result: PredictionResult | null;
  generating: boolean;
  onGenerate: () => void;
  onSave: () => void;
  saved: boolean;
  params: EngineParams;
  setParams: (p: EngineParams) => void;
  drawsCount: number;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 backdrop-blur p-6 sm:p-8 animate-fade-up">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Target className="w-5 h-5 text-emerald-400" />
            本期預測號碼
          </h2>
          <span className="text-xs text-slate-500">6 個主號 + 1 個特別號</span>
        </div>

        {result ? (
          <div className="animate-fade-in">
            <div className="flex flex-wrap items-end gap-3 sm:gap-4 mb-8">
              {result.numbers.map((n, i) => (
                <Ball key={n} n={n} size="lg" delay={i * 80} />
              ))}
              <div className="mx-1 mb-1 w-px h-14 bg-slate-700" />
              <Ball
                n={result.specialNumber}
                size="lg"
                special
                delay={result.numbers.length * 80 + 120}
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <Stat label="號碼總和" value={result.numbers.reduce((s, n) => s + n, 0)} />
              <Stat
                label="奇偶比"
                value={`${result.numbers.filter((n) => n % 2 === 1).length}:${
                  result.numbers.filter((n) => n % 2 === 0).length
                }`}
              />
              <Stat label="最大號" value={Math.max(...result.numbers)} />
              <Stat label="最小號" value={Math.min(...result.numbers)} />
            </div>

            {/* Stream breakdown */}
            <div className="rounded-2xl bg-slate-800/50 border border-slate-700/50 p-4 mb-4">
              <div className="flex items-center gap-2 mb-3 text-sm font-medium text-slate-300">
                <Activity className="w-4 h-4 text-emerald-400" />
                選號維度分佈
              </div>
              <div className="grid grid-cols-3 gap-3">
                {result.streamBreakdown.map(({ stream, label, count }) => {
                  const meta = STREAM_META[stream];
                  const Icon = meta.icon;
                  return (
                    <div
                      key={stream}
                      className="rounded-xl bg-slate-900/60 border border-slate-700/40 p-3 text-center"
                    >
                      <Icon className={`w-5 h-5 mx-auto mb-1 ${meta.color}`} />
                      <div className={`text-2xl font-bold ${meta.color}`}>{count}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{label}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Methodology explanation */}
            <div className="rounded-2xl bg-slate-800/50 border border-slate-700/50 p-4">
              <div className="flex items-center gap-2 mb-2 text-sm font-medium text-slate-300">
                <Info className="w-4 h-4 text-blue-400" />
                預測依據
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                基於 {result.analysis.drawsUsed} 期滑動窗口,理論基準線 E(X) ≈{' '}
                {result.analysis.baseline.toFixed(2)} 次,標準差 σ ≈{' '}
                {result.analysis.sigma.toFixed(2)}。
                模型偵測偏離 3σ 的冷熱號碼,結合 EMA 時間衰減(近 {params.emaSpan} 期權重{' '}
                {(params.emaRecentWeight * 100).toFixed(0)}%),並以博弈論防撞網過濾生日號與等差數列。
              </p>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={onSave}
                disabled={saved}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors disabled:opacity-50"
              >
                {saved ? (
                  <>
                    <RefreshCw className="w-4 h-4" /> 已儲存
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" /> 儲存預測
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 rounded-full bg-slate-800/60 flex items-center justify-center mb-4">
              <Hash className="w-10 h-10 text-slate-600" />
            </div>
            <p className="text-slate-400 mb-1">點擊下方按鈕生成預測</p>
            <p className="text-slate-600 text-sm">
              引擎將以百期窗口分析 {drawsCount} 期歷史數據
            </p>
          </div>
        )}

        <button
          onClick={onGenerate}
          disabled={generating || drawsCount === 0}
          className="w-full mt-6 flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-semibold text-white bg-gradient-to-br from-emerald-500 to-blue-500 hover:from-emerald-400 hover:to-blue-400 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-60"
        >
          {generating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" /> 分析中...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" /> {result ? '重新生成預測' : '生成預測號碼'}
            </>
          )}
        </button>
      </div>

      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 backdrop-blur p-6 animate-fade-up h-fit">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          引擎參數
        </h3>
        <div className="space-y-4">
          <Slider
            label="滑動窗口期數"
            value={params.window}
            min={20}
            max={105}
            step={5}
            onChange={(v) => setParams({ ...params, window: v })}
          />
          <Slider
            label="σ 偏離門檻"
            value={params.sigmaThreshold}
            min={1}
            max={4}
            step={0.5}
            onChange={(v) => setParams({ ...params, sigmaThreshold: v })}
          />
          <Slider
            label="近期權重 (EMA)"
            value={params.emaRecentWeight}
            min={0.3}
            max={0.9}
            step={0.05}
            onChange={(v) => setParams({ ...params, emaRecentWeight: v })}
          />
          <Slider
            label="動態能量流權重"
            value={params.momentumWeight}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => setParams({ ...params, momentumWeight: v })}
          />
          <Slider
            label="強效回歸流權重"
            value={params.reversionWeight}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => setParams({ ...params, reversionWeight: v })}
          />
          <Slider
            label="拐點動態流權重"
            value={params.transitionWeight}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => setParams({ ...params, transitionWeight: v })}
          />
        </div>
        <label className="flex items-center gap-2 mt-4 cursor-pointer">
          <input
            type="checkbox"
            checked={params.crowdBiasFilter}
            onChange={(e) =>
              setParams({ ...params, crowdBiasFilter: e.target.checked })
            }
            className="w-4 h-4 rounded accent-emerald-500"
          />
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <Shield className="w-3 h-3" /> 博弈論防撞網
          </span>
        </label>
        <button
          onClick={() => setParams(DEFAULT_PARAMS)}
          className="mt-4 text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          重置為預設值
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 px-3 py-2">
      <div className="text-xs text-slate-500 mb-0.5">{label}</div>
      <div className="text-base font-semibold text-slate-100">{value}</div>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-slate-400">{label}</span>
        <span className="text-emerald-400 font-medium">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full bg-slate-700 accent-emerald-500 cursor-pointer"
      />
    </div>
  );
}

function StatsTab({ analysis }: { analysis: ReturnType<typeof analyze> | null }) {
  if (!analysis) return null;
  const maxCount = Math.max(1, ...analysis.stats.map((s) => s.count));

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Baseline info */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur p-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span className="text-slate-400">
            理論基準線 <span className="text-emerald-400 font-semibold">E(X) ≈ {analysis.baseline.toFixed(2)}</span> 次
          </span>
          <span className="text-slate-400">
            標準差 <span className="text-blue-400 font-semibold">σ ≈ {analysis.sigma.toFixed(2)}</span>
          </span>
          <span className="text-slate-400">
            分析期數 <span className="text-slate-200 font-semibold">{analysis.drawsUsed}</span>
          </span>
          <span className="text-slate-400">
            3σ 門檻 <span className="text-amber-400 font-semibold">±{(analysis.sigma * 3).toFixed(2)}</span>
          </span>
        </div>
      </div>

      {/* Three streams */}
      <div className="grid sm:grid-cols-3 gap-4">
        <StreamCard
          title="動態能量流"
          subtitle="熱者恆熱 · 慣性追熱"
          icon={Zap}
          color="orange"
          stats={analysis.hot}
        />
        <StreamCard
          title="強效回歸流"
          subtitle="物極必反 · 能量釋放"
          icon={RotateCcw}
          color="blue"
          stats={analysis.cold}
        />
        <StreamCard
          title="拐點動態流"
          subtitle="靜態甦醒 · 捕捉起爆點"
          icon={Activity}
          color="emerald"
          stats={analysis.transitioning}
        />
      </div>

      {/* Frequency chart */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 backdrop-blur p-6">
        <h3 className="flex items-center gap-2 mb-4 font-semibold">
          <BarChart3 className="w-5 h-5 text-emerald-400" />
          號碼出現頻率與 σ 偏離 (1–49)
        </h3>
        <div className="grid grid-cols-7 sm:grid-cols-10 gap-1.5">
          {analysis.stats.map((s) => {
            const isHot = s.deviation > analysis.params.sigmaThreshold;
            const isCold = s.deviation < -analysis.params.sigmaThreshold;
            return (
              <div key={s.number} className="flex flex-col items-center gap-1">
                <div className="w-full h-20 flex items-end relative">
                  <div
                    className={`w-full rounded-t ${
                      isHot
                        ? 'bg-gradient-to-t from-orange-600/40 to-orange-400'
                        : isCold
                        ? 'bg-gradient-to-t from-blue-600/40 to-blue-400'
                        : 'bg-gradient-to-t from-emerald-600/40 to-emerald-400'
                    }`}
                    style={{ height: `${(s.count / maxCount) * 100}%` }}
                    title={`號碼 ${s.number}: ${s.count} 次 (σ偏離 ${s.deviation.toFixed(2)})`}
                  />
                </div>
                <span className={`text-[10px] ${isHot ? 'text-orange-400' : isCold ? 'text-blue-400' : 'text-slate-500'}`}>
                  {s.number}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 mt-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-orange-400" /> 熱號 (&gt;+{analysis.params.sigmaThreshold}σ)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-blue-400" /> 冷號 (&lt;-{analysis.params.sigmaThreshold}σ)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-400" /> 正常區間
          </span>
        </div>
      </div>
    </div>
  );
}

function StreamCard({
  title,
  subtitle,
  icon: Icon,
  color,
  stats,
}: {
  title: string;
  subtitle: string;
  icon: typeof Zap;
  color: 'orange' | 'blue' | 'emerald';
  stats: ReturnType<typeof analyze>['hot'];
}) {
  const colorMap = {
    orange: 'text-orange-400 border-orange-500/30',
    blue: 'text-blue-400 border-blue-500/30',
    emerald: 'text-emerald-400 border-emerald-500/30',
  };
  return (
    <div className={`rounded-3xl border bg-slate-900/60 backdrop-blur p-5 ${colorMap[color]}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-5 h-5 ${colorMap[color].split(' ')[0]}`} />
        <h3 className="font-semibold text-slate-100">{title}</h3>
      </div>
      <p className="text-xs text-slate-500 mb-4">{subtitle}</p>
      {stats.length === 0 ? (
        <p className="text-slate-600 text-sm">本窗口無符合條件號碼</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {stats.map((s, i) => (
            <Ball key={s.number} n={s.number} size="sm" delay={i * 50} animate={false} />
          ))}
        </div>
      )}
    </div>
  );
}

function HistoryTab({
  draws,
  predictions,
}: {
  draws: Draw[];
  predictions: Prediction[];
}) {
  return (
    <div className="space-y-6 animate-fade-up">
      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 backdrop-blur p-6">
        <h3 className="flex items-center gap-2 mb-4 font-semibold">
          <Target className="w-5 h-5 text-emerald-400" />
          儲存的預測
        </h3>
        {predictions.length === 0 ? (
          <p className="text-slate-500 text-sm">尚無儲存的預測</p>
        ) : (
          <div className="space-y-3">
            {predictions.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center gap-2 rounded-2xl bg-slate-800/40 border border-slate-700/50 p-3"
              >
                {p.numbers.map((n) => (
                  <Ball key={n} n={n} size="sm" animate={false} />
                ))}
                <div className="mx-1 w-px h-8 bg-slate-700" />
                <Ball n={p.special_number} size="sm" special animate={false} />
                <span className="ml-auto text-xs text-slate-500">
                  {new Date(p.created_at).toLocaleString('zh-TW')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 backdrop-blur p-6">
        <h3 className="flex items-center gap-2 mb-4 font-semibold">
          <History className="w-5 h-5 text-blue-400" />
          歷史開獎紀錄
        </h3>
        <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
          {draws.map((d) => (
            <div
              key={d.id}
              className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-800/30 border border-slate-700/40 p-3"
            >
              <div className="flex flex-col mr-2 min-w-[64px]">
                <span className="text-xs text-slate-500">第 {d.draw_number} 期</span>
                <span className="text-[10px] text-slate-600">
                  {new Date(d.draw_date).toLocaleDateString('zh-TW')}
                </span>
              </div>
              {d.numbers.map((n) => (
                <Ball key={n} n={n} size="sm" animate={false} />
              ))}
              <div className="mx-1 w-px h-8 bg-slate-700" />
              <Ball n={d.special_number} size="sm" special animate={false} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="mt-10 pt-6 border-t border-slate-800/60">
      <p className="text-xs text-slate-600 leading-relaxed text-center text-balance">
        本工具僅供統計研究與娛樂用途,預測結果不保證中獎。六合彩開獎結果為隨機事件,
        任何預測方法皆無法確切預知開獎號碼。請理性投注,量力而為。
      </p>
    </footer>
  );
}
