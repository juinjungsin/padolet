"use client";

/**
 * 5차원 능력치 레이더 차트 — 외부 라이브러리 없이 SVG로 렌더.
 * 파도 팔레트(blueprint/graphite)를 따른다.
 */

interface RadarChartProps {
  /** 축 순서대로 { label, value(0–100) } */
  axes: { label: string; value: number }[];
  size?: number;
}

export default function RadarChart({ axes, size = 300 }: RadarChartProps) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.34;
  const n = axes.length;

  // 12시 방향부터 시계 방향으로 축 배치
  const angleAt = (i: number) => -Math.PI / 2 + (2 * Math.PI * i) / n;
  const pointAt = (i: number, r: number) => ({
    x: cx + r * Math.cos(angleAt(i)),
    y: cy + r * Math.sin(angleAt(i)),
  });

  const ringLevels = [0.25, 0.5, 0.75, 1];
  const ringPath = (ratio: number) =>
    axes
      .map((_, i) => {
        const p = pointAt(i, radius * ratio);
        return `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      })
      .join(" ") + " Z";

  const valuePath =
    axes
      .map((a, i) => {
        const p = pointAt(i, radius * Math.max(a.value, 3) / 100);
        return `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      })
      .join(" ") + " Z";

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="w-full max-w-[320px] mx-auto"
      role="img"
      aria-label={axes.map((a) => `${a.label} ${a.value}점`).join(", ")}
    >
      {/* 격자 링 */}
      {ringLevels.map((r) => (
        <path
          key={r}
          d={ringPath(r)}
          fill="none"
          stroke="#d3e0ec"
          strokeWidth={r === 1 ? 1.5 : 1}
        />
      ))}
      {/* 축선 */}
      {axes.map((_, i) => {
        const p = pointAt(i, radius);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={p.x}
            y2={p.y}
            stroke="#d3e0ec"
            strokeWidth={1}
          />
        );
      })}
      {/* 값 폴리곤 */}
      <path
        d={valuePath}
        fill="#2e77e5"
        fillOpacity={0.18}
        stroke="#2e77e5"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {/* 꼭짓점 */}
      {axes.map((a, i) => {
        const p = pointAt(i, radius * Math.max(a.value, 3) / 100);
        return <circle key={i} cx={p.x} cy={p.y} r={3.5} fill="#1c3d5a" />;
      })}
      {/* 라벨 */}
      {axes.map((a, i) => {
        const p = pointAt(i, radius + 28);
        return (
          <text
            key={i}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-slate-text"
            fontSize={12}
            fontWeight={600}
          >
            <tspan x={p.x} dy={-6}>
              {a.label}
            </tspan>
            <tspan x={p.x} dy={14} fontSize={11} fontWeight={700} fill="#2e77e5">
              {a.value}
            </tspan>
          </text>
        );
      })}
    </svg>
  );
}
