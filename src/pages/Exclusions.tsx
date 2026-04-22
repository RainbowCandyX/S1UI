import { useState, useMemo, useEffect } from "react";
import {
  Switch,
  Space,
  Segmented,
  Button,
  Modal,
  Form,
  Input,
  Select,
  App as AntdApp,
} from "antd";
import { PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import type { TableColumnsType } from "antd";
import ResourceTable from "../components/ResourceTable";
import ColumnPicker, { ColumnOption } from "../components/ColumnPicker";
import StatusBadge from "../components/StatusBadge";
import { s1, Exclusion, PageParams, Paginated, Site, Group } from "../api/s1";
import { isBuiltinExclusion } from "../api/filters";
import { formatLocalTime } from "../utils/time";
import { useT } from "../i18n";

type Mode = "white" | "black";

const WHITE_TYPE_KEYS = ["path", "file_type", "certificate", "browser", "white_hash"];
const BLACK_TYPE_KEYS = ["black_hash", "path", "certificate"];

const OS_OPTIONS = [
  { value: "windows", label: "Windows" },
  { value: "macos", label: "macOS" },
  { value: "linux", label: "Linux" },
];

const ALL_COLUMN_KEYS = [
  "value",
  "type",
  "os_type",
  "mode",
  "scope",
  "source",
  "description",
  "created_at",
];

const DEFAULT_VISIBLE = ["value", "type", "os_type", "created_at"];

interface AddFormValues {
  type: string;
  osType: string;
  value: string;
  description?: string;
  scope: string;
}

export default function Exclusions() {
  const { message, modal } = AntdApp.useApp();
  const t = useT();
  const [mode, setMode] = useState<Mode>("white");
  const [showBuiltin, setShowBuiltin] = useState(false);
  const [stats, setStats] = useState<{ total: number; builtin: number }>({
    total: 0,
    builtin: 0,
  });
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedRows, setSelectedRows] = useState<Exclusion[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [addOpen, setAddOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [sites, setSites] = useState<Site[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [form] = Form.useForm<AddFormValues>();
  const [visibleKeys, setVisibleKeys] = useState<string[]>(DEFAULT_VISIBLE);

  const isWhite = mode === "white";
  const typeKeys = isWhite ? WHITE_TYPE_KEYS : BLACK_TYPE_KEYS;
  const typeOptions = typeKeys.map((k) => ({ value: k, label: t(`excl.type.${k}`) }));

  const columnDefs = useMemo<
    { key: string; col: TableColumnsType<Exclusion>[number] }[]
  >(
    () => [
      {
        key: "value",
        col: {
          title: t("excl.col.value"),
          dataIndex: "value",
          fixed: "left",
          width: 300,
          ellipsis: true,
        },
      },
      { key: "type", col: { title: t("excl.col.type"), dataIndex: "type", width: 140 } },
      { key: "os_type", col: { title: t("excl.col.os_type"), dataIndex: "os_type", width: 100 } },
      {
        key: "mode",
        col: {
          title: t("excl.col.mode"),
          dataIndex: "mode",
          width: 140,
          render: (v: string) => <StatusBadge tone="neutral" dot={false}>{v}</StatusBadge>,
        },
      },
      { key: "scope", col: { title: t("excl.col.scope"), dataIndex: "scope", width: 120 } },
      { key: "source", col: { title: t("excl.col.source"), dataIndex: "source", width: 140 } },
      {
        key: "description",
        col: {
          title: t("excl.col.description"),
          dataIndex: "description",
          width: 260,
          ellipsis: true,
        },
      },
      {
        key: "created_at",
        col: {
          title: t("excl.col.created_at"),
          dataIndex: "created_at",
          width: 180,
          render: (v: string) => formatLocalTime(v),
        },
      },
    ],
    [t],
  );

  const columns = useMemo<TableColumnsType<Exclusion>>(() => {
    const set = new Set(visibleKeys);
    return columnDefs.filter((c) => set.has(c.key)).map((c) => c.col);
  }, [columnDefs, visibleKeys]);

  const columnOptions: ColumnOption[] = ALL_COLUMN_KEYS.map((k) => ({
    key: k,
    label: t(`excl.col.${k}`),
  }));

  const fetcher = useMemo(
    () =>
      async (p: PageParams): Promise<Paginated<Exclusion>> => {
        const res = isWhite
          ? await s1.listExclusions(p)
          : await s1.listRestrictions(p);
        const builtin = res.data.filter(isBuiltinExclusion).length;
        setStats({ total: res.data.length, builtin });
        if (showBuiltin) return res;
        return {
          ...res,
          data: res.data.filter((e) => !isBuiltinExclusion(e)),
        };
      },
    [isWhite, showBuiltin],
  );

  useEffect(() => {
    s1.listSites({ limit: 100 })
      .then((r) => setSites(r.data))
      .catch((e) => message.warning(`${t("excl.loadSiteFailed")}: ${(e as Error).message}`));
    s1.listGroups({ limit: 200 })
      .then((r) => setGroups(r.data))
      .catch((e) => message.warning(`${t("excl.loadGroupFailed")}: ${(e as Error).message}`));
  }, [message, t]);

  const scopeOptions = useMemo(() => {
    const siteOpts = sites.map((s) => ({
      value: `site:${s.id}`,
      label: t("excl.scope.site", { name: s.name ?? s.id }),
    }));
    const groupOpts = groups.map((g) => ({
      value: `group:${g.id}`,
      label:
        t("excl.scope.group", { name: g.name ?? g.id }) +
        (g.site_name ? ` (${g.site_name})` : ""),
    }));
    return [...siteOpts, ...groupOpts];
  }, [sites, groups, t]);

  function openAdd() {
    form.resetFields();
    const defaultScope =
      groups.length > 0
        ? `group:${groups[0].id}`
        : sites.length > 0
          ? `site:${sites[0].id}`
          : "";
    form.setFieldsValue({
      type: typeKeys[0],
      osType: "windows",
      scope: defaultScope,
    });
    setAddOpen(true);
  }

  async function handleAdd() {
    const v = await form.validateFields();
    const data: Record<string, unknown> = {
      type: v.type,
      osType: v.osType,
      value: v.value.trim(),
    };
    if (v.description?.trim()) data.description = v.description.trim();

    const [kind, id] = v.scope.split(":");
    if (!kind || !id) {
      message.error(t("excl.form.scopeRequired"));
      return;
    }
    const scope: Record<string, unknown> =
      kind === "site" ? { siteIds: [id] } : { groupIds: [id] };

    setAddLoading(true);
    try {
      if (isWhite) await s1.createExclusion(data, scope);
      else await s1.createRestriction(data, scope);
      message.success(isWhite ? t("excl.addWhiteDone") : t("excl.addBlackDone"));
      setAddOpen(false);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setAddLoading(false);
    }
  }

  function handleDelete() {
    if (selectedRows.length === 0) {
      message.warning(t("excl.needSelect"));
      return;
    }
    modal.confirm({
      title: isWhite
        ? t("excl.confirmDeleteWhite", { n: selectedRows.length })
        : t("excl.confirmDeleteBlack", { n: selectedRows.length }),
      content: t("excl.irreversible"),
      okType: "danger",
      okText: t("common.delete"),
      cancelText: t("common.cancel"),
      onOk: async () => {
        const grouped: Record<string, string[]> = {};
        for (const r of selectedRows) {
          const tp = (r.type as string | undefined) ?? "";
          (grouped[tp] ??= []).push(r.id);
        }
        let affected = 0;
        const errors: string[] = [];
        for (const [tp, ids] of Object.entries(grouped)) {
          if (!tp) continue;
          try {
            const res = isWhite
              ? await s1.deleteExclusions(tp, ids)
              : await s1.deleteRestrictions(tp, ids);
            affected += res.affected;
          } catch (e) {
            errors.push(`${tp}: ${(e as Error).message}`);
          }
        }
        if (errors.length) {
          message.error(t("excl.deletePartial", { errors: errors.join("; ") }));
        } else {
          message.success(t("excl.deleteDone", { n: affected }));
        }
        setSelectedRows([]);
        setSelectedIds([]);
        setRefreshKey((k) => k + 1);
      },
    });
  }

  return (
    <>
      <ResourceTable<Exclusion>
        title={isWhite ? t("excl.white") : t("excl.black")}
        columns={columns}
        rowKey="id"
        key={`${mode}-${showBuiltin ? "all" : "userOnly"}-${refreshKey}`}
        fetcher={fetcher}
        searchPlaceholder={t("excl.search")}
        onSelectionChange={(ids, rows) => {
          setSelectedIds(ids);
          setSelectedRows(rows);
        }}
        searchFilter={(e, q) => {
          const low = q.toLowerCase();
          return (
            (e.value ?? "").toLowerCase().includes(low) ||
            (e.description ?? "").toLowerCase().includes(low) ||
            (e.type ?? "").toLowerCase().includes(low)
          );
        }}
        extraToolbar={
          <Space wrap>
            <Segmented<Mode>
              value={mode}
              onChange={(v) => {
                setMode(v);
                setSelectedRows([]);
                setSelectedIds([]);
              }}
              options={[
                { label: t("excl.white"), value: "white" },
                { label: t("excl.black"), value: "black" },
              ]}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
              {isWhite ? t("excl.addWhite") : t("excl.addBlack")}
            </Button>
            <Button
              danger
              icon={<DeleteOutlined />}
              disabled={selectedIds.length === 0}
              onClick={handleDelete}
            >
              {t("excl.delete", { n: selectedIds.length })}
            </Button>
            <span style={{ fontSize: 12, color: "#8c8c8c" }}>
              {t("excl.totalNonBuiltin", { n: stats.total - stats.builtin })}
            </span>
            <span style={{ fontSize: 13, color: "#666" }}>{t("excl.showBuiltin")}</span>
            <Switch size="small" checked={showBuiltin} onChange={setShowBuiltin} />
            <ColumnPicker
              options={columnOptions}
              value={visibleKeys}
              defaults={DEFAULT_VISIBLE}
              onChange={setVisibleKeys}
            />
          </Space>
        }
      />

      <Modal
        title={isWhite ? t("excl.addWhite") : t("excl.addBlack")}
        open={addOpen}
        onOk={handleAdd}
        onCancel={() => setAddOpen(false)}
        confirmLoading={addLoading}
        okText={t("common.create")}
        cancelText={t("common.cancel")}
        destroyOnClose
        width={520}
      >
        <Form<AddFormValues> form={form} layout="vertical">
          <Form.Item
            label={t("excl.form.scope")}
            name="scope"
            rules={[{ required: true, message: t("excl.form.scopeRequired") }]}
            extra={t("excl.form.scopeHint")}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder={t("excl.form.scopePlaceholder")}
              options={scopeOptions}
            />
          </Form.Item>

          <Form.Item label={t("excl.form.type")} name="type" rules={[{ required: true }]}>
            <Select options={typeOptions} />
          </Form.Item>

          <Form.Item label={t("excl.form.os")} name="osType" rules={[{ required: true }]}>
            <Select options={OS_OPTIONS} />
          </Form.Item>

          <Form.Item
            label={t("excl.form.value")}
            name="value"
            rules={[{ required: true, message: t("excl.form.valueRequired") }]}
            extra={isWhite ? t("excl.form.valueHintWhite") : t("excl.form.valueHintBlack")}
          >
            <Input
              placeholder={
                isWhite
                  ? t("excl.form.valuePlaceholderWhite")
                  : t("excl.form.valuePlaceholderBlack")
              }
            />
          </Form.Item>

          <Form.Item label={t("excl.form.description")} name="description">
            <Input placeholder={t("excl.form.descPlaceholder")} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
