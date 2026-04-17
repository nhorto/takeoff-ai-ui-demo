import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { WelcomeSection } from "@/components/sidebar/WelcomeSection";
import { StairsSection } from "@/components/sidebar/StairsSection";
import { RailsSection } from "@/components/sidebar/RailsSection";
import { LaddersSection } from "@/components/sidebar/LaddersSection";
import { LandingsSection } from "@/components/sidebar/LandingsSection";
import type { AddActions, PanelOpener } from "@/components/sidebar/types";

type Tab = "welcome" | "stairs" | "rails" | "ladders" | "landings";

export function WorkbenchSidebar({
  addActions,
  panelOpener,
}: {
  addActions: AddActions;
  panelOpener: PanelOpener;
}) {
  const [tab, setTab] = useState<Tab>("stairs");
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <aside className="flex w-10 items-start justify-center border-b border-white/10 bg-white/[0.02] xl:border-b-0 xl:border-r">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          title="Expand sidebar"
          className="mt-3 rounded-md px-2 py-1 text-white/55 transition hover:bg-white/[0.06] hover:text-white"
        >
          ▸
        </button>
      </aside>
    );
  }

  return (
    <aside className="flex min-h-0 flex-col border-b border-white/10 bg-white/[0.02] xl:border-b-0 xl:border-r">
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as Tab)}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="flex items-center gap-1 px-2">
          <TabsList className="flex-1 overflow-x-auto">
            <TabsTrigger value="welcome">Home</TabsTrigger>
            <TabsTrigger value="stairs">Stairs</TabsTrigger>
            <TabsTrigger value="rails">Rails</TabsTrigger>
            <TabsTrigger value="ladders">Ladders</TabsTrigger>
            <TabsTrigger value="landings">Landings</TabsTrigger>
          </TabsList>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            title="Collapse sidebar"
            className="rounded-md px-2 py-1 text-white/45 transition hover:bg-white/[0.06] hover:text-white/80"
          >
            ◂
          </button>
        </div>

        <TabsContent value="welcome" className="min-h-0 flex-1">
          <WelcomeSection addActions={addActions} panelOpener={panelOpener} />
        </TabsContent>
        <TabsContent value="stairs" className="min-h-0 flex-1">
          <StairsSection
            onAddStair={addActions.onAddStair}
            panelOpener={panelOpener}
          />
        </TabsContent>
        <TabsContent value="rails" className="min-h-0 flex-1">
          <RailsSection
            onAddRail={addActions.onAddRail}
            panelOpener={panelOpener}
          />
        </TabsContent>
        <TabsContent value="ladders" className="min-h-0 flex-1">
          <LaddersSection
            onAddLadder={addActions.onAddLadder}
            panelOpener={panelOpener}
          />
        </TabsContent>
        <TabsContent value="landings" className="min-h-0 flex-1">
          <LandingsSection
            onAddLanding={addActions.onAddLanding}
            panelOpener={panelOpener}
          />
        </TabsContent>
      </Tabs>
    </aside>
  );
}
