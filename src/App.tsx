import { useState } from 'react';
import { ProfileSwitcher } from '@/components/ProfileSwitcher';
import { ScannerScreen } from '@/components/ScannerScreen';
import { MealPlannerScreen } from '@/components/MealPlannerScreen';
import { CareChecklistScreen } from '@/components/CareChecklistScreen';
import { FAMILY } from '@/lib/family';
import { CARE_TASKS } from '@/lib/careTasks';
import { RECIPES } from '@/lib/recipes';
import type { ProfileId } from '@/lib/types';
import { ScanLine, ChefHat, ClipboardCheck, Home, Heart, ShieldCheck } from 'lucide-react';

type Tab = 'home' | 'scanner' | 'meals' | 'care';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [activeProfile, setActiveProfile] = useState<ProfileId>('mom');

  return (
    <div className="mx-auto min-h-screen max-w-md bg-ink-100 relative">
      {/* Header */}
      <header className="sticky top-0 z-30 glass border-b border-ink-100">
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 shadow-card">
              <Heart className="h-5 w-5 text-white" fill="white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-ink-900 leading-tight">FamOasis</h1>
              <p className="text-[11px] text-ink-400 leading-tight">Family Care Assistant</p>
            </div>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          </div>
        </div>
        <ProfileSwitcher activeProfile={activeProfile} onSelect={setActiveProfile} />
      </header>

      {/* Content */}
      <main className="min-h-[60vh]">
        {activeTab === 'home' && <HomeScreen activeProfile={activeProfile} setTab={setActiveTab} />}
        {activeTab === 'scanner' && <ScannerScreen />}
        {activeTab === 'meals' && <MealPlannerScreen />}
        {activeTab === 'care' && <CareChecklistScreen />}
      </main>

      {/* Tab bar */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-30 glass border-t border-ink-100 safe-bottom">
        <div className="flex items-center justify-around px-2 py-2">
          <TabButton icon={Home} label="Home" active={activeTab === 'home'} onClick={() => setActiveTab('home')} />
          <TabButton icon={ScanLine} label="Scanner" active={activeTab === 'scanner'} onClick={() => setActiveTab('scanner')} />
          <TabButton icon={ChefHat} label="Meals" active={activeTab === 'meals'} onClick={() => setActiveTab('meals')} />
          <TabButton icon={ClipboardCheck} label="Care" active={activeTab === 'care'} onClick={() => setActiveTab('care')} />
        </div>
      </nav>
    </div>
  );
}

function TabButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof Home;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`tap-scale flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-2xl transition-all ${
        active ? 'text-brand-600' : 'text-ink-400'
      }`}
    >
      <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
      <span className={`text-[10px] font-medium ${active ? 'font-semibold' : ''}`}>{label}</span>
    </button>
  );
}

function HomeScreen({
  activeProfile,
  setTab,
}: {
  activeProfile: ProfileId;
  setTab: (t: Tab) => void;
}) {
  const profile = FAMILY[activeProfile];
  const profileTasks = CARE_TASKS.filter((t) => t.profileId === activeProfile);
  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening';
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="px-4 pb-24 pt-2">
      {/* Greeting */}
      <div className="animate-slide-up">
        <p className="text-xs text-ink-400">{dateStr}</p>
        <h2 className="text-xl font-bold text-ink-900 mt-0.5">
          {greeting} {profile.emoji}
        </h2>
      </div>

      {/* Active profile card */}
      <div className={`mt-3 rounded-3xl bg-gradient-to-br ${profile.gradient} p-4 shadow-card animate-slide-up`}>
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-2xl">
            {profile.emoji}
          </span>
          <div>
            <p className="text-sm font-semibold text-white/90">{profile.name} · {profile.role}</p>
            <p className="text-lg font-bold text-white">{profile.diet}</p>
          </div>
        </div>
        <div className="mt-3 rounded-2xl bg-white/15 p-2.5">
          <p className="text-xs text-white/85">{profile.notes}</p>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {profile.restrictions.map((r, i) => (
            <span key={i} className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium text-white">
              {r}
            </span>
          ))}
        </div>
      </div>

      {/* Quick stats */}
      <div className="mt-3 grid grid-cols-2 gap-3 animate-slide-up">
        <button onClick={() => setTab('care')} className="tap-scale rounded-3xl bg-white shadow-card p-4 text-left">
          <div className="flex items-center gap-2 mb-1">
            <ClipboardCheck className="h-4 w-4 text-brand-500" />
            <span className="text-xs font-medium text-ink-400">Care Tasks</span>
          </div>
          <p className="text-2xl font-bold text-ink-900">{profileTasks.length}</p>
          <p className="text-[11px] text-ink-400">for {profile.name}</p>
        </button>
        <button onClick={() => setTab('meals')} className="tap-scale rounded-3xl bg-white shadow-card p-4 text-left">
          <div className="flex items-center gap-2 mb-1">
            <ChefHat className="h-4 w-4 text-brand-500" />
            <span className="text-xs font-medium text-ink-400">Recipes</span>
          </div>
          <p className="text-2xl font-bold text-ink-900">{RECIPES.length}</p>
          <p className="text-[11px] text-ink-400">unified meals</p>
        </button>
      </div>

      {/* Quick actions */}
      <div className="mt-3 animate-slide-up">
        <p className="text-xs font-medium text-ink-400 uppercase tracking-wide mb-2">Quick Actions</p>
        <div className="space-y-2">
          <button onClick={() => setTab('scanner')} className="tap-scale w-full flex items-center gap-3 rounded-3xl bg-white shadow-card p-4 text-left hover:shadow-card-lg transition-all">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50">
              <ScanLine className="h-5 w-5 text-brand-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-ink-800">Scan a Label</p>
              <p className="text-[11px] text-ink-400">Check food safety for all family members</p>
            </div>
          </button>
          <button onClick={() => setTab('meals')} className="tap-scale w-full flex items-center gap-3 rounded-3xl bg-white shadow-card p-4 text-left hover:shadow-card-lg transition-all">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50">
              <ChefHat className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-ink-800">Plan a Meal</p>
              <p className="text-[11px] text-ink-400">Unified recipes with custom plating</p>
            </div>
          </button>
          <button onClick={() => setTab('care')} className="tap-scale w-full flex items-center gap-3 rounded-3xl bg-white shadow-card p-4 text-left hover:shadow-card-lg transition-all">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50">
              <ClipboardCheck className="h-5 w-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-ink-800">Daily Checklist</p>
              <p className="text-[11px] text-ink-400">Medications and care routines</p>
            </div>
          </button>
        </div>
      </div>

      {/* Family overview */}
      <div className="mt-4 animate-slide-up">
        <p className="text-xs font-medium text-ink-400 uppercase tracking-wide mb-2">Family Overview</p>
        <div className="rounded-3xl bg-white shadow-card p-4">
          {Object.values(FAMILY).map((p, i, arr) => (
            <div key={p.id} className={`flex items-center gap-3 ${i < arr.length - 1 ? 'pb-3 mb-3 border-b border-ink-100' : ''}`}>
              <span className={`flex h-10 w-10 items-center justify-center rounded-full text-lg bg-gradient-to-br ${p.gradient} text-white`}>
                {p.emoji}
              </span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-ink-800">{p.name}</p>
                <p className="text-[11px] text-ink-400">{p.diet}</p>
              </div>
              <div className="flex flex-wrap justify-end gap-1">
                {p.allergens.length > 0 && (
                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-600">
                    {p.allergens.length} allergen{p.allergens.length > 1 ? 's' : ''}
                  </span>
                )}
                <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-medium text-ink-500">
                  {p.restrictions.length} limit{p.restrictions.length > 1 ? 's' : ''}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
