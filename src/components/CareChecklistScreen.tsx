import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { CARE_TASKS } from '@/lib/careTasks';
import { FAMILY, PROFILE_ORDER } from '@/lib/family';
import type { CareTask, ProfileId } from '@/lib/types';
import { Pill, Activity, Footprints, Droplet, Sun, Siren, Scan, Check, Loader2 } from 'lucide-react';

const ICONS: Record<string, typeof Pill> = {
  pill: Pill,
  activity: Activity,
  footprints: Footprints,
  droplet: Droplet,
  sun: Sun,
  siren: Siren,
  scan: Scan,
};

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function CareChecklistScreen() {
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const loadToday = useCallback(async () => {
    const today = todayStr();
    const { data, error } = await supabase
      .from('care_log')
      .select('task_key, completed')
      .eq('date', today);
    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }
    const map: Record<string, boolean> = {};
    (data ?? []).forEach((row) => {
      map[row.task_key] = row.completed;
    });
    setCompleted(map);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadToday();
  }, [loadToday]);

  async function toggle(taskKey: string) {
    const newState = !completed[taskKey];
    setCompleted((prev) => ({ ...prev, [taskKey]: newState }));

    const today = todayStr();
    const { error } = await supabase
      .from('care_log')
      .upsert(
        { task_key: taskKey, date: today, completed: newState, completed_at: newState ? new Date().toISOString() : null },
        { onConflict: 'task_key,date' }
      );
    if (error) {
      // revert on failure
      setCompleted((prev) => ({ ...prev, [taskKey]: !newState }));
      console.error(error);
    }
  }

  const tasksByProfile = PROFILE_ORDER.map((id) => ({
    profile: FAMILY[id],
    tasks: CARE_TASKS.filter((t) => t.profileId === id),
  }));

  const totalDone = CARE_TASKS.filter((t) => completed[t.key]).length;
  const totalTasks = CARE_TASKS.length;
  const progress = totalTasks > 0 ? Math.round((totalDone / totalTasks) * 100) : 0;

  return (
    <div className="px-4 pb-24 pt-2">
      <div className="mb-3">
        <h2 className="text-xl font-bold text-ink-900">Daily Care & Medication</h2>
        <p className="text-sm text-ink-500 mt-0.5">Track dosages and routines for the whole family.</p>
      </div>

      {/* Progress card */}
      <div className="rounded-3xl bg-gradient-to-br from-brand-500 to-brand-600 p-4 shadow-card animate-slide-up">
        <div className="flex items-center justify-between mb-2.5">
          <div>
            <p className="text-sm font-semibold text-white/90">Today's Progress</p>
            <p className="text-2xl font-bold text-white mt-0.5">
              {totalDone}<span className="text-base font-medium text-white/70"> / {totalTasks} tasks</span>
            </p>
          </div>
          <div className="flex items-center justify-center">
            <span className="text-3xl font-bold text-white">{progress}%</span>
          </div>
        </div>
        <div className="h-2 rounded-full bg-white/20 overflow-hidden">
          <div
            className="h-full rounded-full bg-white transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-ink-400" />
        </div>
      ) : (
        <div className="mt-3 space-y-4">
          {tasksByProfile.map(({ profile, tasks }) => (
            <ProfileSection
              key={profile.id}
              profileId={profile.id}
              tasks={tasks}
              completed={completed}
              onToggle={toggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProfileSection({
  profileId,
  tasks,
  completed,
  onToggle,
}: {
  profileId: ProfileId;
  tasks: CareTask[];
  completed: Record<string, boolean>;
  onToggle: (key: string) => void;
}) {
  const profile = FAMILY[profileId];
  const done = tasks.filter((t) => completed[t.key]).length;
  const allDone = done === tasks.length && tasks.length > 0;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2 px-1">
        <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm bg-gradient-to-br ${profile.gradient} text-white`}>
          {profile.emoji}
        </span>
        <h3 className="text-sm font-bold text-ink-800">{profile.name}</h3>
        <span className="text-[11px] text-ink-400 ml-auto">
          {done}/{tasks.length}
        </span>
        {allDone && (
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 animate-scale-in">
            <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
          </span>
        )}
      </div>
      <div className="space-y-2">
        {tasks.map((task, i) => (
          <ChecklistRow
            key={task.key}
            task={task}
            isDone={!!completed[task.key]}
            onToggle={() => onToggle(task.key)}
            index={i}
          />
        ))}
      </div>
    </div>
  );
}

function ChecklistRow({
  task,
  isDone,
  onToggle,
  index,
}: {
  task: CareTask;
  isDone: boolean;
  onToggle: () => void;
  index: number;
}) {
  const Icon = ICONS[task.icon] ?? Pill;
  return (
    <button
      onClick={onToggle}
      className="tap-scale w-full flex items-center gap-3 rounded-2xl bg-white shadow-card p-3.5 text-left animate-slide-up transition-all"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl shrink-0 transition-all ${
        isDone ? 'bg-emerald-50' : 'bg-ink-50'
      }`}>
        <Icon className={`h-5 w-5 ${isDone ? 'text-emerald-500' : 'text-ink-400'} transition-colors`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold transition-colors ${isDone ? 'text-ink-400 line-through' : 'text-ink-800'}`}>
          {task.label}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-xs ${isDone ? 'text-ink-300' : 'text-ink-500'}`}>{task.dosage}</span>
          <span className="text-ink-300">•</span>
          <span className={`text-xs ${isDone ? 'text-ink-300' : 'text-ink-500'}`}>{task.time}</span>
        </div>
      </div>
      <div className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all shrink-0 ${
        isDone ? 'bg-emerald-500 border-emerald-500 animate-check-pop' : 'border-ink-300 bg-white'
      }`}>
        {isDone && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
      </div>
    </button>
  );
}
