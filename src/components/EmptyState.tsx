import { InboxOutlined } from "@ant-design/icons";
import type { ReactNode } from "react";
import { useT } from "../i18n";

interface Props {
  icon?: ReactNode;
  title?: string;
  hint?: string;
}

export default function EmptyState({ icon, title, hint }: Props) {
  const t = useT();
  return (
    <div className="s1-empty">
      <div className="icon">{icon ?? <InboxOutlined />}</div>
      <div className="title">{title ?? t("common.emptyTitle")}</div>
      <div className="hint">{hint ?? t("common.emptyHint")}</div>
    </div>
  );
}
