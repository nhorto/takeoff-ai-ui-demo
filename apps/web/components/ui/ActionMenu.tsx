import type { ReactNode } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { buttonClass } from "@/components/ui/uiStyles";

export function ActionMenu({
  label,
  children,
  align = "end",
}: {
  label: string;
  children: ReactNode;
  align?: "start" | "center" | "end";
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={`${buttonClass.icon} opacity-40 group-hover:opacity-100 group-focus-within:opacity-100 data-[state=open]:border-white/12 data-[state=open]:bg-white/[0.08] data-[state=open]:text-white/90`}
          aria-label={label}
          title={label}
        >
          <DotsIcon />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="min-w-[180px]">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DotsIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="19" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
