export type SafetyLevel = 'safe' | 'caution' | 'danger';

export type ProfileId = 'mom' | 'son' | 'grandma';

export type DietTag = 'keto' | 'low-sodium' | 'diabetic' | 'nut-free' | 'peanut-free';

export interface FamilyProfile {
  id: ProfileId;
  name: string;
  role: string;
  emoji: string;
  color: string;
  gradient: string;
  diet: string;
  dietTags: DietTag[];
  allergens: string[];
  restrictions: string[];
  dailySodiumMg: number;
  dailyCarbG: number;
  notes: string;
}

export interface ScanResult {
  profileId: ProfileId;
  level: SafetyLevel;
  title: string;
  details: string[];
}

export interface IngredientFinding {
  term: string;
  category: string;
  level: SafetyLevel;
  affectedProfiles: ProfileId[];
  description: string;
}

export interface FullScanResult {
  results: ScanResult[];
  findings: IngredientFinding[];
  overall: SafetyLevel;
}

export interface CareTask {
  key: string;
  profileId: ProfileId;
  label: string;
  dosage: string;
  time: string;
  category: 'medication' | 'routine';
  icon: string;
}

export interface PlatingInstruction {
  profileId: ProfileId;
  note: string;
  swaps: string[];
  portion: string;
}

export interface Recipe {
  id: string;
  title: string;
  emoji: string;
  time: string;
  servings: number;
  calories: number;
  baseIngredients: string[];
  instructions: string[];
  plating: PlatingInstruction[];
}
