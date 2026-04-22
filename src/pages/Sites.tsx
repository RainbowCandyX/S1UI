import { useMemo, useState } from "react";
import { Space } from "antd";
import type { TableColumnsType } from "antd";
import ResourceTable from "../components/ResourceTable";
import ColumnPicker, { ColumnOption } from "../components/ColumnPicker";
import StatusBadge from "../components/StatusBadge";
import { s1, Site } from "../api/s1";
import { formatLocalTime } from "../utils/time";
import { useT } from "../i18n";

const ALL_COLUMN_KEYS = [
  "name",
  "account_name",
  "state",
  "total_licenses",
  "active_licenses",
  "expiration",
  "creator",
];

const DEFAULT_VISIBLE = ["name", "state", "account_name", "total_licenses", "active_licenses"];

export default function Sites() {
  const t = useT();
  const [visibleKeys, setVisibleKeys] = useState<string[]>(DEFAULT_VISIBLE);

  const columnDefs = useMemo<{ key: string; col: TableColumnsType<Site>[number] }[]>(
    () => [
      {
        key: "name",
        col: { title: t("sites.col.name"), dataIndex: "name", fixed: "left", width: 220 },
      },
      {
        key: "account_name",
        col: { title: t("sites.col.account_name"), dataIndex: "account_name", width: 200 },
      },
      {
        key: "state",
        col: {
          title: t("sites.col.state"),
          dataIndex: "state",
          width: 100,
          render: (v: string) => (
            <StatusBadge tone={v === "active" ? "success" : "neutral"}>{v}</StatusBadge>
          ),
        },
      },
      {
        key: "total_licenses",
        col: { title: t("sites.col.total_licenses"), dataIndex: "total_licenses", width: 110 },
      },
      {
        key: "active_licenses",
        col: { title: t("sites.col.active_licenses"), dataIndex: "active_licenses", width: 100 },
      },
      {
        key: "expiration",
        col: {
          title: t("sites.col.expiration"),
          dataIndex: "expiration",
          width: 180,
          render: (v: string) => formatLocalTime(v),
        },
      },
      {
        key: "creator",
        col: { title: t("sites.col.creator"), dataIndex: "creator", width: 180 },
      },
    ],
    [t],
  );

  const columns = useMemo<TableColumnsType<Site>>(() => {
    const set = new Set(visibleKeys);
    return columnDefs.filter((c) => set.has(c.key)).map((c) => c.col);
  }, [columnDefs, visibleKeys]);

  const columnOptions: ColumnOption[] = ALL_COLUMN_KEYS.map((k) => ({
    key: k,
    label: t(`sites.col.${k}`),
  }));

  return (
    <ResourceTable<Site>
      title={t("sites.title")}
      columns={columns}
      rowKey="id"
      fetcher={s1.listSites}
      searchPlaceholder={t("sites.search")}
      searchFilter={(s, q) => {
        const low = q.toLowerCase();
        return (
          (s.name ?? "").toLowerCase().includes(low) ||
          (s.account_name ?? "").toLowerCase().includes(low)
        );
      }}
      extraToolbar={
        <Space>
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
