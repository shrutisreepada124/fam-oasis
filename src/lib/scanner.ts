import type { FamilyProfile, ScanResult, SafetyLevel, ProfileId, IngredientFinding, FullScanResult } from './types';
import { FAMILY } from './family';

// Synonym map — each canonical allergen maps to a list of substrings that count as a hit.
const PEANUT_SYNONYMS = [
  'peanut', 'peanuts', 'peanut oil', 'groundnut', 'ground nut', 'arachis',
  'mandelona', 'monkey nut', 'earth nut',
];

const TREE_NUT_SYNONYMS = [
  'almond', 'almonds', 'brazil nut', 'cashew', 'cashews', 'chestnut',
  'hazelnut', 'filbert', 'macadamia', 'pecan', 'pistachio', 'walnut',
  'pine nut', 'shea nut',
];

const NUT_OILS = ['peanut oil', 'groundnut oil', 'walnut oil', 'almond oil', 'cashew oil'];

const MAY_CONTAIN = [
  'may contain', 'processed in a facility', 'made on equipment', 'manufactured in a facility',
  'cross-contact', 'cross contamination', 'may contain traces',
];

const SUGAR_TERMS = ['sugar', 'sucrose', 'glucose', 'corn syrup', 'high fructose', 'fructose', 'maltodextrin', 'agave', 'maple syrup', 'cane sugar', 'honey', 'brown rice syrup'];
const CARB_TERMS = ['wheat flour', 'rice flour', 'oat flour', 'starch', 'potato starch', 'cornstarch', 'breadcrumbs', 'bread crumbs', 'pasta', 'couscous', 'quinoa', 'rice'];

function normalize(text: string): string {
  return text.toLowerCase();
}

function findMatches(text: string, terms: string[]): string[] {
  const lower = normalize(text);
  return terms.filter((t) => lower.includes(t));
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function scanProfile(text: string, profile: FamilyProfile): ScanResult {
  const lower = normalize(text);
  const details: string[] = [];

  let level: SafetyLevel = 'safe';
  let title = 'Safe for this profile';

  if (profile.id === 'son') {
    const peanutHits = findMatches(text, PEANUT_SYNONYMS);
    const treeNutHits = findMatches(text, TREE_NUT_SYNONYMS);
    const oilHits = findMatches(text, NUT_OILS);
    const ccHits = findMatches(text, MAY_CONTAIN);

    if (peanutHits.length > 0 || oilHits.filter((o) => o.includes('peanut') || o.includes('groundnut')).length > 0) {
      level = 'danger';
      title = 'Severe allergy — avoid';
      details.push(`Contains peanut: ${peanutHits.map(cap).join(', ')}`);
    } else if (treeNutHits.length > 0) {
      level = 'danger';
      title = 'Tree nuts detected — avoid';
      details.push(`Contains tree nuts: ${treeNutHits.map(cap).join(', ')}`);
    } else if (oilHits.length > 0) {
      level = 'caution';
      title = 'Nut oil present — verify';
      details.push(`Contains nut oil: ${oilHits.map(cap).join(', ')}`);
    }

    if (ccHits.length > 0) {
      if (level === 'safe') {
        level = 'caution';
        title = 'Cross-contact risk — caution';
      }
      details.push(`Label warns: "${ccHits[0]}..."`);
    }
  }

  if (profile.id === 'mom') {
    const sugarHits = findMatches(text, SUGAR_TERMS);
    const carbHits = findMatches(text, CARB_TERMS);

    if (sugarHits.length > 0) {
      level = level === 'safe' ? 'caution' : level;
      if (level === 'caution' && title === 'Safe for this profile') {
        title = 'Carbs / sugar present — moderate';
      }
      details.push(`Sugars/carbs: ${sugarHits.map(cap).join(', ')}`);
    }
    if (carbHits.length > 0) {
      level = level === 'safe' ? 'caution' : level;
      if (title === 'Safe for this profile') {
        title = 'Carbs present — moderate';
      }
      details.push(`High-carb ingredients: ${carbHits.map(cap).join(', ')}`);
    }
  }

  if (profile.id === 'grandma') {
    const sodiumMatch = lower.match(/sodium\s+(\d[\d,]*)\s*(?:mg|milligram)/);
    const sodiumValue = sodiumMatch ? parseInt(sodiumMatch[1].replace(/,/g, ''), 10) : null;

    if (sodiumValue !== null && sodiumValue > 480) {
      level = sodiumValue > 1000 ? 'danger' : 'caution';
      title = sodiumValue > 1000 ? 'High sodium — avoid' : 'Moderate sodium — caution';
      details.push(`Sodium: ${sodiumValue} mg per serving`);
    }

    const sugarHits = findMatches(text, SUGAR_TERMS);
    if (sugarHits.length > 0) {
      const sugarMatch = lower.match(/sugars?\s+(\d[\d,]*)\s*g/);
      const sugarG = sugarMatch ? parseInt(sugarMatch[1].replace(/,/g, ''), 10) : null;
      if (sugarG !== null && sugarG > 8) {
        level = level === 'danger' ? level : 'caution';
        title = level === 'danger' ? title : 'High sugar — caution';
        details.push(`Sugar: ${sugarG} g per serving`);
      } else if (sugarG === null) {
        level = level === 'safe' ? 'caution' : level;
        details.push('Contains added sugars');
      }
    }

    const ccHits = findMatches(text, MAY_CONTAIN);
    if (ccHits.length > 0 && level === 'safe') {
      level = 'caution';
      title = 'Cross-contact risk';
      details.push(`Label warns: "${ccHits[0]}..."`);
    }
  }

  if (level === 'safe' && details.length === 0) {
    details.push('No flagged allergens or restrictions detected.');
  }

  return { profileId: profile.id, level, title, details };
}

// Build ingredient-level findings by scanning every known term category
// across the text, then mapping each hit to the family profiles it affects.
function buildFindings(text: string): IngredientFinding[] {
  const lower = normalize(text);
  const findings: IngredientFinding[] = [];

  function add(term: string, category: string, level: SafetyLevel, profiles: ProfileId[], description: string) {
    findings.push({ term: cap(term), category, level, affectedProfiles: profiles, description });
  }

  const peanutHits = findMatches(text, PEANUT_SYNONYMS);
  peanutHits.forEach((t) => add(t, 'Peanut allergen', 'danger', ['son'], 'Severe peanut allergy — strictly avoid'));

  const treeNutHits = findMatches(text, TREE_NUT_SYNONYMS).filter((t) => !peanutHits.includes(t));
  treeNutHits.forEach((t) => add(t, 'Tree nut allergen', 'danger', ['son'], 'Tree nut allergy — strictly avoid'));

  const oilHits = findMatches(text, NUT_OILS).filter((t) => !peanutHits.includes(t) && !treeNutHits.includes(t));
  oilHits.forEach((t) => add(t, 'Nut oil', 'caution', ['son'], 'Nut-derived oil — verify source before use'));

  const ccHits = findMatches(text, MAY_CONTAIN);
  ccHits.forEach((t) => add(t, 'Cross-contact warning', 'caution', ['son', 'grandma'], 'Label warns of possible cross-contamination'));

  const sugarHits = findMatches(text, SUGAR_TERMS).filter((t) => !oilHits.includes(t));
  sugarHits.forEach((t) => {
    add(t, 'Added sugar', 'caution', ['mom', 'grandma'], 'Sugar/sweetener — breaks keto & diabetic limits');
  });

  const carbHits = findMatches(text, CARB_TERMS).filter((t) => !sugarHits.includes(t));
  carbHits.forEach((t) => {
    add(t, 'High-carb ingredient', 'caution', ['mom'], 'Refined carb — conflicts with keto macros');
  });

  // Sodium numeric value
  const sodiumMatch = lower.match(/sodium\s+(\d[\d,]*)\s*(?:mg|milligram)/);
  if (sodiumMatch) {
    const val = parseInt(sodiumMatch[1].replace(/,/g, ''), 10);
    if (val > 1000) {
      add(`Sodium ${val}mg`, 'High sodium', 'danger', ['grandma'], `${val}mg per serving exceeds low-sodium limit`);
    } else if (val > 480) {
      add(`Sodium ${val}mg`, 'Moderate sodium', 'caution', ['grandma'], `${val}mg per serving — moderate, monitor intake`);
    }
  }

  // Sugar grams numeric
  const sugarGMatch = lower.match(/sugars?\s+(\d[\d,]*)\s*g/);
  if (sugarGMatch) {
    const val = parseInt(sugarGMatch[1].replace(/,/g, ''), 10);
    if (val > 8) {
      add(`Sugar ${val}g`, 'High sugar', 'caution', ['grandma'], `${val}g per serving — high for diabetic diet`);
    }
  }

  return findings;
}

export function scanLabel(text: string): ScanResult[] {
  if (!text.trim()) return [];
  return Object.values(FAMILY).map((p) => scanProfile(text, p));
}

export function fullScan(text: string): FullScanResult {
  const results = scanLabel(text);
  const findings = buildFindings(text);
  const overall = overallLevel(results);
  return { results, findings, overall };
}

export function overallLevel(results: ScanResult[]): SafetyLevel {
  if (results.some((r) => r.level === 'danger')) return 'danger';
  if (results.some((r) => r.level === 'caution')) return 'caution';
  return 'safe';
}

export const SAFETY_META: Record<SafetyLevel, { label: string; color: string; bg: string; text: string; ring: string; dot: string; softBg: string }> = {
  safe: {
    label: 'Safe',
    color: '#10b981',
    bg: 'bg-emerald-50',
    softBg: 'bg-emerald-100',
    text: 'text-emerald-700',
    ring: 'ring-emerald-200',
    dot: 'bg-emerald-500',
  },
  caution: {
    label: 'Caution',
    color: '#f59e0b',
    bg: 'bg-amber-50',
    softBg: 'bg-amber-100',
    text: 'text-amber-700',
    ring: 'ring-amber-200',
    dot: 'bg-amber-500',
  },
  danger: {
    label: 'Danger',
    color: '#ef4444',
    bg: 'bg-red-50',
    softBg: 'bg-red-100',
    text: 'text-red-700',
    ring: 'ring-red-200',
    dot: 'bg-red-500',
  },
};

export function profileById(id: ProfileId): FamilyProfile {
  return FAMILY[id];
}

// Build highlighted text segments so the UI can render flagged terms inline.
export interface TextSegment {
  text: string;
  level: SafetyLevel | null;
  finding?: IngredientFinding;
}

export function highlightText(text: string, findings: IngredientFinding[]): TextSegment[] {
  if (findings.length === 0) return [{ text, level: null }];

  // Collect all match positions
  const lower = normalize(text);
  const marks: { start: number; end: number; level: SafetyLevel; finding: IngredientFinding }[] = [];

  findings.forEach((f) => {
    const term = f.term.toLowerCase();
    let idx = lower.indexOf(term);
    while (idx !== -1) {
      // skip if already covered by a stronger mark
      const overlap = marks.some((m) => idx < m.end && idx + term.length > m.start);
      if (!overlap) {
        marks.push({ start: idx, end: idx + term.length, level: f.level, finding: f });
      }
      idx = lower.indexOf(term, idx + term.length);
    }
  });

  marks.sort((a, b) => a.start - b.start);

  const segments: TextSegment[] = [];
  let cursor = 0;
  for (const m of marks) {
    if (m.start > cursor) {
      segments.push({ text: text.slice(cursor, m.start), level: null });
    }
    segments.push({ text: text.slice(m.start, m.end), level: m.level, finding: m.finding });
    cursor = m.end;
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), level: null });
  }

  return segments;
}
