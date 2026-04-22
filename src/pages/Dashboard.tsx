import { useEffect, useMemo, useState } from "react";
import { Row, Col, App as AntdApp, Skeleton } from "antd";
import {
  DesktopOutlined,
  CheckCircleOutlined,
  BugOutlined,
  CloudSyncOutlined,
  AlertOutlined,
  FireOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from "@ant-design/icons";
import type { ReactNode } from "react";
import { s1, DashboardCounts } from "../api/s1";
import { useT } from "../i18n";
import Sparkline from "../components/Sparkline";
import ThreatTimeline from "../components/ThreatTimeline";

type Tone = "brand" | "info" | "success" | "danger" | "warning";

interface CardSpec {
  labelKey: string;
  key: keyof DashboardCounts;
  tone: Tone;
  icon: ReactNode;
  emphasis?: "danger" | "warning";
}

const CARDS: CardSpec[] = [
  { labelKey: "dash.agentsTotal", key: "agents_total", tone: "brand", icon: <DesktopOutlined /> },
  { labelKey: "dash.agentsActive", key: "agents_active", tone: "success", icon: <CheckCircleOutlined /> },
  {
    labelKey: "dash.agentsInfected",
    key: "agents_infected",
    tone: "danger",
    icon: <BugOutlined />,
    emphasis: "danger",
  },
  {
    labelKey: "dash.agentsOutOfDate",
    key: "agents_out_of_date",
    tone: "warning",
    icon: <CloudSyncOutlined />,
    emphasis: "warning",
  },
  { labelKey: "dash.threatsUnresolved", key: "threats_unresolved", tone: "danger", icon: <AlertOutlined /> },
  { labelKey: "dash.threatsTotal", key: "threats_total", tone: "info", icon: <FireOutlined /> },
];

const TONE_TO_VARS: Record<Tone, { color: string; soft: string }> = {
  brand: { color: "var(--brand)", soft: "var(--brand-soft)" },
  info: { color: "var(--color-info)", soft: "var(--color-info-soft)" },
  success: { color: "var(--color-success)", soft: "var(--color-success-soft)" },
  danger: { color: "var(--color-danger)", soft: "var(--color-danger-soft)" },
  warning: { color: "var(--color-warning)", soft: "var(--color-warning-soft)" },
};

/** Deterministic pseudo-random based on a string seed, 0..1. */
function seededRandom(seed: string, i: number): number {
  let h = 2166136261;
  for (let k = 0; k < seed.length; k++) h = (h ^ seed.charCodeAt(k)) * 16777619;
  h = (h ^ i) * 16777619;
  return ((h >>> 0) % 1000) / 1000;
}

function mockSeries(seed: string, points: number, base: number): number[] {
  if (base <= 0) return Array(points).fill(0);
  return Array.from({ length: points }, (_, i) => {
    const drift = (seededRandom(seed, i) - 0.5) * 0.6 + 0.7;
    return Math.max(0, Math.round(base * drift));
  });
}

function mockTrend(seed: string): number {
  const v = seededRandom(seed, 99) * 40 - 20;
  return Math.round(v * 10) / 10;
}

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

  const timelineData = useMemo(
    () => mockSeries(`timeline-${counts?.threats_total ?? 10}`, 24, Math.max(counts?.threats_total ?? 10, 5)),
    [counts?.threats_total],
  );

  return (
    <div className="page-transition">
      <Row gutter={[16, 16]}>
        {CARDS.map((c) => {
          const tone = TONE_TO_VARS[c.tone];
          const value = counts ? counts[c.key] : null;
          const series = mockSeries(String(c.key), 14, Math.max(Number(value ?? 0), 1));
          const trend = mockTrend(String(c.key));
          const emphasisClass =
            c.emphasis === "danger" && (value ?? 0) > 0
              ? " is-danger"
              : c.emphasis === "warning" && (value ?? 0) > 0
                ? " is-warning"
                : "";
          return (
            <Col xs={12} md={8} xl={4} key={c.key}>
              <div
                className={`stat-card${emphasisClass}`}
                style={{
                  ["--stat-color" as string]: tone.color,
                  ["--stat-soft" as string]: tone.soft,
                }}
              >
                <div className="stat-head">
                  <div className="label">{t(c.labelKey)}</div>
                  <div className="stat-icon">{c.icon}</div>
                </div>
                {loading ? (
                  <Skeleton.Button active size="large" style={{ width: 80, marginTop: 8 }} />
                ) : (
                  <div className="value">{value ?? "--"}</div>
                )}
                <div className={`trend ${trend > 0 ? "up" : "down"}`}>
                  {trend > 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                  {Math.abs(trend).toFixed(1)}% {t("dash.trendUp")}
                </div>
                <Sparkline data={series} color={tone.color} />
              </div>
            </Col>
          );
        })}
      </Row>

      <div style={{ marginTop: 16 }}>
        <ThreatTimeline data={timelineData} />
      </div>
    </div>
  );
}
