import { useState, useMemo, useRef } from "react";
import {
  Card,
  Button,
  Input,
  Select,
  DatePicker,
  Space,
  Progress,
  Table,
  App as AntdApp,
} from "antd";
import { DownloadOutlined, SearchOutlined } from "@ant-design/icons";
import type { TableColumnsType } from "antd";
import dayjs, { Dayjs } from "dayjs";
import { s1, DVEvent } from "../api/s1";
import { formatLocalTime } from "../utils/time";
import ColumnPicker, { ColumnOption } from "../components/ColumnPicker";
import StatusBadge, { type StatusTone } from "../components/StatusBadge";
import { useT } from "../i18n";

const { RangePicker } = DatePicker;

const PRESET_KEYS = [
  "custom",
  "process",
  "network",
  "file",
  "dns",
  "registry",
  "login",
  "scheduled",
  "driver",
];

const PRESET_QUERIES: Record<string, string> = {
  custom: "",
  process: 'EventType = "Process Creation"',
  network: 'EventType = "IP Connect" OR EventType = "IP Listen"',
  file: 'EventType = "File Creation"',
  dns: 'EventType = "DNS Resolved" OR EventType = "DNS Unresolved"',
  registry: 'EventType = "Registry Value Create" OR EventType = "Registry Key Create"',
  login: 'EventType = "Login"',
  scheduled: 'EventType = "Scheduled Task Register" OR EventType = "Scheduled Task Start"',
  driver: 'EventType = "Driver Load"',
};

const ALL_COLUMN_KEYS = [
  "event_time",
  "event_type",
  "agent_name",
  "process_name",
  "target",
  "tgt_file_path",
  "tgt_file_size",
  "src_proc_cmd_line",
  "src_proc_user",
  "site_name",
];

const DEFAULT_VISIBLE = [
  "event_time",
  "event_type",
  "agent_name",
  "process_name",
  "target",
  "src_proc_cmd_line",
];

function targetSummary(e: DVEvent): string {
  if (e.dst_ip) return e.dst_port ? `${e.dst_ip}:${e.dst_port}` : e.dst_ip;
  if (e.tgt_file_path) return e.tgt_file_path;
  if (e.file_path) return e.file_path;
  if (e.registry_path) return e.registry_path;
  if (e.url) return e.url;
  if (e.dns_request) return e.dns_request;
  if (e.tgt_proc_name) return e.tgt_proc_name;
  if (e.src_proc_image_path) return e.src_proc_image_path;
  return "";
}

function eventTone(raw?: string): StatusTone {
  switch ((raw || "").toLowerCase()) {
    case "process":
      return "brand";
    case "file":
      return "info";
    case "network":
    case "ip":
      return "success";
    case "registry":
      return "warning";
    case "dns":
      return "info";
    case "login":
      return "danger";
    case "schedule":
    case "scheduled_task":
      return "warning";
    case "url":
      return "info";
    default:
      return "neutral";
  }
}

function formatBytes(raw?: string): string {
  if (!raw) return "-";
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return raw;
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = n;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u++;
  }
  return `${v.toFixed(v >= 100 || u === 0 ? 0 : 1)} ${units[u]}`;
}

export default function DeepVisibility() {
  const { message } = AntdApp.useApp();
  const t = useT();
  const [preset, setPreset] = useState("custom");
  const [queryText, setQueryText] = useState("");
  const [range, setRange] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(1, "day"),
    dayjs(),
  ]);
  const [searchText, setSearchText] = useState("");
  const [isQuerying, setIsQuerying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [state, setState] = useState("");
  const [events, setEvents] = useState<DVEvent[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null | undefined>();
  const [queryId, setQueryId] = useState<string>("");
  const [visibleKeys, setVisibleKeys] = useState<string[]>(DEFAULT_VISIBLE);
  const pollRef = useRef<number | null>(null);

  function displayEventType(raw?: string): string {
    switch ((raw || "").toLowerCase()) {
      case "process":
        return t("dv.et.process");
      case "file":
        return t("dv.et.file");
      case "network":
      case "ip":
        return t("dv.et.network");
      case "registry":
        return t("dv.et.registry");
      case "dns":
        return t("dv.et.dns");
      case "login":
        return t("dv.et.login");
      case "schedule":
      case "scheduled_task":
        return t("dv.et.scheduled_task");
      case "url":
        return t("dv.et.url");
      default:
        return raw || t("common.unknown");
    }
  }

  const presetItems = PRESET_KEYS.map((k) => ({
    value: k,
    label: t(`dv.preset.${k}`),
  }));

  const columnDefs = useMemo<
    { key: string; col: TableColumnsType<DVEvent>[number] }[]
  >(
    () => [
      {
        key: "event_time",
        col: {
          title: t("dv.col.event_time"),
          dataIndex: "event_time",
          width: 180,
          render: (v: string) => formatLocalTime(v),
        },
      },
      {
        key: "event_type",
        col: {
          title: t("dv.col.event_type"),
          dataIndex: "event_type",
          width: 120,
          render: (v: string) => (
            <StatusBadge tone={eventTone(v)} dot={false}>
              {displayEventType(v)}
            </StatusBadge>
          ),
        },
      },
      {
        key: "agent_name",
        col: { title: t("dv.col.agent_name"), dataIndex: "agent_name", width: 180, ellipsis: true },
      },
      {
        key: "process_name",
        col: {
          title: t("dv.col.process_name"),
          dataIndex: "process_name",
          width: 180,
          ellipsis: true,
        },
      },
      {
        key: "target",
        col: {
          title: t("dv.col.target"),
          key: "target",
          width: 260,
          ellipsis: true,
          render: (_: unknown, r: DVEvent) => targetSummary(r) || "-",
        },
      },
      {
        key: "tgt_file_path",
        col: {
          title: t("dv.col.tgt_file_path"),
          dataIndex: "tgt_file_path",
          width: 300,
          ellipsis: true,
        },
      },
      {
        key: "tgt_file_size",
        col: {
          title: t("dv.col.tgt_file_size"),
          dataIndex: "tgt_file_size",
          width: 120,
          render: (v: string) => formatBytes(v),
        },
      },
      {
        key: "src_proc_cmd_line",
        col: {
          title: t("dv.col.src_proc_cmd_line"),
          dataIndex: "src_proc_cmd_line",
          width: 360,
          ellipsis: true,
        },
      },
      {
        key: "src_proc_user",
        col: {
          title: t("dv.col.src_proc_user"),
          dataIndex: "src_proc_user",
          width: 160,
          ellipsis: true,
        },
      },
      {
        key: "site_name",
        col: { title: t("dv.col.site_name"), dataIndex: "site_name", width: 140 },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t],
  );

  const columns = useMemo<TableColumnsType<DVEvent>>(() => {
    const set = new Set(visibleKeys);
    return columnDefs.filter((c) => set.has(c.key)).map((c) => c.col);
  }, [columnDefs, visibleKeys]);

  const columnOptions: ColumnOption[] = ALL_COLUMN_KEYS.map((k) => ({
    key: k,
    label: t(`dv.col.${k}`),
  }));

  const filtered = useMemo(() => {
    if (!searchText.trim()) return events;
    const q = searchText.trim().toLowerCase();
    return events.filter((e) => (e.agent_name ?? "").toLowerCase().includes(q));
  }, [events, searchText]);

  function stopPolling() {
    if (pollRef.current != null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  async function runQuery() {
    if (!queryText.trim()) {
      message.warning(t("dv.needQuery"));
      return;
    }
    setIsQuerying(true);
    setProgress(0);
    setState(t("dv.submitting"));
    setEvents([]);
    setNextCursor(undefined);

    try {
      const r = await s1.dvInitQuery(
        queryText,
        range[0].toISOString(),
        range[1].toISOString(),
      );
      const qid = r.query_id;
      if (!qid) {
        message.error(t("dv.noQueryId"));
        setIsQuerying(false);
        return;
      }
      setQueryId(qid);
      setState("RUNNING");

      const startedAt = Date.now();
      const TIMEOUT_MS = 5 * 60 * 1000;
      pollRef.current = window.setInterval(async () => {
        try {
          const s = await s1.dvQueryStatus(qid);
          const st = (s.response_state ?? "RUNNING").toUpperCase();
          setProgress(s.progress_status ?? 0);
          setState(st);

          if (st === "FINISHED") {
            stopPolling();
            await loadEvents(qid);
            setIsQuerying(false);
          } else if (/FAILED|ERROR|CANCEL|ABORT/.test(st)) {
            stopPolling();
            message.error(`${t("dv.failed")} (${st}): ${s.response_error ?? ""}`);
            setIsQuerying(false);
          } else if (Date.now() - startedAt > TIMEOUT_MS) {
            stopPolling();
            message.error(t("dv.timeoutMin", { min: TIMEOUT_MS / 60000 }));
            setIsQuerying(false);
          }
        } catch (e) {
          stopPolling();
          message.error(`${t("dv.pollFailed")}: ${(e as Error).message}`);
          setIsQuerying(false);
        }
      }, 2000) as unknown as number;
    } catch (e) {
      setIsQuerying(false);
      message.error((e as Error).message);
    }
  }

  async function loadEvents(qid: string) {
    try {
      const res = await s1.dvEvents(qid, 100);
      setEvents(res.data);
      setNextCursor(res.pagination.nextCursor);
    } catch (e) {
      message.error((e as Error).message);
    }
  }

  async function loadMore() {
    if (!nextCursor || !queryId) return;
    try {
      const res = await s1.dvEvents(queryId, 100, nextCursor);
      setEvents((p) => [...p, ...res.data]);
      setNextCursor(res.pagination.nextCursor);
    } catch (e) {
      message.error((e as Error).message);
    }
  }

  function exportCsv() {
    if (filtered.length === 0) {
      message.warning(t("dv.noCsv"));
      return;
    }
    const head = [
      t("dv.col.event_time"),
      t("dv.col.event_type"),
      t("dv.col.agent_name"),
      t("dv.col.process_name"),
      t("dv.col.target"),
      t("dv.col.src_proc_cmd_line"),
    ].join(",");
    const rows = filtered.map((e) =>
      [
        e.event_time ?? "",
        displayEventType(e.event_type),
        e.agent_name ?? "",
        e.process_name ?? "",
        targetSummary(e),
        e.src_proc_cmd_line ?? "",
      ]
        .map((v) => `"${v.replace(/"/g, '""')}"`)
        .join(","),
    );
    const csv = [head, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dv-events-${dayjs().format("YYYYMMDD-HHmmss")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Card title={t("dv.title")} size="small">
        <Space wrap>
          <Select
            value={preset}
            style={{ width: 180 }}
            options={presetItems}
            onChange={(v) => {
              setPreset(v);
              if (v !== "custom") setQueryText(PRESET_QUERIES[v] ?? "");
            }}
          />
          <Input
            placeholder={t("dv.placeholder")}
            style={{ width: 460 }}
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
          />
          <RangePicker
            showTime
            value={range}
            onChange={(v) => v && v[0] && v[1] && setRange([v[0], v[1]])}
          />
          <Button type="primary" loading={isQuerying} onClick={runQuery}>
            {t("dv.run")}
          </Button>
          <Button icon={<DownloadOutlined />} onClick={exportCsv}>
            {t("dv.exportCsv")}
          </Button>
        </Space>
        {isQuerying && (
          <div style={{ marginTop: 12 }}>
            <Progress percent={progress} status="active" />
            <span style={{ color: "#888", fontSize: 12 }}>
              {t("dv.status")}: {state}
            </span>
          </div>
        )}
      </Card>

      <Card
        size="small"
        title={`${t("dv.resultTitle")} (${filtered.length}${nextCursor ? " +" : ""})`}
        extra={
          <Space>
            <Input
              prefix={<SearchOutlined />}
              placeholder={t("dv.filterDevice")}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 260 }}
              allowClear
            />
            <ColumnPicker
              options={columnOptions}
              value={visibleKeys}
              defaults={DEFAULT_VISIBLE}
              onChange={setVisibleKeys}
            />
          </Space>
        }
      >
        <Table<DVEvent>
          size="small"
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          pagination={{ pageSize: 50, showSizeChanger: true }}
          scroll={{ x: "max-content", y: "calc(100vh - 440px)" }}
          footer={
            nextCursor
              ? () => (
                  <div style={{ textAlign: "center" }}>
                    <Button size="small" onClick={loadMore}>
                      {t("common.loadMore")}
                    </Button>
                  </div>
                )
              : undefined
          }
        />
      </Card>
    </Space>
  );
}
