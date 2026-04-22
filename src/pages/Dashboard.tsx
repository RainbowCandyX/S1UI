import { useEffect, useState } from "react";
import { Row, Col, Card, Spin, App as AntdApp } from "antd";
import { s1, DashboardCounts } from "../api/s1";
import { useT } from "../i18n";

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<DashboardCounts | null>(null);
  const { message } = AntdApp.useApp();
  const t = useT();

  useEffect(() => {
    s1.dashboardCounts()
      .then(setCounts)
      .catch((e) => message.error(`${t("dash.loadFailed")}: ${(e as Error).message}`))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message]);

  const cards: { labelKey: string; key: keyof DashboardCounts; color: string }[] = [
    { labelKey: "dash.agentsTotal", key: "agents_total", color: "#1677ff" },
    { labelKey: "dash.agentsActive", key: "agents_active", color: "#52c41a" },
    { labelKey: "dash.agentsInfected", key: "agents_infected", color: "#ff4d4f" },
    { labelKey: "dash.agentsOutOfDate", key: "agents_out_of_date", color: "#faad14" },
    { labelKey: "dash.threatsUnresolved", key: "threats_unresolved", color: "#ff7a45" },
    { labelKey: "dash.threatsTotal", key: "threats_total", color: "#6e29f0" },
  ];

  return (
    <Spin spinning={loading}>
      <Row gutter={[16, 16]}>
        {cards.map((c) => (
          <Col xs={12} md={8} xl={4} key={c.key}>
            <Card className="stat-card" bordered={false}>
              <div className="label">{t(c.labelKey)}</div>
              <div className="value" style={{ color: c.color }}>
                {counts ? counts[c.key] : "--"}
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    </Spin>
  );
}
