"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type CopyButtonProps = {
  value: string;
  label?: string;
  variant?: "light" | "dark";
};

export function CopyButton({ value, label = "Copy", variant = "light" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  async function handleCopy() {
    try {
      await navigator.clipboard?.writeText(value);
      setCopied(true);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be unavailable (older browsers, insecure contexts). No-op.
    }
  }

  const base =
    "inline-flex shrink-0 items-center gap-1 rounded px-2 py-1 text-xs font-medium transition";
  const tone =
    variant === "dark"
      ? "text-slate-300 hover:bg-slate-800 hover:text-white"
      : "border border-slate-200 text-slate-600 hover:border-teal-300 hover:text-teal-800";

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? `${label} (copied)` : label}
      className={`${base} ${tone}`}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : label}
    </button>
  );
}
