// Dashboard pages scroll inside DashboardShell's own container (not the
// window), so paging needs to scroll that element back to top. Falls back
// to window scrolling for any usage outside a dashboard shell (e.g. a plain
// page). Respects prefers-reduced-motion like every other scroll/animation
// in this codebase.
export function scrollResultsToTop() {
  const behavior = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  const shell = document.querySelector(".dashboard-main-shell");
  if (shell) {
    shell.scrollTo({ top: 0, left: 0, behavior });
  } else {
    window.scrollTo({ top: 0, left: 0, behavior });
  }
}
