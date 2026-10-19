"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

export interface ChartRow {
  name: string;
  /** null = รอข้อมูล */
  value: number | null;
  /** score so far, not every evaluation is in yet */
  partial?: boolean;
}

const ACCENT = "#2F5BFF";
const PARTIAL = "#9DB4FF";

function fmt(v: number) {
  return (Math.round((v + Number.EPSILON) * 100) / 100).toFixed(2);
}

/** Horizontal bars. Rows must already be sorted (descending, waiting last). */
export function ScoreChart({ rows, max }: { rows: ChartRow[]; max: number }) {
  if (rows.length === 0) return null;
  const data = rows.map((r) => ({ ...r, plot: r.value ?? 0 }));

  return (
    <div role="img" aria-label="กราฟแท่งคะแนน เรียงจากมากไปน้อย">
      <ResponsiveContainer width="100%" height={data.length * 46 + 36}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 72, bottom: 4, left: 0 }} barCategoryGap={10}>
          <CartesianGrid horizontal={false} stroke="#E1E8F6" />
          <XAxis
            type="number"
            domain={[0, max]}
            tick={{ fontSize: 13, fill: "#64748B" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={170}
            interval={0}
            tick={{ fontSize: 14, fill: "#0F172A" }}
            axisLine={false}
            tickLine={false}
          />
          <Bar dataKey="plot" fill={ACCENT} radius={[0, 10, 10, 0]} barSize={24} isAnimationActive={false}>
            {data.map((r) => (
              <Cell key={r.name} fill={r.partial ? PARTIAL : ACCENT} />
            ))}
            <LabelList
              dataKey="plot"
              position="right"
              content={(props) => {
                const { x, y, width, height, index } = props as unknown as {
                  x: number;
                  y: number;
                  width: number;
                  height: number;
                  index: number;
                };
                const row = data[index];
                const waiting = row.value === null;
                return (
                  <text
                    x={x + width + 6}
                    y={y + height / 2}
                    dominantBaseline="central"
                    fontSize={14}
                    fill={waiting ? "#94A3B8" : "#0F172A"}
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {waiting ? "รอข้อมูล" : fmt(row.value as number) + (row.partial ? " *" : "")}
                  </text>
                );
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
