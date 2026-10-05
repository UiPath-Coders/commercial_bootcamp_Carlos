import type { ReactNode } from 'react';
import type { KpiValue, Kpis } from '@/data/useInvoices';
import { Donut, EmptyChart, Sparkline } from './Charts';
import { Skeleton } from './ui';

function Card({
  label,
  kpi,
  loading,
  chart,
  caption,
}: {
  label: string;
  kpi: KpiValue;
  loading: boolean;
  chart: ReactNode;
  caption: string;
}) {
  const missing = !loading && kpi.value == null;
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4">
      <span className="truncate text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
      <div className="flex items-end justify-between gap-3">
        {loading ? (
          <>
            <Skeleton className="h-8 w-12" />
            <Skeleton className="h-8 w-20" />
          </>
        ) : missing ? (
          <>
            <span className="font-display text-3xl font-semibold leading-none text-slate-300">—</span>
            <EmptyChart width={kpi.field === 'Id' ? 96 : 36} height={kpi.field === 'Id' ? 32 : 36} />
          </>
        ) : (
          <>
            <span className="font-display text-3xl font-semibold leading-none tabular-nums text-slate-900">{kpi.value}</span>
            {chart}
          </>
        )}
      </div>
      <span className={`truncate text-xs ${missing ? 'text-amber-700' : 'text-slate-500'}`} title={missing ? `${kpi.field} is not in the schema` : caption}>
        {loading ? <Skeleton className="h-3 w-24" /> : missing ? `${kpi.field} is not in the schema` : caption}
      </span>
    </div>
  );
}

function ratioCaption(k: KpiValue) {
  return k.value == null ? '' : `${k.value} of ${k.total} invoices`;
}

export function KpiStrip({ kpis, loading }: { kpis: Kpis; loading: boolean }) {
  const t = kpis.totalInvoices;
  const last7 = t.last7Days.reduce((a, b) => a + b, 0);
  return (
    <section aria-label="Key figures" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Card
        label="Total Invoices"
        kpi={t}
        loading={loading}
        chart={<Sparkline values={t.last7Days} />}
        caption={`${last7} added in the last 7 days`}
      />
      <Card
        label="Approval Needed"
        kpi={kpis.approvalNeeded}
        loading={loading}
        chart={<Donut part={kpis.approvalNeeded.value ?? 0} total={kpis.approvalNeeded.total} />}
        caption={ratioCaption(kpis.approvalNeeded)}
      />
      <Card
        label="Pending Review"
        kpi={kpis.pendingReview}
        loading={loading}
        chart={<Donut part={kpis.pendingReview.value ?? 0} total={kpis.pendingReview.total} />}
        caption={ratioCaption(kpis.pendingReview)}
      />
      <Card
        label="Recommended for Approval"
        kpi={kpis.recommendedForApproval}
        loading={loading}
        chart={<Donut part={kpis.recommendedForApproval.value ?? 0} total={kpis.recommendedForApproval.total} />}
        caption={ratioCaption(kpis.recommendedForApproval)}
      />
    </section>
  );
}
