import { useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Check, Copy } from 'lucide-react';
import { TABLE_COLUMNS, type FieldName, type SortKey } from '@/data/fields';
import type { SortState } from '@/data/useInvoices';
import { approvalPill, formatAmount, formatDateTime, initials, isEvaluationRow, type Invoice } from '@/data/model';
import { CoverageRing } from './Charts';
import { EvaluationTag, IconButton, NeededPill, NeutralPill, focusRing } from './ui';

interface Props {
  rows: Invoice[];
  sort: SortState;
  onSort: (key: SortKey) => void;
  coverage: Record<string, number>;
  /** False when the live schema is known and lacks the field. */
  has: (f: FieldName) => boolean;
  selectedId: string | null;
  onSelect: (inv: Invoice) => void;
}

function SortIcon({ active, direction }: { active: boolean; direction: 'asc' | 'desc' }) {
  if (!active) return <ArrowUpDown className="h-3.5 w-3.5 text-slate-300" aria-hidden />;
  return direction === 'asc' ? <ArrowUp className="h-3.5 w-3.5 text-accent-600" aria-hidden /> : <ArrowDown className="h-3.5 w-3.5 text-accent-600" aria-hidden />;
}

function CopyIdButton({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked; the full id is in the detail panel */
    }
  };
  return (
    <IconButton label={copied ? 'Copied' : 'Copy record ID'} onClick={copy} className="h-7 w-7">
      {copied ? <Check className="h-3.5 w-3.5 text-accent-600" /> : <Copy className="h-3.5 w-3.5" />}
    </IconButton>
  );
}

export function InvoiceTable({ rows, sort, onSort, coverage, has, selectedId, onSelect }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full min-w-[880px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80">
            {TABLE_COLUMNS.map((col) => {
              const active = sort.key === col.key;
              const missing = !has(col.field);
              const pct = missing ? undefined : coverage[col.field];
              return (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                  className={`px-3 py-2 font-medium text-slate-600 ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                >
                  <div className={`flex items-center gap-2 ${col.align === 'right' ? 'justify-end' : ''}`}>
                    <button
                      type="button"
                      onClick={() => onSort(col.key)}
                      className={`inline-flex items-center gap-1 rounded px-1 py-0.5 text-xs font-semibold uppercase tracking-wide hover:text-slate-900 ${focusRing}`}
                    >
                      {col.label}
                      <SortIcon active={active} direction={sort.direction} />
                    </button>
                    <span
                      className="inline-flex items-center gap-1 font-mono text-[10px] font-normal text-slate-400"
                      title={missing ? `${col.field} is not in the live schema` : `${col.field}: non-null in ${pct ?? 0}% of loaded rows`}
                    >
                      <CoverageRing percent={pct} />
                      {missing ? 'n/a' : pct == null ? '—' : `${pct}%`}
                    </span>
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((inv) => {
            const pill = approvalPill(inv);
            const selected = inv.id === selectedId;
            return (
              <tr
                key={inv.id}
                tabIndex={0}
                aria-selected={selected}
                onClick={() => onSelect(inv)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(inv);
                  }
                }}
                className={`group cursor-pointer border-b border-slate-100 last:border-b-0 outline-none transition-colors hover:bg-slate-50 focus-visible:bg-accent-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-500 ${selected ? 'bg-accent-50/70' : ''}`}
              >
                <td className="max-w-[300px] px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 font-display text-xs font-semibold text-slate-600">
                      {initials(inv.vendorName)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-slate-900" title={inv.vendorName}>
                        {inv.vendorName || '—'}
                      </div>
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate font-mono text-xs text-slate-500" title={inv.invoiceNumber}>
                          {inv.invoiceNumber || '—'}
                        </span>
                        {isEvaluationRow(inv) && <EvaluationTag />}
                      </div>
                    </div>
                    <span className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                      <CopyIdButton id={inv.id} />
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2.5 font-mono text-xs text-slate-700">{inv.poNumber || '—'}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono text-xs text-slate-800">
                  {formatAmount(inv.totalAmount)}
                  {inv.currency && <span className="ml-1 text-slate-400">{inv.currency}</span>}
                </td>
                <td className="px-3 py-2.5">
                  {pill ? pill.tone === 'needed' ? <NeededPill /> : <NeutralPill>{pill.text}</NeutralPill> : <span className="text-slate-400">—</span>}
                </td>
                <td className="max-w-[180px] px-3 py-2.5">
                  {inv.lifecycleState ? <NeutralPill title={inv.lifecycleState}>{inv.lifecycleState}</NeutralPill> : <span className="text-slate-400">—</span>}
                </td>
                <td className="max-w-[180px] truncate px-3 py-2.5 text-xs text-slate-700" title={inv.agentRecommendation}>
                  {inv.agentRecommendation || <span className="text-slate-400">—</span>}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-slate-500">{formatDateTime(inv.updateTime ?? inv.processedTimestamp)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
