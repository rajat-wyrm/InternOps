import { BriefcaseBusiness } from 'lucide-react';

export default function HR() {
  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 flex items-center justify-center">
          <BriefcaseBusiness className="w-5 h-5" />
        </div>

        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
            HR
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Human Resources management
          </p>
        </div>
      </div>
    </div>
  );
}
