import { useMemo, useState } from "react";
import { Tag, Button, Dropdown, Space, Switch, App as AntdApp } from "antd";
import { DownOutlined } from "@ant-design/icons";
import type { TableColumnsType } from "antd";
import ResourceTable from "../components/ResourceTable";
import ColumnPicker, { ColumnOption } from "../components/ColumnPicker";
import { s1, Agent } from "../api/s1";
import { formatLocalTime } from "../utils/time";
import { useT } from "../i18n";

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
  "domain",
  "network_status",
  "last_active_date",
];

export default function Agents() {
  const { message, modal } = AntdApp.useApp();
  const t = useT();
  const [selected, setSelected] = useState<string[]>([]);
  const [visibleKeys, setVisibleKeys] = useState<string[]>(DEFAULT_VISIBLE);

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
            if (r.infected) return <Tag color="red">{t("agents.tagInfected")}</Tag>;
            return v ? (
              <Tag color="green">{t("agents.tagOnline")}</Tag>
            ) : (
              <Tag>{t("agents.tagOffline")}</Tag>
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
              <Tag color="blue">{t("common.yes")}</Tag>
            ) : (
              <Tag color="orange">{t("common.no")}</Tag>
            ),
        },
      },
      { key: "site_name", col: { title: t("agents.col.site_name"), dataIndex: "site_name", width: 140 } },
      { key: "group_name", col: { title: t("agents.col.group_name"), dataIndex: "group_name", width: 140 } },
      { key: "external_ip", col: { title: t("agents.col.external_ip"), dataIndex: "external_ip", width: 140 } },
      { key: "domain", col: { title: t("agents.col.domain"), dataIndex: "domain", width: 120 } },
      {
        key: "network_status",
        col: { title: t("agents.col.network_status"), dataIndex: "network_status", width: 120 },
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
    <ResourceTable<Agent>
      title={t("agents.title")}
      columns={columns}
      rowKey="id"
      fetcher={s1.listAgents}
      onSelectionChange={(ids) => setSelected(ids)}
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
  );
}
