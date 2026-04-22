import { useMemo, useState } from "react";
import { Button, Popover, Input, Checkbox, Space } from "antd";
import { DownOutlined, SearchOutlined } from "@ant-design/icons";
import { useT } from "../i18n";

export interface ColumnOption {
  key: string;
  label: string;
}

interface Props {
  options: ColumnOption[];
  value: string[]; // 当前选中的 key 列表
  defaults: string[]; // "重置" 用
  onChange: (next: string[]) => void;
  buttonText?: string;
}

/**
 * 参考 SentinelOne Web Console 的 "Columns" 下拉：
 * - 搜索过滤
 * - 点击切换显示/隐藏
 * - 重置回默认
 */
export default function ColumnPicker({
  options,
  value,
  defaults,
  onChange,
  buttonText,
}: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  function toggle(key: string) {
    if (value.includes(key)) {
      onChange(value.filter((k) => k !== key));
    } else {
      onChange([...value, key]);
    }
  }

  const content = (
    <div style={{ width: 240 }}>
      <Input
        size="small"
        prefix={<SearchOutlined />}
        placeholder={`${t("common.search")}...`}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        allowClear
      />
      <div
        style={{
          maxHeight: 320,
          overflowY: "auto",
          marginTop: 8,
          paddingRight: 4,
        }}
      >
        <Space direction="vertical" size={4} style={{ width: "100%" }}>
          {filtered.map((opt) => (
            <div
              key={opt.key}
              style={{
                cursor: "pointer",
                padding: "4px 6px",
                borderRadius: 4,
              }}
              onClick={() => toggle(opt.key)}
              onMouseDown={(e) => e.preventDefault()}
            >
              <Checkbox
                checked={value.includes(opt.key)}
                style={{ pointerEvents: "none" }}
              >
                {opt.label}
              </Checkbox>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ color: "#aaa", fontSize: 12, padding: 8 }}>{t("common.noMatch")}</div>
          )}
        </Space>
      </div>
      <div
        style={{
          borderTop: "1px solid #f0f0f0",
          marginTop: 8,
          paddingTop: 6,
          textAlign: "right",
        }}
      >
        <Button type="link" size="small" onClick={() => onChange(defaults)}>
          {t("common.reset")}
        </Button>
      </div>
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      placement="bottomRight"
      open={open}
      onOpenChange={setOpen}
    >
      <Button>
        {buttonText ?? t("common.columns")} <DownOutlined />
      </Button>
    </Popover>
  );
}
