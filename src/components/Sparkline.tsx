interface Props {
  data: number[];
  color?: string;
  fill?: string;
  height?: number;
  showArea?: boolean;
}

export default function Sparkline({
  data,
  color = "currentColor",
  fill,
  height = 28,
  showArea = true,
}: Props) {
  if (data.length === 0) return null;
  const W = 100;
  const H = height;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const span = Math.max(max - min, 1);
  const step = data.length > 1 ? W / (data.length - 1) : 0;
  const points = data.map((v, i) => {
    const x = i * step;
    const y = H - ((v - min) / span) * (H - 4) - 2;
    return [x, y] as const;
  });
  const line = points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const areaPath =
    `M ${points[0][0].toFixed(2)},${H} ` +
    points.map(([x, y]) => `L ${x.toFixed(2)},${y.toFixed(2)}`).join(" ") +
    ` L ${points[points.length - 1][0].toFixed(2)},${H} Z`;

  return (
    <svg
      className="sparkline"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-hidden="true"
    >
      {showArea && (
        <path d={areaPath} fill={fill ?? color} opacity={0.15} stroke="none" />
      )}
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
