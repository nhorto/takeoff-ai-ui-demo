import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuPortal = DropdownMenuPrimitive.Portal;

const contentClass =
  "z-50 min-w-[160px] overflow-hidden rounded-lg border border-white/10 bg-slate-950/95 p-1 text-sm text-white/85 shadow-xl shadow-black/40 backdrop-blur data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0";

const itemClass =
  "relative flex cursor-pointer select-none items-center rounded-md px-2 py-1.5 text-sm outline-none transition hover:bg-white/[0.08] focus:bg-white/[0.08] data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[destructive]:text-red-300 data-[destructive]:hover:bg-red-500/15 data-[destructive]:focus:bg-red-500/15";

export const DropdownMenuContent = forwardRef<
  ElementRef<typeof DropdownMenuPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(function DropdownMenuContent(
  { className = "", sideOffset = 4, align = "end", ...props },
  ref,
) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        align={align}
        className={`${contentClass} ${className}`}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
});

export const DropdownMenuItem = forwardRef<
  ElementRef<typeof DropdownMenuPrimitive.Item>,
  ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
    destructive?: boolean;
  }
>(function DropdownMenuItem({ className = "", destructive, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.Item
      ref={ref}
      data-destructive={destructive ? "" : undefined}
      className={`${itemClass} ${className}`}
      {...props}
    />
  );
});

export const DropdownMenuSeparator = forwardRef<
  ElementRef<typeof DropdownMenuPrimitive.Separator>,
  ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(function DropdownMenuSeparator({ className = "", ...props }, ref) {
  return (
    <DropdownMenuPrimitive.Separator
      ref={ref}
      className={`my-1 h-px bg-white/8 ${className}`}
      {...props}
    />
  );
});
