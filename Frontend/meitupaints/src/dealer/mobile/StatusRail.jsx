import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";
import { buildOrderMilestones } from "../orderDetailLogic.js";

// 4-node progress track, sizes "sm" (Home card) and "lg" (order detail) -
// driven by buildOrderMilestones(order) (orderDetailLogic.js), which already
// derives done/current/upcoming state and real timestamps from the same
// order.review/order.factory.* fields the admin/factory dashboards write.
// Returns null for REJECTED/CANCELLED (buildOrderMilestones' own contract) -
// callers render the off-ramp treatment themselves (spec §4.5.2), since a
// progress track can't honestly represent a terminal rejection as "progress".
const RAIL_LABELS = ["Submitted", "Verified", "Dispatched", "Completed"];

export function StatusRail({ order, size = "sm" }) {
  const milestones = buildOrderMilestones(order);
  if (!milestones) return null;
  // V3 §5.3: progressive fill, order-detail's "lg" rail only (the "sm"
  // Home card rail already sits inside that card's own entrance stagger -
  // a second, independent stagger on top would fight it).
  const stagger = size === "lg";

  return (
    <div className={`dealer-m-status-rail dealer-m-status-rail-${size}`}>
      {milestones.map((milestone, index) => (
        <div
          className={`dealer-m-status-rail-node ${stagger ? "dealer-m-status-rail-node-stagger" : ""}`}
          style={stagger ? { animationDelay: `${index * 150}ms` } : undefined}
          key={milestone.key}
        >
          {index < milestones.length - 1 ? (
            <div className={`dealer-m-status-rail-line dealer-m-status-rail-line-${milestone.state === "done" ? "done" : "pending"}`} />
          ) : null}
          <div className={`dealer-m-status-rail-dot dealer-m-status-rail-dot-${milestone.state}`}>
            {milestone.state === "done" ? (
              <DashboardIcon name="checkmark" size={size === "lg" ? 13 : 10} strokeWidth={2.8} />
            ) : null}
          </div>
          {size === "lg" ? <div className="dealer-m-status-rail-label">{RAIL_LABELS[index]}</div> : null}
        </div>
      ))}
    </div>
  );
}
