import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { fullScan, overallLevel, SAFETY_META, profileById, highlightText } from '@/lib/scanner';
import type { ScanResult, SafetyLevel, FullScanResult, IngredientFinding } from '@/lib/types';
import { FAMILY, PROFILE_ORDER } from '@/lib/family';
import { ShieldAlert, ShieldCheck, ShieldQuestion, ScanLine, TriangleAlert as AlertTriangle, History, Trash2, ChevronRight, Info, Search, X, Loader as Loader2, Package, CreditCard as Edit3 } from 'lucide-react';

interface HistoryRow {
  id: string;
  label_text: string;
  label_name: string | null;
  overall: string;
  scanned_at: string;
}

interface SearchResult {
  productName: string;
  ingredients: string;
  brand: string | null;
  imageUrl: string | null;
}

type View = 'search' | 'results' | 'manual';

export function ScannerScreen() {
  const [foodName, setFoodName] = useState('');
  const [view, setView] = useState<View>('search');
  const [scan, setScan] = useState<FullScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [productInfo, setProductInfo] = useState<SearchResult | null>(null);
  const [manualText, setManualText] = useState('');
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const loadHistory = useCallback(async () => {
    const { data, error } = await supabase
      .from('scan_history')
      .select('id, label_text, label_name, overall, scanned_at')
      .order('scanned_at', { ascending: false })
      .limit(20);
    if (error) { console.error(error); return; }
    setHistory((data ?? []) as HistoryRow[]);
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  async function handleSearch() {
    const query = foodName.trim();
    if (!query) return;

    setScanning(true);
    setSearchError(null);
    setScan(null);

    try {
      const res = await fetch(
        `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&fields=product_name,brands,image_url,ingredients_text_en,ingredients_text`
      );
      if (!res.ok) throw new Error('Could not reach the food database.');
      const data = await res.json();

      if (!data.products || data.products.length === 0) {
        throw new Error('No matching product found. Try a different name or enter ingredients manually.');
      }

      const product = data.products[0];
      const ingredients = product.ingredients_text_en || product.ingredients_text || '';

      if (!ingredients.trim()) {
        throw new Error('Ingredients not listed for this product. Try another result or enter them manually.');
      }

      const result = fullScan(ingredients);
      setScan(result);
      setProductInfo({
        productName: product.product_name || query,
        ingredients,
        brand: product.brands || null,
        imageUrl: product.image_url || null,
      });
      setView('results');

      const { error } = await supabase.from('scan_history').insert({
        label_text: ingredients,
        label_name: product.product_name || query,
        overall: result.overall,
      });
      if (error) console.error(error);
      loadHistory();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not fetch ingredients. Try another name.';
      setSearchError(msg);
    } finally {
      setScanning(false);
    }
  }

  async function handleManualScan() {
    const text = manualText.trim();
    if (!text) return;

    setScanning(true);
    setSearchError(null);

    try {
      const result = fullScan(text);
      setScan(result);
      setProductInfo({
        productName: 'Manually entered',
        ingredients: text,
        brand: null,
        imageUrl: null,
      });
      setView('results');

      const { error } = await supabase.from('scan_history').insert({
        label_text: text,
        label_name: 'Manually entered',
        overall: result.overall,
      });
      if (error) console.error(error);
      loadHistory();
    } finally {
      setScanning(false);
    }
  }

  function handleReset() {
    setView('search');
    setScan(null);
    setProductInfo(null);
    setSearchError(null);
    setManualText('');
  }

  async function loadFromHistory(row: HistoryRow) {
    const result = fullScan(row.label_text);
    setScan(result);
    setProductInfo({
      productName: row.label_name || 'Scanned label',
      ingredients: row.label_text,
      brand: null,
      imageUrl: null,
    });
    setShowHistory(false);
    setView('results');
  }

  async function deleteHistoryItem(id: string) {
    setHistory((prev) => prev.filter((r) => r.id !== id));
    const { error } = await supabase.from('scan_history').delete().eq('id', id);
    if (error) console.error(error);
  }

  return (
    <div className="px-4 pb-24 pt-2">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-ink-900">Allergen & Label Scanner</h2>
          <p className="text-sm text-ink-500 mt-0.5">Search any food item and check it against every family member.</p>
        </div>
        <button
          onClick={() => setShowHistory((v) => !v)}
          className={`tap-scale flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium transition-all ${
            showHistory ? 'bg-brand-500 text-white shadow-card' : 'bg-white text-ink-500 shadow-pill'
          }`}
        >
          <History className="h-3.5 w-3.5" />
          History
        </button>
      </div>

      {showHistory && (
        <HistoryPanel
          history={history}
          onLoad={loadFromHistory}
          onDelete={deleteHistoryItem}
          onClose={() => setShowHistory(false)}
        />
      )}

      {!showHistory && view === 'search' && (
        <SearchView
          foodName={foodName}
          setFoodName={setFoodName}
          scanning={scanning}
          searchError={searchError}
          onSearch={handleSearch}
          onManualEnter={() => { setView('manual'); setSearchError(null); }}
        />
      )}

      {!showHistory && view === 'manual' && (
        <ManualEntryView
          manualText={manualText}
          setManualText={setManualText}
          scanning={scanning}
          onScan={handleManualScan}
          onBack={() => { setView('search'); setSearchError(null); }}
        />
      )}

      {!showHistory && view === 'results' && scan && productInfo && (
        <ResultsView
          productInfo={productInfo}
          scan={scan}
          onBack={handleReset}
        />
      )}
    </div>
  );
}

/* ---------- Search view ---------- */

function SearchView({
  foodName, setFoodName, scanning, searchError, onSearch, onManualEnter,
}: {
  foodName: string;
  setFoodName: (v: string) => void;
  scanning: boolean;
  searchError: string | null;
  onSearch: () => void;
  onManualEnter: () => void;
}) {
  return (
    <>
      <div className="rounded-3xl bg-white shadow-card p-4 animate-slide-up">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5 text-sm font-medium text-ink-700">
            <Search className="h-4 w-4 text-brand-500" />
            Search for a Food Item
          </div>
          {foodName && (
            <button onClick={() => setFoodName('')} className="text-xs text-ink-400 flex items-center gap-0.5 tap-scale">
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </div>

        <input
          type="text"
          value={foodName}
          onChange={(e) => setFoodName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !scanning) onSearch(); }}
          placeholder="e.g. Doritos Nacho Cheese, Heinz Ketchup"
          className="w-full rounded-2xl bg-ink-50 border border-ink-200 p-3 text-sm text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-transparent transition-all"
        />

        {searchError && (
          <div className="mt-2.5 flex items-start gap-2 rounded-2xl bg-amber-50 p-3 ring-1 ring-amber-200">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">{searchError}</p>
          </div>
        )}

        <button
          onClick={onSearch}
          disabled={!foodName.trim() || scanning}
          className="tap-scale mt-3 w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 py-3 text-sm font-semibold text-white shadow-card disabled:opacity-40 disabled:shadow-none transition-all"
        >
          {scanning ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching & Analyzing...
            </>
          ) : (
            <>
              <Search className="h-4 w-4" />
              Search & Check Food
            </>
          )}
        </button>

        <button
          onClick={onManualEnter}
          className="tap-scale mt-2 w-full flex items-center justify-center gap-1.5 rounded-2xl bg-ink-100 py-2.5 text-xs font-medium text-ink-500 transition-all"
        >
          <Edit3 className="h-3.5 w-3.5" />
          Enter ingredients manually instead
        </button>
      </div>

      {/* Family restriction reference */}
      <div className="mt-3 rounded-3xl bg-white shadow-card p-4 animate-slide-up">
        <p className="text-xs font-medium text-ink-400 uppercase tracking-wide mb-2.5">Scanning against</p>
        <div className="space-y-2.5">
          {PROFILE_ORDER.map((id) => {
            const p = FAMILY[id];
            return (
              <div key={id} className="flex items-start gap-2.5">
                <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm bg-gradient-to-br ${p.gradient} text-white shrink-0`}>
                  {p.emoji}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink-800">{p.name}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {p.allergens.length > 0 && p.allergens.slice(0, 3).map((a, i) => (
                      <span key={i} className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-600">
                        {a}
                      </span>
                    ))}
                    {p.restrictions.map((r, i) => (
                      <span key={i} className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-medium text-ink-500">
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

/* ---------- Manual entry view ---------- */

function ManualEntryView({
  manualText, setManualText, scanning, onScan, onBack,
}: {
  manualText: string;
  setManualText: (v: string) => void;
  scanning: boolean;
  onScan: () => void;
  onBack: () => void;
}) {
  return (
    <div className="animate-tab-slide">
      <button onClick={onBack} className="tap-scale mb-3 flex items-center gap-1 text-sm font-medium text-brand-600">
        <ChevronRight className="h-4 w-4 rotate-180" />
        Back to search
      </button>

      <div className="rounded-3xl bg-white shadow-card p-4 animate-slide-up">
        <div className="flex items-center gap-1.5 text-sm font-medium text-ink-700 mb-2.5">
          <Edit3 className="h-4 w-4 text-brand-500" />
          Paste Ingredient List
        </div>
        <textarea
          value={manualText}
          onChange={(e) => setManualText(e.target.value.slice(0, 5000))}
          placeholder="Paste the full ingredients list here, e.g.&#10;INGREDIENTS: Enriched flour, sugar, cocoa, salt..."
          rows={8}
          className="w-full rounded-2xl bg-ink-50 border border-ink-200 p-3 text-sm text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-transparent transition-all resize-none"
        />
        <button
          onClick={onScan}
          disabled={!manualText.trim() || scanning}
          className="tap-scale mt-3 w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 py-3 text-sm font-semibold text-white shadow-card disabled:opacity-40 disabled:shadow-none transition-all"
        >
          {scanning ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <ScanLine className="h-4 w-4" />
              Check Ingredients
            </>
          )}
        </button>
      </div>
    </div>
  );
}

/* ---------- Results view ---------- */

function ResultsView({
  productInfo, scan, onBack,
}: {
  productInfo: SearchResult;
  scan: FullScanResult;
  onBack: () => void;
}) {
  const meta = SAFETY_META[scan.overall];

  return (
    <div className="animate-tab-slide">
      <button onClick={onBack} className="tap-scale mb-3 flex items-center gap-1 text-sm font-medium text-brand-600">
        <ChevronRight className="h-4 w-4 rotate-180" />
        New search
      </button>

      {/* Product header */}
      <div className="rounded-3xl bg-white shadow-card p-4 animate-slide-up">
        <div className="flex items-start gap-3">
          {productInfo.imageUrl ? (
            <img
              src={productInfo.imageUrl}
              alt={productInfo.productName}
              className="h-16 w-16 rounded-2xl object-cover shrink-0 bg-ink-100"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-ink-50 to-ink-100 shrink-0">
              <Package className="h-7 w-7 text-ink-400" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-ink-900 leading-tight">{productInfo.productName}</p>
            {productInfo.brand && (
              <p className="text-xs text-ink-500 mt-0.5">{productInfo.brand}</p>
            )}
          </div>
        </div>
      </div>

      {/* Overall banner */}
      <div className={`mt-3 rounded-3xl p-4 animate-slide-up ${meta.bg} ring-1 ${meta.ring}`}>
        <div className="flex items-center gap-3">
          <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${meta.text} bg-white/60`}>
            {scan.overall === 'safe' ? <ShieldCheck className="h-6 w-6" /> : scan.overall === 'caution' ? <ShieldQuestion className="h-6 w-6" /> : <ShieldAlert className="h-6 w-6" />}
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-ink-800">
              {scan.overall === 'safe' ? 'All Clear' : scan.overall === 'caution' ? 'Proceed with Caution' : 'Safety Risk Detected'}
            </p>
            <p className="text-xs text-ink-600 mt-0.5">
              {scan.overall === 'safe'
                ? 'No flagged allergens for any family member.'
                : scan.overall === 'caution'
                ? 'Some profiles need attention — review below.'
                : 'Not safe for one or more family members.'}
            </p>
          </div>
        </div>
      </div>

      {/* Highlighted ingredient text */}
      <HighlightedText text={productInfo.ingredients} findings={scan.findings} />

      {/* Ingredient breakdown */}
      {scan.findings.length > 0 && (
        <div className="mt-3 animate-slide-up">
          <p className="text-xs font-medium text-ink-400 uppercase tracking-wide mb-2">Flagged Ingredients</p>
          <div className="space-y-2">
            {scan.findings.map((f, i) => (
              <FindingCard key={i} finding={f} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* Per-profile results */}
      <div className="mt-3">
        <p className="text-xs font-medium text-ink-400 uppercase tracking-wide mb-2">Per-Family Verdict</p>
        <div className="space-y-2.5">
          {scan.results.map((r, i) => (
            <ProfileResultCard key={r.profileId} result={r} index={i} />
          ))}
        </div>
      </div>

      <button
        onClick={onBack}
        className="tap-scale mt-4 w-full flex items-center justify-center gap-2 rounded-2xl bg-ink-100 py-3 text-sm font-medium text-ink-600 transition-all"
      >
        <Search className="h-4 w-4" />
        Search another food
      </button>
    </div>
  );
}

/* ---------- Highlighted text ---------- */

function HighlightedText({ text, findings }: { text: string; findings: IngredientFinding[] }) {
  const segments = highlightText(text, findings);
  return (
    <div className="mt-3 rounded-3xl bg-white shadow-card p-4 animate-slide-up">
      <p className="text-xs font-medium text-ink-400 uppercase tracking-wide mb-2">Ingredient List</p>
      <div className="rounded-2xl bg-ink-50 p-3 text-sm leading-relaxed text-ink-600 whitespace-pre-wrap break-words max-h-48 overflow-y-auto no-scrollbar">
        {segments.map((seg, i) => {
          if (seg.level === null) return <span key={i}>{seg.text}</span>;
          const levelMeta = SAFETY_META[seg.level];
          return (
            <mark
              key={i}
              className={`rounded px-0.5 py-0.5 font-medium ${levelMeta.softBg} ${levelMeta.text}`}
            >
              {seg.text}
            </mark>
          );
        })}
      </div>
      {findings.length === 0 && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600">
          <ShieldCheck className="h-3.5 w-3.5" />
          No flagged ingredients detected.
        </div>
      )}
    </div>
  );
}

/* ---------- Finding card ---------- */

function FindingCard({ finding, index }: { finding: IngredientFinding; index: number }) {
  const meta = SAFETY_META[finding.level];
  const Icon = finding.level === 'safe' ? ShieldCheck : finding.level === 'caution' ? AlertTriangle : ShieldAlert;
  return (
    <div
      className="rounded-2xl bg-white shadow-card p-3 animate-slide-up"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex items-start gap-2.5">
        <div className={`flex h-8 w-8 items-center justify-center rounded-xl shrink-0 ${meta.softBg}`}>
          <Icon className={`h-4 w-4 ${meta.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-ink-800">{finding.term}</p>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.softBg} ${meta.text}`}>
              {meta.label}
            </span>
          </div>
          <p className="text-[11px] text-ink-500 mt-0.5">{finding.description}</p>
          <div className="mt-1.5 flex items-center gap-1">
            <span className="text-[10px] text-ink-400">Affects:</span>
            {finding.affectedProfiles.map((id) => {
              const p = profileById(id);
              return (
                <span key={id} className="flex items-center gap-0.5 rounded-full bg-ink-100 px-1.5 py-0.5 text-[10px] font-medium text-ink-600">
                  {p.emoji} {p.name}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Profile result card ---------- */

function ProfileResultCard({ result, index }: { result: ScanResult; index: number }) {
  const profile = profileById(result.profileId);
  const meta = SAFETY_META[result.level];
  const Icon = result.level === 'safe' ? ShieldCheck : result.level === 'caution' ? AlertTriangle : ShieldAlert;
  return (
    <div
      className="rounded-3xl bg-white shadow-card overflow-hidden animate-slide-up"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className={`flex items-center gap-3 p-4 ${meta.bg}`}>
        <span className="text-2xl">{profile.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-ink-800">{profile.name}</p>
          <p className="text-[11px] text-ink-500">{profile.diet}</p>
        </div>
        <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 ${meta.text} bg-white/70`}>
          <Icon className="h-3.5 w-3.5" />
          <span className="text-xs font-semibold">{meta.label}</span>
        </div>
      </div>
      <div className="px-4 py-3">
        <p className={`text-sm font-semibold ${meta.text}`}>{result.title}</p>
        <ul className="mt-1.5 space-y-1">
          {result.details.map((d, i) => (
            <li key={i} className="text-xs text-ink-500 flex items-start gap-1.5">
              <span className={`mt-1 h-1 w-1 rounded-full ${meta.dot} shrink-0`} />
              {d}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ---------- History panel ---------- */

function HistoryPanel({
  history, onLoad, onDelete, onClose,
}: {
  history: HistoryRow[];
  onLoad: (row: HistoryRow) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="animate-slide-up">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-ink-400 uppercase tracking-wide">Scan History</p>
        <button onClick={onClose} className="text-xs text-ink-400 flex items-center gap-0.5 tap-scale">
          <X className="h-3 w-3" /> Close
        </button>
      </div>
      {history.length === 0 ? (
        <div className="rounded-3xl bg-white shadow-card p-8 text-center">
          <History className="h-8 w-8 text-ink-300 mx-auto mb-2" />
          <p className="text-sm text-ink-400">No scans yet</p>
          <p className="text-xs text-ink-300 mt-0.5">Your past food searches will appear here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {history.map((row) => {
            const level = row.overall as SafetyLevel;
            const meta = SAFETY_META[level];
            const Icon = level === 'safe' ? ShieldCheck : level === 'caution' ? AlertTriangle : ShieldAlert;
            const date = new Date(row.scanned_at);
            const timeStr = date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
            return (
              <div key={row.id} className="rounded-2xl bg-white shadow-card p-3 flex items-center gap-3 animate-slide-up">
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl shrink-0 ${meta.softBg}`}>
                  <Icon className={`h-4 w-4 ${meta.text}`} />
                </div>
                <button onClick={() => onLoad(row)} className="flex-1 text-left min-w-0 tap-scale">
                  <p className="text-sm font-medium text-ink-800 truncate">{row.label_name ?? 'Scanned label'}</p>
                  <p className="text-[11px] text-ink-400 mt-0.5 flex items-center gap-1">
                    <Info className="h-3 w-3" /> {meta.label} · {timeStr}
                  </p>
                </button>
                <button
                  onClick={() => onDelete(row.id)}
                  className="tap-scale flex h-8 w-8 items-center justify-center rounded-lg text-ink-300 hover:text-red-500 hover:bg-red-50 transition-all shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
