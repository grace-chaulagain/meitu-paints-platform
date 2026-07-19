import { useMemo } from "react";
import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";
import {
  formatDayHeading,
  formatTimeOnly,
  localDayKey,
  movementDelta,
  movementLabel,
  movementReference,
  getPrimaryImage,
} from "../inventory/inventoryHelpers.js";

const TYPE_ICONS = {
  PURCHASE: "download",
  SALE: "trend",
  RETURN: "history",
  ADJUSTMENT: "gear",
  TRANSFER_IN: "download",
  TRANSFER_OUT: "trend",
};

// Shared by DealerInventoryMobileView (dealer-wide history, showProduct=true)
// and DealerInventoryDetailMobileView (one product's own history,
// showProduct=false) - spec §4.1 calls for the same movement card-list
// component in both places rather than two bespoke row renderers.
export function MovementCardList({ items = [], showProduct = true }) {
  const dayGroups = useMemo(() => {
    const groups = [];
    const byKey = new Map();
    for (const movement of items) {
      const key = localDayKey(movement.createdAt);
      let group = byKey.get(key);
      if (!group) {
        group = { key, label: formatDayHeading(movement.createdAt), rows: [] };
        byKey.set(key, group);
        groups.push(group);
      }
      group.rows.push(movement);
    }
    return groups;
  }, [items]);

  return (
    <div className="dealer-m-movement-list">
      {dayGroups.map((group) => (
        <div key={group.key} className="dealer-m-movement-day">
          <div className="dealer-m-movement-day-label">{group.label}</div>
          {group.rows.map((movement) => {
            const delta = movementDelta(movement);
            const isIn = delta >= 0;
            const product = movement.productId;
            const image = showProduct ? getPrimaryImage(product?.images) : null;
            return (
              <div className="dealer-m-movement-card" key={movement._id}>
                {showProduct ? (
                  <span className="dealer-m-movement-thumb">
                    {image?.url ? <img src={image.url} alt="" /> : <DashboardIcon name="package" size={16} strokeWidth={1.6} />}
                  </span>
                ) : (
                  <span className={`dealer-m-movement-icon ${isIn ? "in" : "out"}`}>
                    <DashboardIcon name={TYPE_ICONS[movement.type] || "history"} size={14} strokeWidth={1.8} />
                  </span>
                )}
                <span className="dealer-m-movement-body">
                  <span className="dealer-m-movement-title">{showProduct ? product?.name || "—" : movementLabel(movement.type)}</span>
                  <span className="dealer-m-movement-sub">
                    {formatTimeOnly(movement.createdAt)} &middot; {movementReference(movement)}
                  </span>
                </span>
                <span className="dealer-m-movement-right">
                  <span className={`dealer-m-movement-delta ${isIn ? "in" : "out"}`}>
                    {isIn ? "+" : ""}
                    {delta}
                  </span>
                  <span className="dealer-m-movement-balance">{movement.newQuantity}</span>
                </span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
