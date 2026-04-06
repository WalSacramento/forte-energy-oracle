"use client";

import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface LiveNumberProps {
  value: string | number;
  className?: string;
}

export function LiveNumber({ value, className }: LiveNumberProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={String(value)}
        className={cn("font-mono tabular-nums", className)}
        initial={{ scale: 1.04, opacity: 0.7 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        {value}
      </motion.span>
    </AnimatePresence>
  );
}
