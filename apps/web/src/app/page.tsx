import { DbLive, listDevices } from "@venturesea/data";
import { Effect } from "effect";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReadingChart } from "@/components/reading-chart";

export default async function Home() {
  const devices = await Effect.runPromise(listDevices.pipe(Effect.provide(DbLive)));

  return (
    <div className="min-h-screen bg-zinc-50 px-8 py-12 dark:bg-black">
      <main className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Building Sensors</h1>
          <p className="text-sm text-muted-foreground">
            Last 7 days, hourly rollups. Red points/badges are flagged anomalies (rolling z-score).
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {devices.map((device) => (
            <Card key={device.device_id}>
              <CardHeader>
                <CardTitle className="text-base">{device.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <ReadingChart deviceId={device.device_id} />
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
