import { Inbox } from 'lucide-react';
import { PageHeader, Card } from '../components/ui';

export default function Requests() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Requests"
        subtitle="Review and manage the latest requests available to your account."
        icon={
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 text-indigo-600 dark:text-indigo-300 flex items-center justify-center shadow-sm">
            <Inbox className="w-6 h-6" />
          </div>
        }
      />

      <Card className="p-6 sm:p-8">
        <div className="space-y-3">
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
            Request Center
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            This page is ready for the platform’s request workflows. Add the
            specific request content here when the corresponding feature is
            available.
          </p>
        </div>
      </Card>
    </div>
  );
}
