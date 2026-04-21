import * as SelectPrimitive from "@radix-ui/react-select";
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";
import { cx } from "@/components/ui/uiStyles";

export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;

export const SelectTrigger = forwardRef<
  ElementRef<typeof SelectPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(function SelectTrigger({ className = "", children, ...props }, ref) {
  return (
    <SelectPrimitive.Trigger
      ref={ref}
      className={cx(
        "inline-flex w-full items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] outline-none transition hover:border-white/18 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/20 data-[placeholder]:text-white/45",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon className="text-white/52">▾</SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
});

export const SelectContent = forwardRef<
  ElementRef<typeof SelectPrimitive.Content>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(function SelectContent(
  { className = "", position = "popper", sideOffset = 4, children, ...props },
  ref,
) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={ref}
        position={position}
        sideOffset={sideOffset}
        className={`z-50 overflow-hidden rounded-lg border border-white/[0.08] bg-[#2d2d30] text-sm text-white shadow-xl shadow-black/40 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 ${className}`}
        {...props}
      >
        <SelectPrimitive.Viewport className="p-1 min-w-[var(--radix-select-trigger-width)]">
          {children}
        </SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
});

export const SelectItem = forwardRef<
  ElementRef<typeof SelectPrimitive.Item>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(function SelectItem({ className = "", children, ...props }, ref) {
  return (
    <SelectPrimitive.Item
      ref={ref}
      className={`relative flex cursor-pointer select-none items-center rounded-md px-2 py-1.5 text-sm outline-none transition hover:bg-white/[0.08] focus:bg-white/[0.08] data-[state=checked]:bg-cyan-300/10 data-[state=checked]:text-cyan-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-40 ${className}`}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
});
