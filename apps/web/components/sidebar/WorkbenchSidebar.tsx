import { useState, type ReactNode } from "react";
import { WelcomeSection } from "@/components/sidebar/WelcomeSection";
import { StairsSection } from "@/components/sidebar/StairsSection";
import { RailsSection } from "@/components/sidebar/RailsSection";
import { LaddersSection } from "@/components/sidebar/LaddersSection";
import { LandingsSection } from "@/components/sidebar/LandingsSection";
import type { AddActions, PanelOpener } from "@/components/sidebar/types";

type Tab = "welcome" | "stairs" | "rails" | "ladders" | "landings";

const TAB_TITLES: Record<Tab, string> = {
  welcome: "Home",
  stairs: "Stairs",
  rails: "Rails",
  ladders: "Ladders",
  landings: "Landings",
};

export function WorkbenchSidebar({
  addActions,
  panelOpener,
}: {
  addActions: AddActions;
  panelOpener: PanelOpener;
}) {
  const [tab, setTab] = useState<Tab>("stairs");
  const [collapsed, setCollapsed] = useState(false);

  function handleRibbonClick(next: Tab) {
    if (next === tab && !collapsed) {
      setCollapsed(true);
      return;
    }
    setTab(next);
    setCollapsed(false);
  }

  return (
    <aside className="flex min-h-0 border-b border-white/10 bg-white/[0.02] xl:border-b-0 xl:border-r">
      <div className="flex w-11 shrink-0 flex-col items-stretch border-r border-white/5 py-2">
        <RibbonButton
          active={tab === "welcome" && !collapsed}
          title="Home"
          onClick={() => handleRibbonClick("welcome")}
        >
          <HomeIcon />
        </RibbonButton>
        <RibbonButton
          active={tab === "stairs" && !collapsed}
          title="Stairs"
          onClick={() => handleRibbonClick("stairs")}
        >
          <StairsIcon />
        </RibbonButton>
        <RibbonButton
          active={tab === "rails" && !collapsed}
          title="Rails"
          onClick={() => handleRibbonClick("rails")}
        >
          <RailsIcon />
        </RibbonButton>
        <RibbonButton
          active={tab === "ladders" && !collapsed}
          title="Ladders"
          onClick={() => handleRibbonClick("ladders")}
        >
          <LaddersIcon />
        </RibbonButton>
        <RibbonButton
          active={tab === "landings" && !collapsed}
          title="Landings"
          onClick={() => handleRibbonClick("landings")}
        >
          <LandingsIcon />
        </RibbonButton>
      </div>

      {!collapsed && (
        <div className="flex min-h-0 w-64 flex-col">
          <div className="flex items-center justify-between px-3 pt-3 pb-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/55">
              {TAB_TITLES[tab]}
            </div>
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              title="Collapse sidebar"
              className="rounded-md px-1.5 py-0.5 text-xs text-white/35 transition hover:bg-white/[0.06] hover:text-white/80"
            >
              ◂
            </button>
          </div>
          <div className="min-h-0 flex-1">
            {tab === "welcome" && (
              <WelcomeSection addActions={addActions} panelOpener={panelOpener} />
            )}
            {tab === "stairs" && (
              <StairsSection
                onAddStair={addActions.onAddStair}
                panelOpener={panelOpener}
              />
            )}
            {tab === "rails" && (
              <RailsSection
                onAddRail={addActions.onAddRail}
                panelOpener={panelOpener}
              />
            )}
            {tab === "ladders" && (
              <LaddersSection
                onAddLadder={addActions.onAddLadder}
                panelOpener={panelOpener}
              />
            )}
            {tab === "landings" && (
              <LandingsSection
                onAddLanding={addActions.onAddLanding}
                panelOpener={panelOpener}
              />
            )}
          </div>
        </div>
      )}
    </aside>
  );
}

function RibbonButton({
  active,
  title,
  onClick,
  children,
}: {
  active: boolean;
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`relative flex h-11 items-center justify-center transition ${
        active ? "text-white" : "text-white/45 hover:text-white/80"
      }`}
    >
      {active && (
        <span className="absolute inset-y-1 left-0 w-0.5 rounded-r bg-cyan-300/80" />
      )}
      {children}
    </button>
  );
}

function HomeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 11 12 4l9 7" />
      <path d="M5 10v10h14V10" />
      <path d="M10 20v-5h4v5" />
    </svg>
  );
}

function StairsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 20h4v-4h4v-4h4V8h4V4" />
      <path d="M3 20h18" />
    </svg>
  );
}

function RailsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7h18" />
      <path d="M3 12h18" />
      <path d="M6 4v16" />
      <path d="M12 4v16" />
      <path d="M18 4v16" />
    </svg>
  );
}

function LaddersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 3v18" />
      <path d="M17 3v18" />
      <path d="M7 7h10" />
      <path d="M7 12h10" />
      <path d="M7 17h10" />
    </svg>
  );
}

function LandingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="10" width="18" height="4" rx="1" />
      <path d="M6 14v6" />
      <path d="M18 14v6" />
    </svg>
  );
}
