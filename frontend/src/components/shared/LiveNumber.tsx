"use client";

import { motion, AnimatePresence } from "framer-motion";

interface LiveNumberProps {
  value: string | number;
  className?: string;
}

/**
 * Wraps a number display with a Framer Motion key-based flash animation.
 * Every time `value` changes the component re-mounts with a brief scale pulse.
 */
export function LiveNumber({ value, className }: LiveNumberProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={String(value)}
        className={className}
        initial={{ scale: 1.06, opacity: 0.7 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        {value}
      </motion.span>
    </AnimatePresence>
  );
}
