import { useMemo } from "react";

import { useGetAdminCashPositionQuery } from "../../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../../redux/api/selectors.js";
import { Surface } from "../../../../components/dashboard/DashboardUI.jsx";
import { KpiTile } from "../InsightsPrimitives.jsx";
import { money, number, percent } from "../insightsFormatting.js";
import { CURRENCY, twoColStyle, kpiRowStyle } from "./sectionLayout.js";
import { PanelHead, ErrorBanner } from "./sectionShared.jsx";
import RevenueTrendChart from "./charts/RevenueTrendChart.jsx";
import MagnitudeBarChart from "./charts/MagnitudeBarChart.jsx";

export default function CashPositionSection({ dateFilters }) {
  const query = useGetAdminCashPositionQuery(dateFilters);
  const data = query.data;
  const loading = query.isLoading && !data;
  const error = query.error ? getQueryErrorMessage(query.error, "Failed to load cash position.") : "";

  const trendPoints = useMemo(
    () => (data?.trend || []).map((point) => ({ label: String(point.date).slice(0, 10), revenue: point.revenue })),
    [data],
  );

  const paymentMixItems = useMemo(
    () => (data?.paymentMix || []).map((row) => ({ label: row.method, value: row.revenue })),
    [data],
  );

  const kpis = data?.kpis || {};

  if (error) return <ErrorBanner message={error} />;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={kpiRowStyle()}>
        <KpiTile icon="invoice" label="Revenue" value={loading ? "…" : money(kpis.revenue, CURRENCY)} tone="accent" />
        <KpiTile icon="orders" label="Orders" value={loading ? "…" : number(kpis.orderCount)} />
        <KpiTile icon="chart" label="Avg Order Value" value={loading ? "…" : money(kpis.averageOrderValue, CURRENCY)} />
        <KpiTile
          icon="trend"
          label="Revenue Growth"
          value={loading || kpis.revenueGrowth === null ? "—" : percent(kpis.revenueGrowth)}
          direction={Number(kpis.revenueGrowth || 0) >= 0 ? "up" : "down"}
        />
        <KpiTile
          icon="invoice"
          label="Outstanding AR"
          value={loading ? "…" : money(kpis.outstandingAr, CURRENCY)}
          tone={Number(kpis.outstandingAr || 0) < 0 ? "accent" : "neutral"}
          helper={Number(kpis.outstandingAr || 0) < 0 ? "Net dealer credit" : "Owed to Meitu"}
        />
        <KpiTile
          icon="warning"
          label="Overdue AR"
          value={loading ? "…" : money(kpis.overdueAr, CURRENCY)}
          helper="Outstanding past 30 days"
        />
      </div>

      <div style={twoColStyle()}>
        <Surface padding={0}>
          <PanelHead eyebrow="Revenue" icon="chart" title="Revenue over time" />
          <RevenueTrendChart data={trendPoints} currency={CURRENCY} />
        </Surface>
        <Surface padding={0}>
          <PanelHead eyebrow="Composition" icon="invoice" title="Payment method mix" />
          <MagnitudeBarChart
            items={paymentMixItems}
            formatValue={(v) => money(v, CURRENCY)}
            empty="No accepted orders in this window."
          />
        </Surface>
      </div>
    </div>
  );
}
