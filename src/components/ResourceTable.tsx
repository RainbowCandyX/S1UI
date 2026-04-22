import { useEffect, useState, useCallback, useMemo } from "react";
import { Table, Input, Button, Space, Skeleton, App as AntdApp } from "antd";
import { ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import type { TableProps, TableColumnsType } from "antd";
import type { PageParams, Paginated } from "../api/s1";
import { useT } from "../i18n";
import EmptyState from "./EmptyState";

interface Props<T> {
  title: string;
  columns: TableColumnsType<T>;
  fetcher: (p: PageParams) => Promise<Paginated<T>>;
  rowKey: keyof T | ((r: T) => string);
  extraToolbar?: React.ReactNode;
  onSelectionChange?: (ids: string[], rows: T[]) => void;
  searchPlaceholder?: string;
  /**
   * 客户端过滤函数（iOS/Android 参考项目的风格）。
   * 设置后搜索框的输入不再传给后端，而是本地 filter。
   */
  searchFilter?: (row: T, query: string) => boolean;
  /** Double-click handler — opens a detail drawer etc. */
  onRowDoubleClick?: (row: T) => void;
}

export default function ResourceTable<T extends { id: string }>({
  title,
  columns,
  fetcher,
  rowKey,
  extraToolbar,
  onSelectionChange,
  searchPlaceholder,
  searchFilter,
  onRowDoubleClick,
}: Props<T>) {
  const { message } = AntdApp.useApp();
  const t = useT();
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [firstLoad, setFirstLoad] = useState(true);
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState(50);
  const [cursor, setCursor] = useState<string | undefined>();
  const [nextCursor, setNextCursor] = useState<string | null | undefined>();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const load = useCallback(
    async (resetCursor = false) => {
      setLoading(true);
      try {
        const data = await fetcher({
          limit: pageSize,
          cursor: resetCursor ? undefined : cursor,
          // 若使用客户端过滤，则 query 不发给服务端
          query: searchFilter ? undefined : query || undefined,
        });
        setRows(data.data);
        setNextCursor(data.pagination.nextCursor);
      } catch (e) {
        message.error(`${title}: ${(e as Error).message}`);
      } finally {
        setLoading(false);
        setFirstLoad(false);
      }
    },
    [cursor, fetcher, message, pageSize, query, title, searchFilter],
  );

  // 客户端过滤后的行（参考 iOS localizedCaseInsensitiveContains）
  const filteredRows = useMemo(() => {
    if (!searchFilter || !query.trim()) return rows;
    const q = query.trim();
    return rows.filter((r) => searchFilter(r, q));
  }, [rows, searchFilter, query]);

  useEffect(() => {
    void load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize]);

  const rowSelection: TableProps<T>["rowSelection"] = onSelectionChange
    ? {
        selectedRowKeys: selectedIds,
        onChange: (keys, rowsSel) => {
          const ids = keys.map((k) => String(k));
          setSelectedIds(ids);
          onSelectionChange(ids, rowsSel);
        },
      }
    : undefined;

  return (
    <div className="page-transition">
      <Space style={{ marginBottom: 12 }} wrap>
        <Input
          prefix={<SearchOutlined />}
          placeholder={searchPlaceholder ?? `${t("common.search")} ${title}`}
          value={query}
          allowClear
          style={{ width: 280 }}
          onChange={(e) => setQuery(e.target.value)}
          onPressEnter={
            searchFilter
              ? undefined
              : () => {
                  setCursor(undefined);
                  void load(true);
                }
          }
        />
        <Button
          icon={<ReloadOutlined />}
          onClick={() => {
            setCursor(undefined);
            void load(true);
          }}
        >
          {t("common.refresh")}
        </Button>
        {extraToolbar}
      </Space>

      {firstLoad && loading ? (
        <div
          style={{
            background: "var(--bg-card)",
            borderRadius: 12,
            padding: 20,
            border: "1px solid var(--border-subtle)",
          }}
        >
          <Skeleton active paragraph={{ rows: 8 }} />
        </div>
      ) : (
        <Table<T>
          className={`enhanced-table${onRowDoubleClick ? " has-row-click" : ""}`}
          size="middle"
          rowKey={rowKey as never}
          loading={loading}
          columns={columns}
          dataSource={filteredRows}
          rowSelection={rowSelection}
          locale={{
            emptyText: loading ? <span /> : <EmptyState />,
          }}
          onRow={(record) => ({
            onDoubleClick: () => onRowDoubleClick?.(record),
          })}
          pagination={{
            pageSize,
            showSizeChanger: true,
            pageSizeOptions: [20, 50, 100, 200],
            onShowSizeChange: (_, s) => setPageSize(s),
            showTotal: () => {
              const suffix = nextCursor ? t("common.moreSuffix") : "";
              if (searchFilter && query.trim() && filteredRows.length !== rows.length) {
                return (
                  t("common.matchedCount", { m: filteredRows.length, n: rows.length }) + suffix
                );
              }
              return t("common.totalCount", { n: rows.length }) + suffix;
            },
          }}
          scroll={{ x: "max-content", y: "calc(100vh - 320px)" }}
        />
      )}

      {nextCursor ? (
        <Button
          style={{ marginTop: 8 }}
          onClick={() => {
            setCursor(nextCursor);
            void load(false);
          }}
        >
          {t("common.loadMore")}
        </Button>
      ) : null}
    </div>
  );
}
