"use client";

import { useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";

type AnomalyPoint = {
  bucket_start: string;
  avg_value: number;
  is_anomaly: boolean;
  z_score: number | null;
};

export function ReadingChart({ deviceId }: { deviceId: string }) {
  const [points, setPoints] = useState<AnomalyPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/devices/${deviceId}/readings`)
      .then((res) => res.json())
      .then((data) => setPoints(data.points))
      .finally(() => setLoading(false));
  }, [deviceId]);

  const anomalies = points.filter((p) => p.is_anomaly);

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="space-y-2">
      {anomalies.length > 0 && (
        <Badge variant="destructive">
          {anomalies.length} anomalous hour{anomalies.length === 1 ? "" : "s"} detected
        </Badge>
      )}
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={points}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="bucket_start"
            tickFormatter={(v) => new Date(v).toLocaleString(undefined, { hour: "2-digit" })}
            fontSize={11}
          />
          <YAxis fontSize={11} domain={["auto", "auto"]} />
          <Tooltip
            labelFormatter={(v) => new Date(v).toLocaleString()}
            formatter={(value: number) => value.toFixed(2)}
          />
          <Line
            type="monotone"
            dataKey="avg_value"
            stroke="currentColor"
            className="text-primary"
            dot={(props) => {
              const point = points[props.index];
              if (!point?.is_anomaly) return <g key={props.key} />;
              return (
                <circle
                  key={props.key}
                  cx={props.cx}
                  cy={props.cy}
                  r={4}
                  fill="var(--destructive)"
                  stroke="none"
                />
              );
            }}
            strokeWidth={1.5}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
