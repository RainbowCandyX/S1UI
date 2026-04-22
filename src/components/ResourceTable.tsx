import { useEffect, useState, useCallback, useMemo } from "react";
import { Table, Input, Button, Space, App as AntdApp } from "antd";
import { ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import type { TableProps, TableColumnsType } from "antd";
import type { PageParams, Paginated } from "../api/s1";
import { useT } from "../i18n";

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
}: Props<T>) {
  const { message } = AntdApp.useApp();
  const t = useT();
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
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
    <div>
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
              ? undefined // 客户端过滤无需触发 load
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

      <Table<T>
        size="middle"
        rowKey={rowKey as never}
        loading={loading}
        columns={columns}
        dataSource={filteredRows}
        rowSelection={rowSelection}
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
