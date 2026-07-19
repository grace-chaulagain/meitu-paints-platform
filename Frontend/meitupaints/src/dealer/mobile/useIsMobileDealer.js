import { useMediaQuery } from "../../hooks/useMediaQuery.js";

// Spec target: <=768px (design target 390px). One shared breakpoint so
// every dealer mobile screen/component agrees on exactly the same cutoff.
export function useIsMobileDealer() {
  return useMediaQuery("(max-width: 768px)");
}
