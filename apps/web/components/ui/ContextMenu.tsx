import * as ContextMenuPrimitive from "@radix-ui/react-context-menu";
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";

export const ContextMenu = ContextMenuPrimitive.Root;
export const ContextMenuTrigger = ContextMenuPrimitive.Trigger;
export const ContextMenuPortal = ContextMenuPrimitive.Portal;
export const ContextMenuSub = ContextMenuPrimitive.Sub;

const contentClass =
  "z-50 min-w-[160px] overflow-hidden rounded-lg border border-white/10 bg-slate-950/95 p-1 text-sm text-white/85 shadow-xl shadow-black/40 backdrop-blur data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0";

const itemClass =
  "relative flex cursor-pointer select-none items-center rounded-md px-2 py-1.5 text-sm outline-none transition hover:bg-white/[0.08] focus:bg-white/[0.08] data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[destructive]:text-red-300 data-[destructive]:hover:bg-red-500/15 data-[destructive]:focus:bg-red-500/15";

export const ContextMenuContent = forwardRef<
  ElementRef<typeof ContextMenuPrimitive.Content>,
  ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Content>
>(function ContextMenuContent({ className = "", ...props }, ref) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Content
        ref={ref}
        className={`${contentClass} ${className}`}
        {...props}
      />
    </ContextMenuPrimitive.Portal>
  );
});

export const ContextMenuItem = forwardRef<
  ElementRef<typeof ContextMenuPrimitive.Item>,
  ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Item> & {
    destructive?: boolean;
  }
>(function ContextMenuItem({ className = "", destructive, ...props }, ref) {
  return (
    <ContextMenuPrimitive.Item
      ref={ref}
      data-destructive={destructive ? "" : undefined}
      className={`${itemClass} ${className}`}
      {...props}
    />
  );
});

export const ContextMenuSeparator = forwardRef<
  ElementRef<typeof ContextMenuPrimitive.Separator>,
  ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Separator>
>(function ContextMenuSeparator({ className = "", ...props }, ref) {
  return (
    <ContextMenuPrimitive.Separator
      ref={ref}
      className={`my-1 h-px bg-white/8 ${className}`}
      {...props}
    />
  );
});
