import { useMediaQuery } from "../../hooks/useMediaQuery.js";

// Same one-line pattern as useIsMobileDealer.js / useIsMobileDispatcher.js -
// kept as its own per-role file rather than a shared generic hook so each
// role can independently change its breakpoint later without touching the
// others.
export function useIsMobileAdmin() {
  return useMediaQuery("(max-width: 768px)");
}
