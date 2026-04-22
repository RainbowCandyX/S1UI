import { Drawer, Button, App as AntdApp, Tooltip } from "antd";
import { CopyOutlined } from "@ant-design/icons";
import { useT } from "../i18n";

export interface DetailSection {
  title: string;
  rows: { key: string; label: string; value: unknown }[];
}

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  sections: DetailSection[];
  raw?: unknown;
  width?: number;
}

function displayValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export default function DetailDrawer({
  open,
  title,
  onClose,
  sections,
  raw,
  width = 560,
}: Props) {
  const t = useT();
  const { message } = AntdApp.useApp();

  async function copyJson() {
    if (!raw) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(raw, null, 2));
      message.success(t("common.copied"));
    } catch {
      // ignore
    }
  }

  return (
    <Drawer
      className="detail-drawer"
      open={open}
      title={title}
      onClose={onClose}
      width={width}
      destroyOnClose
      extra={
        raw ? (
          <Tooltip title={t("common.copy")}>
            <Button size="small" icon={<CopyOutlined />} onClick={copyJson}>
              JSON
            </Button>
          </Tooltip>
        ) : null
      }
    >
      {sections.map((sec) => (
        <div key={sec.title} className="detail-section">
          <div className="sec-title">{sec.title}</div>
          {sec.rows.map((r) => (
            <div key={r.key} className="kv-row">
              <div className="k">{r.label}</div>
              <div className="v">{displayValue(r.value)}</div>
            </div>
          ))}
        </div>
      ))}
    </Drawer>
  );
}
