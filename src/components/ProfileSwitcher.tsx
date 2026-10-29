import type { FamilyProfile, ProfileId } from '@/lib/types';
import { FAMILY, PROFILE_ORDER } from '@/lib/family';
import { Check } from 'lucide-react';

interface ProfileSwitcherProps {
  activeProfile: ProfileId;
  onSelect: (id: ProfileId) => void;
}

export function ProfileSwitcher({ activeProfile, onSelect }: ProfileSwitcherProps) {
  const active = FAMILY[activeProfile];

  return (
    <div className="px-4 pt-2 pb-3">
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
        {PROFILE_ORDER.map((id) => {
          const p = FAMILY[id];
          const isActive = id === activeProfile;
          return (
            <button
              key={id}
              onClick={() => onSelect(id)}
              className={`tap-scale flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 whitespace-nowrap transition-all duration-200 ${
                isActive
                  ? `bg-gradient-to-br ${p.gradient} text-white shadow-card`
                  : 'bg-white text-ink-600 shadow-pill'
              }`}
            >
              <span className={`flex h-9 w-9 items-center justify-center rounded-full text-lg ${isActive ? 'bg-white/25' : 'bg-ink-100'}`}>
                {p.emoji}
              </span>
              <div className="text-left">
                <p className={`text-sm font-semibold leading-tight ${isActive ? 'text-white' : 'text-ink-800'}`}>
                  {p.name}
                </p>
                <p className={`text-[11px] leading-tight ${isActive ? 'text-white/80' : 'text-ink-400'}`}>
                  {p.diet}
                </p>
              </div>
              {isActive && (
                <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-white/25 animate-scale-in">
                  <Check className="h-3 w-3 text-white" strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ProfileAvatar({ profile, size = 'md' }: { profile: FamilyProfile; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: 'h-8 w-8 text-base',
    md: 'h-10 w-10 text-lg',
    lg: 'h-12 w-12 text-xl',
  };
  return (
    <span className={`flex items-center justify-center rounded-full bg-gradient-to-br ${profile.gradient} text-white ${sizes[size]}`}>
      {profile.emoji}
    </span>
  );
}
