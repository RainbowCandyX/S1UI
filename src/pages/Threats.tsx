import { useMemo, useState } from "react";
import { Tag, Button, Dropdown, Space, App as AntdApp } from "antd";
import { DownOutlined } from "@ant-design/icons";
import type { TableColumnsType } from "antd";
import ResourceTable from "../components/ResourceTable";
import ColumnPicker, { ColumnOption } from "../components/ColumnPicker";
import { s1, Threat } from "../api/s1";
import { formatLocalTime } from "../utils/time";
import { useT } from "../i18n";

const MITIGATION_KEYS = [
  "mitigate-kill",
  "mitigate-quarantine",
  "mitigate-un-quarantine",
  "mitigate-remediate",
  "mitigate-rollback-remediation",
];

const VERDICT_KEYS = ["true_positive", "false_positive", "suspicious", "undefined"];

const INCIDENT_KEYS = ["unresolved", "in_progress", "resolved"];

const EXTRA_KEYS = ["add-to-blacklist", "add-to-exclusions"];

const ALL_COLUMN_KEYS = [
  "threat_name",
  "confidence_level",
  "classification",
  "mitigation_status",
  "incident_status",
  "analyst_verdict",
  "agent_computer_name",
  "agent_os_type",
  "file_path",
  "file_sha1",
  "created_at",
];

const DEFAULT_VISIBLE = [
  "threat_name",
  "confidence_level",
  "classification",
  "mitigation_status",
  "analyst_verdict",
  "agent_computer_name",
  "agent_os_type",
  "created_at",
];

function verdictColor(v?: string) {
  switch ((v || "").toLowerCase()) {
    case "true_positive":
      return "red";
    case "false_positive":
      return "default";
    case "suspicious":
      return "orange";
    default:
      return "blue";
  }
}

export default function Threats() {
  const { message, modal } = AntdApp.useApp();
  const t = useT();
  const [selected, setSelected] = useState<string[]>([]);
  const [visibleKeys, setVisibleKeys] = useState<string[]>(DEFAULT_VISIBLE);

  const columnDefs = useMemo<
    { key: string; col: TableColumnsType<Threat>[number] }[]
  >(
    () => [
      {
        key: "threat_name",
        col: {
          title: t("threats.col.threat_name"),
          dataIndex: "threat_name",
          fixed: "left",
          width: 220,
          ellipsis: true,
        },
      },
      {
        key: "confidence_level",
        col: {
          title: t("threats.col.confidence_level"),
          dataIndex: "confidence_level",
          width: 110,
          render: (v: string) => <Tag color={v === "malicious" ? "red" : "orange"}>{v}</Tag>,
        },
      },
      {
        key: "classification",
        col: { title: t("threats.col.classification"), dataIndex: "classification", width: 160 },
      },
      {
        key: "mitigation_status",
        col: {
          title: t("threats.col.mitigation_status"),
          dataIndex: "mitigation_status",
          width: 120,
          render: (v: string) => (
            <Tag color={v === "mitigated" ? "green" : v === "not_mitigated" ? "red" : "default"}>
              {v}
            </Tag>
          ),
        },
      },
      {
        key: "incident_status",
        col: { title: t("threats.col.incident_status"), dataIndex: "incident_status", width: 120 },
      },
      {
        key: "analyst_verdict",
        col: {
          title: t("threats.col.analyst_verdict"),
          dataIndex: "analyst_verdict",
          width: 140,
          render: (v: string) => <Tag color={verdictColor(v)}>{v || "undefined"}</Tag>,
        },
      },
      {
        key: "agent_computer_name",
        col: {
          title: t("threats.col.agent_computer_name"),
          dataIndex: "agent_computer_name",
          width: 180,
        },
      },
      {
        key: "agent_os_type",
        col: { title: t("threats.col.agent_os_type"), dataIndex: "agent_os_type", width: 100 },
      },
      {
        key: "file_path",
        col: {
          title: t("threats.col.file_path"),
          dataIndex: "file_path",
          width: 300,
          ellipsis: true,
        },
      },
      {
        key: "file_sha1",
        col: {
          title: t("threats.col.file_sha1"),
          dataIndex: "file_sha1",
          width: 200,
          ellipsis: true,
        },
      },
      {
        key: "created_at",
        col: {
          title: t("threats.col.created_at"),
          dataIndex: "created_at",
          width: 180,
          render: (v: string) => formatLocalTime(v),
        },
      },
    ],
    [t],
  );

  const columns = useMemo<TableColumnsType<Threat>>(() => {
    const set = new Set(visibleKeys);
    return columnDefs.filter((c) => set.has(c.key)).map((c) => c.col);
  }, [columnDefs, visibleKeys]);

  const columnOptions: ColumnOption[] = ALL_COLUMN_KEYS.map((k) => ({
    key: k,
    label: t(`threats.col.${k}`),
  }));

  const mitigationItems = MITIGATION_KEYS.map((k) => ({ key: k, label: t(`threats.action.${k}`) }));
  const verdictItems = VERDICT_KEYS.map((k) => ({ key: k, label: t(`threats.verdict.${k}`) }));
  const incidentItems = INCIDENT_KEYS.map((k) => ({ key: k, label: t(`threats.incident.${k}`) }));
  const extraItems = EXTRA_KEYS.map((k) => ({ key: k, label: t(`threats.action.${k}`) }));

  function requireSelection(): string[] | null {
    if (!selected.length) {
      message.warning(t("threats.needSelect"));
      return null;
    }
    return selected;
  }

  async function runMitigation(action: string) {
    const ids = requireSelection();
    if (!ids) return;
    const label = t(`threats.action.${action}`);
    modal.confirm({
      title: t("threats.confirm", { n: ids.length, label }),
      okType: "danger",
      onOk: async () => {
        try {
          const res = await s1.threatAction(action, ids);
          message.success(t("threats.mitigateDone", { n: res.affected }));
        } catch (e) {
          message.error((e as Error).message);
        }
      },
    });
  }

  async function runVerdict(verdict: string) {
    const ids = requireSelection();
    if (!ids) return;
    const label = t(`threats.verdict.${verdict}`);
    try {
      const res = await s1.threatVerdict(ids, verdict);
      message.success(t("threats.verdictDone", { n: res.affected, label }));
    } catch (e) {
      message.error((e as Error).message);
    }
  }

  async function runIncidentStatus(status: string) {
    const ids = requireSelection();
    if (!ids) return;
    const label = t(`threats.incident.${status}`);
    try {
      const res = await s1.threatIncidentStatus(ids, status);
      message.success(t("threats.incidentDone", { n: res.affected, label }));
    } catch (e) {
      message.error((e as Error).message);
    }
  }

  async function runExtra(action: string) {
    const ids = requireSelection();
    if (!ids) return;
    const label = t(`threats.action.${action}`);
    modal.confirm({
      title: t("threats.confirm", { n: ids.length, label }),
      onOk: async () => {
        try {
          const res = await s1.threatAction(action, ids);
          message.success(t("threats.extraDone", { n: res.affected }));
        } catch (e) {
          message.error((e as Error).message);
        }
      },
    });
  }

  const disabled = selected.length === 0;

  return (
    <ResourceTable<Threat>
      title={t("threats.title")}
      columns={columns}
      rowKey="id"
      fetcher={s1.listThreats}
      onSelectionChange={(ids) => setSelected(ids)}
      searchPlaceholder={t("threats.search")}
      searchFilter={(th, q) => {
        const low = q.toLowerCase();
        return (
          (th.threat_name ?? "").toLowerCase().includes(low) ||
          (th.agent_computer_name ?? "").toLowerCase().includes(low) ||
          (th.file_path ?? "").toLowerCase().includes(low) ||
          (th.file_sha1 ?? "").toLowerCase().includes(low) ||
          (th.classification ?? "").toLowerCase().includes(low)
        );
      }}
      extraToolbar={
        <Space wrap>
          <Dropdown
            menu={{ items: mitigationItems, onClick: ({ key }) => void runMitigation(key) }}
            disabled={disabled}
          >
            <Button danger disabled={disabled}>
              {t("threats.btnMitigation")} ({selected.length}) <DownOutlined />
            </Button>
          </Dropdown>
          <Dropdown
            menu={{ items: verdictItems, onClick: ({ key }) => void runVerdict(key) }}
            disabled={disabled}
          >
            <Button disabled={disabled}>
              {t("threats.btnVerdict")} <DownOutlined />
            </Button>
          </Dropdown>
          <Dropdown
            menu={{ items: incidentItems, onClick: ({ key }) => void runIncidentStatus(key) }}
            disabled={disabled}
          >
            <Button disabled={disabled}>
              {t("threats.btnIncident")} <DownOutlined />
            </Button>
          </Dropdown>
          <Dropdown
            menu={{ items: extraItems, onClick: ({ key }) => void runExtra(key) }}
            disabled={disabled}
          >
            <Button disabled={disabled}>
              {t("threats.btnExtra")} <DownOutlined />
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
  );
}
