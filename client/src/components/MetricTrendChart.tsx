import { type MedicalStatus } from "@shared/medical";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Entry = { value: string; unit: string | null; examDate: string; status: MedicalStatus };

/** Parses "13–150", "0-200", "< 55", "> 40" into plotting bounds. */
function parseRange(range: string | null): { min: number | null; max: number | null } | null {
  if (!range) return null;
  const norm = range.replace(/[٫،]/g, ".");

  const between = norm.match(/(-?\d+(?:\.\d+)?)\s*[–—\-‑]\s*(-?\d+(?:\.\d+)?)/);
  if (between) return { min: Number(between[1]), max: Number(between[2]) };

  const upper = norm.match(/[<≤]\s*=?\s*(-?\d+(?:\.\d+)?)/);
  if (upper) return { min: null, max: Number(upper[1]) };

  const lower = norm.match(/[>≥]\s*=?\s*(-?\d+(?:\.\d+)?)/);
  if (lower) return { min: Number(lower[1]), max: null };

  return null;
}

/**
 * Renders a test's numeric history over time. Non-numeric entries (e.g. "Negative")
 * are skipped, and the chart hides itself when fewer than two points remain — a
 * single dot conveys nothing a number doesn't already say.
 */
export function MetricTrendChart({
  history,
  referenceRange,
  status,
  compact = false,
}: {
  history: Entry[];
  referenceRange: string | null;
  status: MedicalStatus;
  compact?: boolean;
}) {
  const rawPoints = history
    .map(h => ({
      examDate: h.examDate,
      value: Number(String(h.value).replace(",", ".")),
      unit: h.unit,
    }))
    .filter(p => !Number.isNaN(p.value));

  // Compact (card grid) view stays readable with only the last 3 points;
  // the full dialog chart always shows everything.
  const points = compact ? rawPoints.slice(-3) : rawPoints;

  if (points.length < 2) return null;

  const accent = status === "follow_up" ? "#eda100" : "#0f766e";
  const range = parseRange(referenceRange);

  const values = points.map(p => p.value);
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  const pad = (dataMax - dataMin || dataMax || 1) * 0.15;

  const bounds = {
    min: Math.min(dataMin - pad, range?.min ?? Infinity),
    max: Math.max(dataMax + pad, range?.max ?? -Infinity),
  };

  return (
    <div style={{ width: "100%", height: compact ? 96 : 200 }} dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 6, right: 6, bottom: 0, left: compact ? 0 : 4 }}>
          <defs>
            <linearGradient id={`fill-${status}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity={0.18} />
              <stop offset="100%" stopColor={accent} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          {range && range.min !== null && range.max !== null && (
            <ReferenceArea
              y1={range.min}
              y2={range.max}
              fill="#0f766e"
              fillOpacity={0.06}
              strokeOpacity={0}
            />
          )}

          {!compact && <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />}

          <XAxis dataKey="examDate" hide={compact} tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
          <YAxis
            hide={compact}
            domain={[bounds.min, bounds.max]}
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={false}
            width={38}
          />

          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 12, border: "1px solid #e2e8f0" }}
            labelStyle={{ fontWeight: 700, color: "#0f172a" }}
            formatter={(value: number, _n, item: any) => [
              `${value}${item?.payload?.unit ? " " + item.payload.unit : ""}`,
              "النتيجة",
            ]}
          />

          <Area
            type="monotone"
            dataKey="value"
            stroke={accent}
            strokeWidth={2}
            fill={`url(#fill-${status})`}
            dot={{ r: 3, fill: accent, strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
