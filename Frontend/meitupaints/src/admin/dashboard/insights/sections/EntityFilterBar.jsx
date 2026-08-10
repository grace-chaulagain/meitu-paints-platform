import { useMemo } from "react";
import { AppleDropdown } from "../../../../components/dashboard/ApplePickers.jsx";
import {
  useGetAdminDealersQuery,
  useGetAdminDispatchersQuery,
} from "../../../../redux/api/meituApi.js";
import { BASE_ROUTE_OPTIONS, routeToParams } from "./entityScope.js";

export default function EntityFilterBar({
  route,
  dealerId,
  onRouteChange,
  onDealerChange,
  dealerDisabled = false,
  dealerDisabledReason = "",
}) {
  const dispatchersQuery = useGetAdminDispatchersQuery({ limit: 200 });
  const dealersQuery = useGetAdminDealersQuery({ limit: 500 });

  const routeOptions = useMemo(() => {
    const dispatchers = dispatchersQuery.data?.items || [];
    return [
      ...BASE_ROUTE_OPTIONS,
      ...dispatchers.map((dispatcher) => ({
        key: `DISPATCHER:${dispatcher._id}`,
        label: `↳ ${dispatcher.companyName || dispatcher.contactName || "Dispatcher"}`,
      })),
    ];
  }, [dispatchersQuery.data]);

  // Dealers are scoped to the chosen route so the two pickers can't be put
  // into a contradictory state (e.g. a factory dealer selected while the
  // route says "via dispatcher", which would return an empty view).
  const dealerOptions = useMemo(() => {
    const dealers = dealersQuery.data?.items || [];
    const params = routeToParams(route);
    const filtered = dealers.filter((dealer) => {
      if (params.dispatcherId) {
        return String(dealer.dispatcherId || "") === params.dispatcherId;
      }
      if (params.fulfillmentMode) {
        return String(dealer.fulfillmentMode || "FACTORY") === params.fulfillmentMode;
      }
      return true;
    });

    return [
      { key: "", label: "All dealers" },
      ...filtered.map((dealer) => ({
        key: String(dealer._id),
        label: dealer.companyName || dealer.contactName || "Dealer",
      })),
    ];
  }, [dealersQuery.data, route]);

  return (
    <>
      <AppleDropdown
        value={route}
        options={routeOptions}
        onChange={onRouteChange}
        placeholder="Route"
        icon="truck"
        style={{ minWidth: 210 }}
      />

      <span
        className={dealerDisabled ? "iw-filter-disabled" : ""}
        title={dealerDisabled ? dealerDisabledReason : undefined}
      >
        <AppleDropdown
          value={dealerId}
          options={dealerOptions}
          onChange={dealerDisabled ? () => {} : onDealerChange}
          placeholder="Dealer"
          icon="store"
          style={{ minWidth: 200 }}
        />
      </span>

      <style>{`
        .iw-filter-disabled{
          display:inline-block;
          opacity:.45;
          pointer-events:none;
          filter:saturate(0);
        }
      `}</style>
    </>
  );
}
