import { useState } from 'react';
import { RECIPES } from '@/lib/recipes';
import { FAMILY, PROFILE_ORDER } from '@/lib/family';
import { SAFETY_META, profileById } from '@/lib/scanner';
import type { Recipe, ProfileId, SafetyLevel } from '@/lib/types';
import { Clock, Flame, ChefHat, Users, ChevronDown, ChevronRight, Check } from 'lucide-react';

function recipeSafety(recipe: Recipe, profileId: ProfileId): SafetyLevel {
  const plate = recipe.plating.find((p) => p.profileId === profileId);
  const profile = FAMILY[profileId];
  // Heuristic: if recipe base contains allergen-relevant terms, flag caution/danger
  const baseText = recipe.baseIngredients.join(' ').toLowerCase();
  let level: SafetyLevel = 'safe';

  if (profileId === 'son') {
    const nutTerms = ['peanut', 'almond', 'cashew', 'walnut', 'pecan', 'pistachio', 'hazelnut', 'tree nut', 'nut oil', 'almond flour'];
    if (nutTerms.some((t) => baseText.includes(t))) {
      level = 'danger';
    }
  }
  if (profileId === 'mom') {
    const carbTerms = ['quinoa', 'rice', 'pasta', 'flour', 'potato', 'sugar', 'honey', 'syrup'];
    if (carbTerms.some((t) => baseText.includes(t))) {
      level = level === 'danger' ? level : 'caution';
    }
  }
  if (profileId === 'grandma') {
    if (baseText.includes('soy sauce') || baseText.includes('salt') || baseText.includes('sodium')) {
      level = level === 'danger' ? level : 'caution';
    }
    const sugarTerms = ['sugar', 'honey', 'syrup', 'agave'];
    if (sugarTerms.some((t) => baseText.includes(t))) {
      level = level === 'danger' ? level : 'caution';
    }
  }
  return level;
}

export function MealPlannerScreen() {
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [expandedProfile, setExpandedProfile] = useState<ProfileId | null>(null);

  return (
    <div className="px-4 pb-24 pt-2">
      <div className="mb-3">
        <h2 className="text-xl font-bold text-ink-900">Meal Planner</h2>
        <p className="text-sm text-ink-500 mt-0.5">Unified recipes with custom plating for each family member.</p>
      </div>

      {!selectedRecipe ? (
        <div className="space-y-3">
          {RECIPES.map((r, i) => {
            const safeCount = PROFILE_ORDER.filter((id) => recipeSafety(r, id) === 'safe').length;
            const totalCount = PROFILE_ORDER.length;
            return (
              <button
                key={r.id}
                onClick={() => setSelectedRecipe(r)}
                className="tap-scale w-full text-left rounded-3xl bg-white shadow-card p-4 animate-slide-up hover:shadow-card-lg transition-all"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-ink-50 to-ink-100 text-3xl shrink-0">
                    {r.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-bold text-ink-900">{r.title}</p>
                    <div className="mt-1 flex items-center gap-3 text-xs text-ink-500">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{r.time}</span>
                      <span className="flex items-center gap-1"><Flame className="h-3 w-3" />{r.calories} cal</span>
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" />{r.servings} servings</span>
                    </div>
                    {/* Profile safety chips */}
                    <div className="mt-2 flex items-center gap-1.5">
                      {PROFILE_ORDER.map((id) => {
                        const level = recipeSafety(r, id);
                        const meta = SAFETY_META[level];
                        const p = FAMILY[id];
                        return (
                          <div key={id} className={`flex items-center gap-1 rounded-full px-2 py-0.5 ${meta.bg} ${meta.text}`}>
                            <span className="text-xs">{p.emoji}</span>
                            <span className="text-[10px] font-semibold">{meta.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-ink-300 shrink-0 mt-1" />
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <RecipeDetail
          recipe={selectedRecipe}
          expandedProfile={expandedProfile}
          setExpandedProfile={setExpandedProfile}
          onBack={() => { setSelectedRecipe(null); setExpandedProfile(null); }}
        />
      )}
    </div>
  );
}

function RecipeDetail({
  recipe,
  expandedProfile,
  setExpandedProfile,
  onBack,
}: {
  recipe: Recipe;
  expandedProfile: ProfileId | null;
  setExpandedProfile: (id: ProfileId | null) => void;
  onBack: () => void;
}) {
  return (
    <div className="animate-tab-slide">
      <button onClick={onBack} className="tap-scale mb-3 flex items-center gap-1 text-sm font-medium text-brand-600">
        <ChevronRight className="h-4 w-4 rotate-180" />
        Back to recipes
      </button>

      <div className="rounded-3xl bg-white shadow-card overflow-hidden">
        <div className="relative h-28 bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center">
          <span className="text-6xl drop-shadow-lg">{recipe.emoji}</span>
        </div>
        <div className="p-4">
          <h3 className="text-lg font-bold text-ink-900">{recipe.title}</h3>
          <div className="mt-2 flex items-center gap-4 text-xs text-ink-500">
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{recipe.time}</span>
            <span className="flex items-center gap-1"><Flame className="h-3.5 w-3.5" />{recipe.calories} cal</span>
            <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{recipe.servings} servings</span>
          </div>
        </div>
      </div>

      {/* Base ingredients */}
      <div className="mt-3 rounded-3xl bg-white shadow-card p-4">
        <p className="text-sm font-bold text-ink-800 flex items-center gap-1.5 mb-2">
          <ChefHat className="h-4 w-4 text-brand-500" /> Base Ingredients
        </p>
        <ul className="space-y-1.5">
          {recipe.baseIngredients.map((ing, i) => (
            <li key={i} className="text-sm text-ink-600 flex items-start gap-2">
              <span className="mt-1.5 h-1 w-1 rounded-full bg-brand-400 shrink-0" />
              {ing}
            </li>
          ))}
        </ul>
      </div>

      {/* Instructions */}
      <div className="mt-3 rounded-3xl bg-white shadow-card p-4">
        <p className="text-sm font-bold text-ink-800 mb-2">Instructions</p>
        <ol className="space-y-2.5">
          {recipe.instructions.map((step, i) => (
            <li key={i} className="text-sm text-ink-600 flex gap-3">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-[11px] font-bold shrink-0 mt-0.5">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>

      {/* Color-coded plating */}
      <div className="mt-3">
        <p className="text-sm font-bold text-ink-800 mb-2 flex items-center gap-1.5">
          <Users className="h-4 w-4 text-brand-500" /> Custom Plating by Member
        </p>
        <div className="space-y-2.5">
          {PROFILE_ORDER.map((id, idx) => {
            const plate = recipe.plating.find((p) => p.profileId === id);
            const profile = profileById(id);
            const level = recipeSafety(recipe, id);
            const meta = SAFETY_META[level];
            const isOpen = expandedProfile === id;
            if (!plate) return null;
            return (
              <div
                key={id}
                className="rounded-3xl bg-white shadow-card overflow-hidden animate-slide-up"
                style={{ animationDelay: `${idx * 60}ms` }}
              >
                <button
                  onClick={() => setExpandedProfile(isOpen ? null : id)}
                  className="w-full flex items-center gap-3 p-4 text-left tap-scale"
                >
                  <span className={`flex h-10 w-10 items-center justify-center rounded-full text-lg bg-gradient-to-br ${profile.gradient} text-white`}>
                    {profile.emoji}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-ink-800">{profile.name}</p>
                    <p className="text-[11px] text-ink-500">{plate.portion}</p>
                  </div>
                  <div className={`flex items-center gap-1 rounded-full px-2 py-1 ${meta.bg} ${meta.text}`}>
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.color }} />
                    <span className="text-[10px] font-semibold">{meta.label}</span>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-ink-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 pt-0 animate-fade-in">
                    <div className="rounded-2xl bg-ink-50 p-3">
                      <p className="text-xs text-ink-600 mb-2">{plate.note}</p>
                      <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wide mb-1.5">Swaps & Adjustments</p>
                      <ul className="space-y-1.5">
                        {plate.swaps.map((s, i) => (
                          <li key={i} className="text-xs text-ink-600 flex items-start gap-2">
                            <Check className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: profile.color }} />
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
