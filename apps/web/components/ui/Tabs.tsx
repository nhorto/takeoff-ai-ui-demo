import * as TabsPrimitive from "@radix-ui/react-tabs";
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";
import { cx } from "@/components/ui/uiStyles";

export const Tabs = TabsPrimitive.Root;

export const TabsList = forwardRef<
  ElementRef<typeof TabsPrimitive.List>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(function TabsList({ className = "", ...props }, ref) {
  return (
    <TabsPrimitive.List
      ref={ref}
      className={cx(
        "flex items-center gap-1 rounded-md border border-white/8 bg-white/[0.025] p-1",
        className,
      )}
      {...props}
    />
  );
});

export const TabsTrigger = forwardRef<
  ElementRef<typeof TabsPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(function TabsTrigger({ className = "", ...props }, ref) {
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cx(
        "inline-flex items-center gap-1 rounded-md px-3 py-2 text-xs font-medium uppercase tracking-[0.12em] text-white/58 transition outline-none hover:bg-white/[0.04] hover:text-white/82 focus-visible:ring-2 focus-visible:ring-cyan-300/30 data-[state=active]:border-white/10 data-[state=active]:bg-slate-950/75 data-[state=active]:text-white data-[state=active]:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
        className,
      )}
      {...props}
    />
  );
});

export const TabsContent = forwardRef<
  ElementRef<typeof TabsPrimitive.Content>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(function TabsContent({ className = "", ...props }, ref) {
  return (
    <TabsPrimitive.Content
      ref={ref}
      className={`outline-none ${className}`}
      {...props}
    />
  );
});
