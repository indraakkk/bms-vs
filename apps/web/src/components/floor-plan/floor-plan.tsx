"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FloorPlanSvg } from "./floor-plan-svg";
import { BUILDING_FLOOR_TABS } from "./zone-shapes";

function tabKey(buildingId: string, floor: number) {
  return `${buildingId}:${floor}`;
}

export function FloorPlan() {
  return (
    <TooltipProvider delayDuration={100}>
      <Tabs defaultValue={tabKey(BUILDING_FLOOR_TABS[0].buildingId, BUILDING_FLOOR_TABS[0].floor)}>
        <TabsList>
          {BUILDING_FLOOR_TABS.map((t) => (
            <TabsTrigger key={tabKey(t.buildingId, t.floor)} value={tabKey(t.buildingId, t.floor)}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {BUILDING_FLOOR_TABS.map((t) => (
          <TabsContent
            key={tabKey(t.buildingId, t.floor)}
            value={tabKey(t.buildingId, t.floor)}
            className="pt-4"
          >
            <FloorPlanSvg buildingId={t.buildingId} floor={t.floor} />
          </TabsContent>
        ))}
      </Tabs>
    </TooltipProvider>
  );
}
