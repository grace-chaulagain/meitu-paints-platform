import { useMediaQuery } from "../../hooks/useMediaQuery.js";

// Same breakpoint as useIsMobileDealer.js - one shared cutoff so every
// dispatcher mobile screen/component agrees on exactly the same value.
export function useIsMobileDispatcher() {
  return useMediaQuery("(max-width: 768px)");
}
