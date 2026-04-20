import { useState, type ReactNode } from "react";
import { WelcomeSection } from "@/components/sidebar/WelcomeSection";
import { StairsSection } from "@/components/sidebar/StairsSection";
import { RailsSection } from "@/components/sidebar/RailsSection";
import { LaddersSection } from "@/components/sidebar/LaddersSection";
import { LandingsSection } from "@/components/sidebar/LandingsSection";
import type { AddActions, PanelOpener } from "@/components/sidebar/types";
import { buttonClass, cx } from "@/components/ui/uiStyles";

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
  collapsed,
  onCollapsedChange,
}: {
  addActions: AddActions;
  panelOpener: PanelOpener;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}) {
  const [tab, setTab] = useState<Tab>("stairs");

  function handleRibbonClick(next: Tab) {
    if (next === tab && !collapsed) {
      onCollapsedChange(true);
      return;
    }
    setTab(next);
    onCollapsedChange(false);
  }

  return (
    <aside className="flex min-h-0 border-b border-slate-300/10 bg-white/[0.025] md:border-b-0 md:border-r md:border-r-slate-300/10">
      <div className="flex w-12 shrink-0 flex-col items-stretch border-r border-slate-300/12 bg-slate-950/35 py-2">
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
          <div className="flex items-center justify-between border-b border-slate-300/12 px-3 pt-3 pb-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/56">
              {TAB_TITLES[tab]}
            </div>
            <button
              type="button"
              onClick={() => onCollapsedChange(true)}
              title="Collapse sidebar"
              className={cx(buttonClass.icon, "h-7 w-7 text-white/44")}
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
      className={cx(
        "relative mx-1.5 my-0.5 flex h-10 items-center justify-center rounded-md border border-transparent transition",
        active
          ? "border-white/8 bg-white/[0.08] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
          : "text-white/46 hover:border-white/6 hover:bg-white/[0.04] hover:text-white/82",
      )}
    >
      {active && (
        <span className="absolute inset-y-1 left-[-7px] w-0.5 rounded-r bg-cyan-300/90" />
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
