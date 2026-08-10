import { useState } from "react";

import { TabBar } from "../../../../components/dashboard/DashboardUI.jsx";
import DealersPerformanceTab from "./performance/DealersPerformanceTab.jsx";
import ProductsPerformanceTab from "./performance/ProductsPerformanceTab.jsx";
import DispatchersPerformanceTab from "./performance/DispatchersPerformanceTab.jsx";
import RoutingPerformanceTab from "./performance/RoutingPerformanceTab.jsx";

const SUB_TABS = [
  { key: "dealers", label: "Dealers" },
  { key: "products", label: "Products" },
  { key: "dispatchers", label: "Dispatchers" },
  { key: "routing", label: "Routing" },
];

// Secondary lens per the account-keeping rebuild: the old Dealers/Products/
// Dispatchers/Routing top-level tabs are demoted here, under one Performance
// tab, expressed with TabBar (visually lighter than the top-level
// SegmentedControl) so "secondary" is a real component distinction, not
// just documentation.
export default function PerformanceSection({ dateFilters }) {
  const [subTab, setSubTab] = useState("dealers");

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <TabBar value={subTab} onChange={setSubTab} options={SUB_TABS} />
      {subTab === "dealers" ? <DealersPerformanceTab /> : null}
      {subTab === "products" ? <ProductsPerformanceTab dateFilters={dateFilters} /> : null}
      {subTab === "dispatchers" ? <DispatchersPerformanceTab dateFilters={dateFilters} /> : null}
      {subTab === "routing" ? <RoutingPerformanceTab dateFilters={dateFilters} /> : null}
    </div>
  );
}
