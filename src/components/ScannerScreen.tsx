import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { fullScan, overallLevel, SAFETY_META, profileById, highlightText } from '@/lib/scanner';
import type { ScanResult, SafetyLevel, FullScanResult, IngredientFinding, ProfileId } from '@/lib/types';
import { FAMILY, PROFILE_ORDER } from '@/lib/family';
import { SAMPLE_LABELS } from '@/lib/sampleLabels';
import type { TesseractStatic } from '@/vite-env';

declare global {
  interface Window {
    Tesseract?: TesseractStatic;
  }
}

import {
  ShieldAlert, ShieldCheck, ShieldQuestion, ScanLine, Upload, X,
  AlertTriangle, FileText, History, Trash2, ChevronRight, Sparkles, Info,
  Search, ExternalLink, Image as ImageIcon, Loader2, Check,
} from 'lucide-react';

interface HistoryRow {
  id: string;
  label_text: string;
  label_name: string | null;
  overall: string;
  scanned_at: string;
}

type View = 'input' | 'results';

let tesseractPromise: Promise<TesseractStatic> | null = null;

function loadTesseract(): Promise<TesseractStatic> {
  if (tesseractPromise) return tesseractPromise;
  tesseractPromise = new Promise((resolve, reject) => {
    if (window.Tesseract) { resolve(window.Tesseract); return; }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js';
    script.async = true;
    script.onload = () => {
      if (window.Tesseract) resolve(window.Tesseract);
      else reject(new Error('Tesseract failed to initialize'));
    };
    script.onerror = () => reject(new Error('Failed to load OCR engine'));
    document.head.appendChild(script);
  });
  return tesseractPromise;
}

export function ScannerScreen() {
  const [foodName, setFoodName] = useState(''); // NEW: For the food search input
  const [input, setInput] = useState(''); // Keeps the actual ingredients text for the results view
  const [view, setView] = useState<View>('input');
  const [scan, setScan] = useState<FullScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);

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

  async function handleSearchAndScan() {
    if (!foodName.trim()) return;
    
    setScanning(true);
    setSearchError(null);
    
    try {
      // 1. Search for the food item's ingredients
      const res = await fetch(https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(foodName)}&search_simple=1&action=process&json=1);
      const data = await res.json();
      
      if (!data.products || data.products.length === 0) {
        throw new Error("Food item not found.");
      }

      // Extract ingredients from the top search result
      const product = data.products[0];
      const ingredients = product.ingredients_text_en || product.ingredients_text;
      
      if (!ingredients) {
        throw new Error("Ingredients not listed for this product.");
      }

      // 2. Set the found ingredients so your ResultsView can highlight them
      setInput(ingredients);
      setView('results');
      
      // 3. Run your existing family restriction check
      const result = fullScan(ingredients);
      setScan(result);

      // 4. Save to your Supabase history
      const { error } = await supabase.from('scan_history').insert({
        label_text: ingredients,
        label_name: product.product_name || foodName,
        overall: result.overall,
      });
      if (error) console.error(error);
      loadHistory();
      
    } catch (err: any) {
      console.error(err);
      setSearchError(err.message || "Could not fetch ingredients. Try another name.");
    } finally {
      setScanning(false);
    }
  }

  function guessLabelName(text: string): string {
    const line = text.split('\n')[0] || '';
    const match = line.match(/ingredients:\s*(.+)/i);
    if (match) return match[1].split(',')[0].slice(0, 40);
    return line.slice(0, 40) || 'Scanned label';
  }

  function handleClear() {
    setInput('');
    setScan(null);
    setView('input');
  }

  function loadSample(sample: string) {
    setInput(sample);
    setView('input');
    setScan(null);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type.startsWith('image/')) {
      await runOcr(file);
    } else {
      const text = await file.text();
      setInput(text.slice(0, 5000));
      setView('input');
      setScan(null);
    }
  }

  async function runOcr(file: File) {
    setOcrLoading(true);
    setOcrError(null);
    setView('input');
    try {
      const Tesseract = await loadTesseract();
      const worker = await Tesseract.createWorker('eng');
      const { data: { text } } = await worker.recognize(file);
      await worker.terminate();
      const cleaned = cleanOcrText(text);
      if (cleaned) {
        setInput(cleaned.slice(0, 5000));
        setScan(null);
      } else {
        setOcrError('No text was detected in the image. Try a clearer photo or paste the ingredients manually.');
      }
    } catch {
      setOcrError('Could not read the image. Please try again or paste the text manually.');
    } finally {
      setOcrLoading(false);
    }
  }

  function cleanOcrText(raw: string): string {
    return raw
      .replace(/[|~]/g, '')
      .replace(/\r/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\s*\n\s*/g, '\n')
      .replace(/\n{2,}/g, '\n')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .join('\n')
      .trim();
  }

  async function loadFromHistory(row: HistoryRow) {
    setInput(row.label_text);
    setShowHistory(false);
    setView('input');
    setScan(null);
  }

  async function deleteHistoryItem(id: string) {
    setHistory((prev) => prev.filter((r) => r.id !== id));
    const { error } = await supabase.from('scan_history').delete().eq('id', id);
    if (error) console.error(error);
  }

  const overall = scan?.overall ?? null;
  const meta = overall ? SAFETY_META[overall] : null;

  return (
    <div className="px-4 pb-24 pt-2">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-ink-900">Allergen & Label Scanner</h2>
          <p className="text-sm text-ink-500 mt-0.5">Check food ingredients against every family restriction list.</p>
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

      {/* History panel */}
      {showHistory && (
        <HistoryPanel
          history={history}
          onLoad={loadFromHistory}
          onDelete={deleteHistoryItem}
          onClose={() => setShowHistory(false)}
        />
      )}

      {!showHistory && view === 'input' && (
        <InputView
          foodName={foodName}
          setFoodName={setFoodName}
          scanning={scanning}
          searchError={searchError}
          onScan={handleSearchAndScan}
          onClear={handleClear}
          onUpload={handleUpload}
          fileRef={fileRef}
          imageRef={imageRef}
          onSample={loadSample}
        />
      )}

      {!showHistory && view === 'results' && (
        <ResultsView
          input={input}
          scan={scan}
          scanning={scanning}
          overall={overall}
          meta={meta}
          onBack={() => { setView('input'); setScan(null); }}
          onRescan={handleScan}
        />
      )}

    </div>
  );
}

/* ---------- Input view ---------- */

/* ---------- Input view ---------- */

function InputView({
  foodName, setFoodName, scanning, searchError, onScan, onClear
}: {
  foodName: string;
  setFoodName: (v: string) => void;
  scanning: boolean;
  searchError: string | null;
  onScan: () => void;
  onClear: () => void;
}) {
  return (
    <>
      {/* Input card */}
      <div className="rounded-3xl bg-white shadow-card p-4 animate-slide-up">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5 text-sm font-medium text-ink-700">
            <Search className="h-4 w-4 text-brand-500" />
            Search for a Food Item
          </div>
          {foodName && (
            <button onClick={() => { setFoodName(''); onClear(); }} className="text-xs text-ink-400 flex items-center gap-0.5 tap-scale">
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </div>

        <input
          type="text"
          value={foodName}
          onChange={(e) => setFoodName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onScan(); }}
          placeholder="e.g. Doritos Nacho Cheese, Heinz Ketchup"
          className="w-full rounded-2xl bg-ink-50 border border-ink-200 p-3 text-sm text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-transparent transition-all"
        />

        {/* Search error banner */}
        {searchError && (
          <div className="mt-2.5 flex items-start gap-2 rounded-2xl bg-amber-50 p-3 ring-1 ring-amber-200">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">{searchError}</p>
          </div>
        )}

        {/* Primary action button */}
        <div className="mt-3 flex gap-2">
          <button
            onClick={onScan}
            disabled={!foodName.trim() || scanning}
            className="tap-scale flex-1 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 py-3 text-sm font-semibold text-white shadow-card disabled:opacity-40 disabled:shadow-none transition-all"
          >
            {scanning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching & Scanning...
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                Search & Check Food
              </>
            )}
          </button>
        </div>
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

/* ---------- Product name search ---------- */

function ProductSearchPanel() {
  const [productName, setProductName] = useState('');
  const trimmed = productName.trim();

  function openIngredientSearch() {
    if (!trimmed) return;
    const query = encodeURIComponent(`${trimmed} ingredients`);
    window.open(`https://www.google.com/search?q=${query}`, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="mt-2.5 rounded-2xl bg-ink-50 p-3 animate-slide-up">
      <label htmlFor="product-name" className="text-xs font-medium text-ink-600">
        Product name
      </label>
      <input
        id="product-name"
        value={productName}
        onChange={(e) => setProductName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') openIngredientSearch(); }}
        placeholder="e.g. Heinz Tomato Ketchup"
        className="mt-1.5 w-full rounded-xl bg-white border border-ink-200 px-3 py-2 text-sm text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-transparent transition-all"
      />
      <button
        onClick={openIngredientSearch}
        disabled={!trimmed}
        className="tap-scale mt-2 w-full flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white disabled:opacity-40 transition-all"
      >
        <ExternalLink className="h-4 w-4" />
        Search ingredients on Google
      </button>
      <p className="mt-2 text-[11px] leading-relaxed text-ink-500">
        Google opens in a new tab. Copy the ingredient list from the results and paste it into the label box above.
      </p>
    </div>
  );
}

/* ---------- Results view ---------- */

function ResultsView({
  input, scan, scanning, overall, meta, onBack, onRescan,
}: {
  input: string;
  scan: FullScanResult | null;
  scanning: boolean;
  overall: SafetyLevel | null;
  meta: typeof SAFETY_META[SafetyLevel] | null;
  onBack: () => void;
  onRescan: () => void;
}) {
  if (scanning || !scan || !meta) {
    return (
      <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
        <div className="relative">
          <div className="h-16 w-16 rounded-full border-4 border-ink-200" />
          <div className="absolute inset-0 h-16 w-16 rounded-full border-4 border-transparent border-t-brand-500 animate-spin" />
          <ScanLine className="absolute inset-0 m-auto h-6 w-6 text-brand-500" />
        </div>
        <p className="mt-4 text-sm font-medium text-ink-500">Analyzing label against family profiles...</p>
      </div>
    );
  }

  return (
    <div className="animate-tab-slide">
      <button onClick={onBack} className="tap-scale mb-3 flex items-center gap-1 text-sm font-medium text-brand-600">
        <ChevronRight className="h-4 w-4 rotate-180" />
        Back to input
      </button>

      {/* Overall banner */}
      <div className={`rounded-3xl p-4 animate-slide-up ${meta.bg} ring-1 ${meta.ring}`}>
        <div className="flex items-center gap-3">
          <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${meta.text} bg-white/60`}>
            {overall === 'safe' ? <ShieldCheck className="h-6 w-6" /> : overall === 'caution' ? <ShieldQuestion className="h-6 w-6" /> : <ShieldAlert className="h-6 w-6" />}
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-ink-800">
              {overall === 'safe' ? 'All Clear' : overall === 'caution' ? 'Proceed with Caution' : 'Safety Risk Detected'}
            </p>
            <p className="text-xs text-ink-600 mt-0.5">
              {overall === 'safe'
                ? 'No flagged allergens for any family member.'
                : overall === 'caution'
                ? 'Some profiles need attention — review below.'
                : 'Not safe for one or more family members.'}
            </p>
          </div>
        </div>
      </div>

      {/* Highlighted text */}
      <HighlightedText text={input} findings={scan.findings} />

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
        onClick={onRescan}
        className="tap-scale mt-4 w-full flex items-center justify-center gap-2 rounded-2xl bg-ink-100 py-3 text-sm font-medium text-ink-600 transition-all"
      >
        <ScanLine className="h-4 w-4" />
        Re-scan
      </button>
    </div>
  );
}

/* ---------- Highlighted text ---------- */

function HighlightedText({ text, findings }: { text: string; findings: IngredientFinding[] }) {
  const segments = highlightText(text, findings);
  return (
    <div className="mt-3 rounded-3xl bg-white shadow-card p-4 animate-slide-up">
      <p className="text-xs font-medium text-ink-400 uppercase tracking-wide mb-2">Scanned Label</p>
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
          <p className="text-xs text-ink-300 mt-0.5">Your past label scans will appear here.</p>
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
