/** Small inline SVG charts in the teal accent. All are decorative; values are stated in text next to them. */

export function Sparkline({ values, width = 96, height = 32 }: { values: number[]; width?: number; height?: number }) {
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const pts = values.map((v, i) => [i * step, height - 3 - (v / max) * (height - 6)] as const);
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${width},${height} L0,${height} Z`;
  const [lx, ly] = pts[pts.length - 1] ?? [0, height];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="overflow-visible">
      <path d={area} className="fill-accent-100" />
      <path d={line} className="fill-none stroke-accent-600" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r={2.5} className="fill-accent-600" />
    </svg>
  );
}

export function Donut({ part, total, size = 36, stroke = 5 }: { part: number; total: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const ratio = total > 0 ? Math.min(1, part / total) : 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-slate-200" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={stroke}
        strokeDasharray={`${ratio * c} ${c}`}
        strokeLinecap={ratio > 0 ? 'round' : 'butt'}
        className="stroke-accent-600 transition-[stroke-dasharray] duration-500"
      />
    </svg>
  );
}

/** Dashed outline shown in place of a chart when the backing field is not in the schema. */
export function EmptyChart({ width = 96, height = 32 }: { width?: number; height?: number }) {
  return <span aria-hidden className="block rounded border border-dashed border-slate-300" style={{ width, height }} />;
}

/** Tiny coverage ring for a table header: share of loaded rows where the field is non-null. */
export function CoverageRing({ percent }: { percent: number | undefined }) {
  const size = 14;
  const stroke = 2.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const ratio = percent == null ? 0 : percent / 100;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="-rotate-90 shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-slate-200" />
      {percent != null && (
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeDasharray={`${ratio * c} ${c}`} className="stroke-accent-500" />
      )}
    </svg>
  );
}
