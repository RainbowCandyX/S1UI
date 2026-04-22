import { useT } from "../i18n";

interface Props {
  data: number[];
  height?: number;
}

/**
 * 24-hour hourly bar chart (pure SVG, no deps).
 * `data` should have 24 numbers: index 0 = 24h ago, 23 = now.
 */
export default function ThreatTimeline({ data, height = 140 }: Props) {
  const t = useT();
  const W = 720;
  const H = height;
  const paddingX = 12;
  const paddingTop = 10;
  const paddingBottom = 22;
  const chartH = H - paddingTop - paddingBottom;
  const chartW = W - paddingX * 2;
  const n = data.length || 24;
  const max = Math.max(...data, 1);
  const barW = (chartW / n) * 0.65;
  const gap = (chartW / n) * 0.35;

  const gridSteps = 3;
  const gridLines = Array.from({ length: gridSteps + 1 }, (_, i) => i / gridSteps);

  return (
    <div className="timeline-card">
      <div className="head">
        <div>
          <div className="title">{t("dash.timelineTitle")}</div>
          <div className="sub">{t("dash.timelineSubtitle")}</div>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: H }}>
        <defs>
          <linearGradient id="timelineFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity="0.35" />
          </linearGradient>
        </defs>
        {gridLines.map((g, i) => {
          const y = paddingTop + chartH * g;
          return (
            <line
              key={i}
              x1={paddingX}
              x2={W - paddingX}
              y1={y}
              y2={y}
              stroke="var(--border-subtle)"
              strokeWidth={1}
              strokeDasharray={i === gridLines.length - 1 ? "" : "2 3"}
            />
          );
        })}
        {data.map((v, i) => {
          const x = paddingX + i * (barW + gap) + gap / 2;
          const h = (v / max) * chartH;
          const y = paddingTop + chartH - h;
          const rx = Math.min(3, barW / 2);
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={barW}
              height={Math.max(h, 2)}
              rx={rx}
              ry={rx}
              fill="url(#timelineFill)"
            >
              <title>{`${23 - i}h ago · ${v}`}</title>
            </rect>
          );
        })}
      </svg>
      <div className="axis-labels">
        <span>-24h</span>
        <span>-18h</span>
        <span>-12h</span>
        <span>-6h</span>
        <span>now</span>
      </div>
    </div>
  );
}
