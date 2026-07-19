import { useEffect, useState } from "react";

// .dashboard-main-shell's own top padding (14-18px depending on breakpoint)
// sits INSIDE its scrollport, not outside it - any element that wants to
// pin flush at the true top of the visible viewport (a compact header, a
// sticky day-divider) needs `top: -insetTop` rather than `top:0`, or a gap
// the size of that padding lets content peek through above it mid-scroll.
// Shared by LargeTitleHeader.jsx and DealerSalesMobileView.jsx's sticky day
// headers rather than each re-measuring it independently.
export function useScrollInset() {
  const [insetTop, setInsetTop] = useState(0);

  useEffect(() => {
    const scrollEl = document.querySelector(".dashboard-main-shell");
    if (!scrollEl) return undefined;
    function measure() {
      setInsetTop(parseFloat(getComputedStyle(scrollEl).paddingTop) || 0);
    }
    measure();
  }, []);

  return insetTop;
}
