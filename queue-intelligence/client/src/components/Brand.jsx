import { ArrowUpRight } from "lucide-react";

// NextUp wordmark. If the manager UI already has a Brand component, use that one instead.
export default function Brand({ className = "" }) {
  return (
    <a href="/" className={`inline-flex items-center gap-2.5 text-[23px] font-bold tracking-[-1px] sm:text-[26px] ${className}`}>
      <span className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-brand-light text-brand-icon sm:h-[33px] sm:w-[33px]">
        <ArrowUpRight className="h-[18px] w-[18px] sm:h-[23px] sm:w-[23px]" aria-hidden="true" />
      </span>
      <span>NextUp<span className="text-brand-light">.</span></span>
    </a>
  );
}
