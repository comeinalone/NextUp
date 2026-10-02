import { useState } from "react";
import { useToast } from "./Toast";

const VARIANTS = {
  primary: "bg-brand text-[#e9f8ee] hover:bg-brand-hover",
  secondary: "bg-inset text-ink border border-control hover:bg-notice",
  danger: "bg-critical text-white hover:opacity-90",
  ghost: "text-[#285b48] underline hover:bg-inset",
};

/**
 * onClick may be async. While it runs the button is disabled (no double-clicks),
 * and a thrown error is shown as a toast, so pages don't need their own try/catch.
 */
export default function Button({ variant = "primary", onClick, disabled, children, className = "", ...rest }) {
  const [pending, setPending] = useState(false);
  const toast = useToast();

  async function handle(e) {
    if (pending) return;
    setPending(true);
    try {
      await onClick?.(e);
    } catch (err) {
      toast.error(err?.message ?? "Something went wrong. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      {...rest}
      onClick={handle}
      disabled={disabled || pending}
      className={`inline-flex items-center justify-center gap-2 min-h-[44px] rounded-[6px] px-4 py-2.5 text-[13px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
