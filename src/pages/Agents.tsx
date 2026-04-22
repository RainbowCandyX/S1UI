import { useMemo, useState } from "react";
import { Button, Dropdown, Space, Switch, App as AntdApp } from "antd";
import { DownOutlined } from "@ant-design/icons";
import type { TableColumnsType } from "antd";
import ResourceTable from "../components/ResourceTable";
import ColumnPicker, { ColumnOption } from "../components/ColumnPicker";
import StatusBadge from "../components/StatusBadge";
import DetailDrawer, { DetailSection } from "../components/DetailDrawer";
import { s1, Agent, NetworkInterface } from "../api/s1";
import { formatLocalTime } from "../utils/time";
import { useT } from "../i18n";

type TFn = (key: string, vars?: Record<string, string | number>) => string;

function buildAgentSections(a: Agent, t: TFn): DetailSection[] {
  const osLine = [a.os_name, a.os_revision].filter(Boolean).join(" ") || undefined;

  const basic: DetailSection = {
    title: t("agents.section.basic"),
    rows: [
      { key: "os", label: t("agents.col.os_name"), value: osLine },
      { key: "ver", label: t("agents.col.agent_version"), value: a.agent_version },
      {
        key: "utd",
        label: t("agents.col.is_up_to_date"),
        value:
          a.is_up_to_date === undefined
            ? undefined
            : a.is_up_to_date
              ? t("common.yes")
              : t("common.no"),
      },
      { key: "domain", label: t("agents.col.domain"), value: a.domain },
      { key: "site", label: t("agents.col.site_name"), value: a.site_name },
      { key: "group", label: t("agents.col.group_name"), value: a.group_name },
      { key: "uuid", label: t("agents.col.uuid"), value: a.uuid },
      { key: "reg", label: t("agents.col.registered_at"), value: formatLocalTime(a.registered_at || "") },
      { key: "last", label: t("agents.col.last_active_date"), value: formatLocalTime(a.last_active_date || "") },
      { key: "threats", label: t("agents.col.active_threats"), value: a.active_threats },
    ],
  };

  const hardware: DetailSection = {
    title: t("agents.section.hardware"),
    rows: [
      { key: "type", label: t("agents.col.machine_type"), value: a.machine_type },
      { key: "cpu_id", label: t("agents.col.cpu_id"), value: a.cpu_id },
      { key: "cpu_count", label: t("agents.col.cpu_count"), value: a.cpu_count },
      { key: "core_count", label: t("agents.col.core_count"), value: a.core_count },
      { key: "mem", label: t("agents.col.total_memory"), value: formatMemoryMB(a.total_memory) },
    ],
  };

  const networkBasic: DetailSection = {
    title: t("agents.section.network"),
    rows: [
      { key: "net_status", label: t("agents.col.network_status"), value: a.network_status },
      { key: "ext_ip", label: t("agents.col.external_ip"), value: a.external_ip },
      { key: "int_ip", label: t("agents.col.internal_ip"), value: firstInternalIp(a) },
    ],
  };

  const ifaceSections: DetailSection[] = (a.network_interfaces ?? []).map(
    (iface: NetworkInterface, idx: number) => ({
      title: t("agents.section.nicIndexed", { n: idx + 1 }),
      rows: [
        { key: "name", label: t("agents.nic.name"), value: iface.name },
        {
          key: "ipv4",
          label: t("agents.nic.ipv4"),
          value: iface.inet && iface.inet.length ? iface.inet.join(", ") : undefined,
        },
        {
          key: "ipv6",
          label: t("agents.nic.ipv6"),
          value: iface.inet6 && iface.inet6.length ? iface.inet6.join(", ") : undefined,
        },
        { key: "mac", label: t("agents.nic.mac"), value: iface.physical },
      ],
    }),
  );

  return [basic, hardware, networkBasic, ...ifaceSections];
}

function formatMemoryMB(mb?: number): string {
  if (!mb || mb <= 0) return "—";
  const gb = mb / 1024;
  if (gb >= 1) return `${gb.toFixed(gb >= 10 ? 0 : 1)} GB`;
  return `${mb.toFixed(0)} MB`;
}

function cpuSummary(r: Agent): string {
  const parts: string[] = [];
  if (r.cpu_id) parts.push(r.cpu_id);
  if (r.core_count) parts.push(`${r.core_count}C`);
  if (r.cpu_count && r.cpu_count > 1) parts.push(`× ${r.cpu_count}`);
  return parts.join(" ") || "—";
}

function firstInternalIp(r: Agent): string {
  if (r.last_ip_to_connect) return r.last_ip_to_connect;
  const first = r.network_interfaces?.[0];
  return first?.inet?.[0] ?? "—";
}

function firstMac(r: Agent): string {
  return r.network_interfaces?.find((i) => i.physical)?.physical ?? "—";
}

const ACTION_KEYS = [
  "disconnect",
  "connect",
  "shutdown",
  "restart",
  "initiate-scan",
  "abort-scan",
  "fetch-logs",
  "uninstall",
  "update-software",
];

const PROTECTION_KEYS = ["enable-protection", "disable-protection"];

const DEFAULT_VISIBLE = [
  "computer_name",
  "is_active",
  "os_name",
  "machine_type",
  "agent_version",
  "is_up_to_date",
  "last_active_date",
];

const ALL_COLUMN_KEYS = [
  "computer_name",
  "is_active",
  "os_name",
  "machine_type",
  "agent_version",
  "is_up_to_date",
  "site_name",
  "group_name",
  "external_ip",
  "internal_ip",
  "mac_address",
  "domain",
  "network_status",
  "cpu_summary",
  "total_memory",
  "uuid",
  "last_active_date",
];

export default function Agents() {
  const { message, modal } = AntdApp.useApp();
  const t = useT();
  const [selected, setSelected] = useState<string[]>([]);
  const [visibleKeys, setVisibleKeys] = useState<string[]>(DEFAULT_VISIBLE);
  const [detail, setDetail] = useState<Agent | null>(null);

  const detailSections: DetailSection[] = detail
    ? buildAgentSections(detail, t)
    : [];

  const columnDefs = useMemo<
    { key: string; col: TableColumnsType<Agent>[number] }[]
  >(() => {
    const defs: { key: string; col: TableColumnsType<Agent>[number] }[] = [
      {
        key: "computer_name",
        col: {
          title: t("agents.col.computer_name"),
          dataIndex: "computer_name",
          fixed: "left",
          width: 180,
        },
      },
      {
        key: "is_active",
        col: {
          title: t("agents.col.is_active"),
          dataIndex: "is_active",
          width: 80,
          render: (v: boolean, r: Agent) => {
            if (r.infected)
              return (
                <StatusBadge tone="danger" pulse>
                  {t("agents.tagInfected")}
                </StatusBadge>
              );
            return v ? (
              <StatusBadge tone="success">{t("agents.tagOnline")}</StatusBadge>
            ) : (
              <StatusBadge tone="neutral">{t("agents.tagOffline")}</StatusBadge>
            );
          },
        },
      },
      { key: "os_name", col: { title: t("agents.col.os_name"), dataIndex: "os_name", width: 160 } },
      {
        key: "machine_type",
        col: { title: t("agents.col.machine_type"), dataIndex: "machine_type", width: 100 },
      },
      {
        key: "agent_version",
        col: { title: t("agents.col.agent_version"), dataIndex: "agent_version", width: 140 },
      },
      {
        key: "is_up_to_date",
        col: {
          title: t("agents.col.is_up_to_date"),
          dataIndex: "is_up_to_date",
          width: 90,
          render: (v: boolean) =>
            v ? (
              <StatusBadge tone="info">{t("status.uptodate")}</StatusBadge>
            ) : (
              <StatusBadge tone="warning">{t("status.outofdate")}</StatusBadge>
            ),
        },
      },
      { key: "site_name", col: { title: t("agents.col.site_name"), dataIndex: "site_name", width: 140 } },
      { key: "group_name", col: { title: t("agents.col.group_name"), dataIndex: "group_name", width: 140 } },
      { key: "external_ip", col: { title: t("agents.col.external_ip"), dataIndex: "external_ip", width: 140 } },
      {
        key: "internal_ip",
        col: {
          title: t("agents.col.internal_ip"),
          key: "internal_ip",
          width: 140,
          render: (_: unknown, r: Agent) => firstInternalIp(r),
        },
      },
      {
        key: "mac_address",
        col: {
          title: t("agents.col.mac_address"),
          key: "mac_address",
          width: 150,
          render: (_: unknown, r: Agent) => firstMac(r),
        },
      },
      { key: "domain", col: { title: t("agents.col.domain"), dataIndex: "domain", width: 120 } },
      {
        key: "network_status",
        col: { title: t("agents.col.network_status"), dataIndex: "network_status", width: 120 },
      },
      {
        key: "cpu_summary",
        col: {
          title: t("agents.col.cpu_summary"),
          key: "cpu_summary",
          width: 220,
          ellipsis: true,
          render: (_: unknown, r: Agent) => cpuSummary(r),
        },
      },
      {
        key: "total_memory",
        col: {
          title: t("agents.col.total_memory"),
          dataIndex: "total_memory",
          width: 100,
          render: (v?: number) => formatMemoryMB(v),
        },
      },
      {
        key: "uuid",
        col: {
          title: t("agents.col.uuid"),
          dataIndex: "uuid",
          width: 240,
          ellipsis: true,
        },
      },
      {
        key: "last_active_date",
        col: {
          title: t("agents.col.last_active_date"),
          dataIndex: "last_active_date",
          width: 180,
          render: (v: string) => formatLocalTime(v),
        },
      },
    ];
    return defs;
  }, [t]);

  const columns = useMemo<TableColumnsType<Agent>>(() => {
    const set = new Set(visibleKeys);
    return columnDefs.filter((c) => set.has(c.key)).map((c) => c.col);
  }, [columnDefs, visibleKeys]);

  const columnOptions: ColumnOption[] = ALL_COLUMN_KEYS.map((k) => ({
    key: k,
    label: t(`agents.col.${k}`),
  }));

  const actionItems = ACTION_KEYS.map((k) => ({ key: k, label: t(`agents.action.${k}`) }));
  const protectionItems = PROTECTION_KEYS.map((k) => ({
    key: k,
    label: t(`agents.action.${k}`),
  }));

  async function runAction(action: string) {
    if (!selected.length) {
      message.warning(t("agents.needSelect"));
      return;
    }
    modal.confirm({
      title: t("agents.confirmAction", {
        n: selected.length,
        action: t(`agents.action.${action}`),
      }),
      onOk: async () => {
        try {
          const res = await s1.agentAction(action, selected);
          message.success(t("agents.done", { n: res.affected }));
        } catch (e) {
          message.error((e as Error).message);
        }
      },
    });
  }

  function runProtection(kind: "enable" | "disable") {
    if (!selected.length) {
      message.warning(t("agents.needSelect"));
      return;
    }
    let shouldReboot = false;
    const isEnable = kind === "enable";
    modal.confirm({
      title: isEnable
        ? t("agents.prot.titleEnable", { n: selected.length })
        : t("agents.prot.titleDisable", { n: selected.length }),
      icon: null,
      okType: isEnable ? "primary" : "danger",
      okText: isEnable ? t("agents.prot.okEnable") : t("agents.prot.okDisable"),
      cancelText: t("common.cancel"),
      content: (
        <Space direction="vertical" size="small" style={{ marginTop: 8 }}>
          <div style={{ color: "#595959", fontSize: 13 }}>
            {isEnable ? t("agents.prot.descEnable") : t("agents.prot.descDisable")}
          </div>
          <Space>
            <span>{t("agents.prot.reboot")}</span>
            <Switch
              size="small"
              defaultChecked={false}
              onChange={(v) => {
                shouldReboot = v;
              }}
            />
          </Space>
        </Space>
      ),
      onOk: async () => {
        try {
          const res = isEnable
            ? await s1.enableAgent(selected, shouldReboot)
            : await s1.disableAgent(selected, shouldReboot);
          message.success(
            isEnable
              ? t("agents.prot.doneEnable", { n: res.affected })
              : t("agents.prot.doneDisable", { n: res.affected }),
          );
        } catch (e) {
          message.error((e as Error).message);
        }
      },
    });
  }

  return (
    <>
      <ResourceTable<Agent>
      title={t("agents.title")}
      columns={columns}
      rowKey="id"
      fetcher={s1.listAgents}
      onSelectionChange={(ids) => setSelected(ids)}
      onRowDoubleClick={(r) => setDetail(r)}
      searchPlaceholder={t("agents.search")}
      searchFilter={(a, q) => {
        const low = q.toLowerCase();
        return (
          (a.computer_name ?? "").toLowerCase().includes(low) ||
          (a.external_ip ?? "").toLowerCase().includes(low) ||
          (a.os_name ?? "").toLowerCase().includes(low) ||
          (a.domain ?? "").toLowerCase().includes(low) ||
          (a.agent_version ?? "").toLowerCase().includes(low) ||
          (a.site_name ?? "").toLowerCase().includes(low)
        );
      }}
      extraToolbar={
        <Space wrap>
          <Dropdown
            menu={{ items: actionItems, onClick: ({ key }) => void runAction(key) }}
            disabled={!selected.length}
          >
            <Button type="primary" disabled={!selected.length}>
              {t("agents.bulk")} ({selected.length}) <DownOutlined />
            </Button>
          </Dropdown>
          <Dropdown
            menu={{
              items: protectionItems,
              onClick: ({ key }) =>
                runProtection(key === "enable-protection" ? "enable" : "disable"),
            }}
            disabled={!selected.length}
          >
            <Button disabled={!selected.length}>
              {t("agents.protection")} <DownOutlined />
            </Button>
          </Dropdown>
          <ColumnPicker
            options={columnOptions}
            value={visibleKeys}
            defaults={DEFAULT_VISIBLE}
            onChange={setVisibleKeys}
          />
        </Space>
      }
      />
      <DetailDrawer
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.computer_name ?? t("common.rowDetails")}
        sections={detailSections}
        raw={detail}
      />
    </>
  );
}
