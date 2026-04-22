import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import { ConfigProvider, theme as antdTheme, App as AntdApp } from "antd";
import zhCN from "antd/locale/zh_CN";
import enUS from "antd/locale/en_US";
import { HashRouter } from "react-router-dom";
import dayjs from "dayjs";
import "dayjs/locale/zh-cn";
import App from "./App";
import { useSettings } from "./i18n";
import { useEffectiveTheme } from "./store/settings";
import { installShortcutGuards } from "./utils/disableShortcuts";
import "./styles.css";

installShortcutGuards();

const BRAND = "#6e29f0";

const lightTokens = {
  colorPrimary: BRAND,
  colorInfo: "#1677ff",
  colorSuccess: "#10b981",
  colorWarning: "#f59e0b",
  colorError: "#ef4444",
  colorBgLayout: "#f5f6fa",
  colorBgContainer: "#ffffff",
  colorBorderSecondary: "#eef0f4",
  borderRadius: 8,
  borderRadiusLG: 12,
  fontSize: 14,
  controlHeight: 34,
  boxShadowTertiary:
    "0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)",
};

const darkTokens = {
  colorPrimary: "#8b5cf6",
  colorInfo: "#60a5fa",
  colorSuccess: "#34d399",
  colorWarning: "#fbbf24",
  colorError: "#f87171",
  colorBgLayout: "#0b0d12",
  colorBgContainer: "#141820",
  colorBorderSecondary: "#242a35",
  borderRadius: 8,
  borderRadiusLG: 12,
  fontSize: 14,
  controlHeight: 34,
  boxShadowTertiary:
    "0 1px 2px rgba(0,0,0,0.35), 0 1px 3px rgba(0,0,0,0.45)",
};

function Root() {
  const lang = useSettings((s) => s.lang);
  const effectiveTheme = useEffectiveTheme();
  const isZh = lang === "zh";
  const isDark = effectiveTheme === "dark";
  dayjs.locale(isZh ? "zh-cn" : "en");

  useEffect(() => {
    document.documentElement.dataset.theme = effectiveTheme;
  }, [effectiveTheme]);

  return (
    <ConfigProvider
      locale={isZh ? zhCN : enUS}
      theme={{
        algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: isDark ? darkTokens : lightTokens,
        components: {
          Layout: {
            headerBg: isDark ? "#141820" : "#ffffff",
            siderBg: isDark ? "#0b0d12" : "#111827",
            bodyBg: isDark ? "#0b0d12" : "#f5f6fa",
          },
          Menu: {
            darkItemBg: isDark ? "#0b0d12" : "#111827",
            darkItemSelectedBg: isDark
              ? "rgba(139,92,246,0.18)"
              : "rgba(110,41,240,0.22)",
            darkItemHoverBg: "rgba(255,255,255,0.06)",
            darkItemSelectedColor: "#ffffff",
            itemBorderRadius: 8,
          },
          Table: {
            headerBg: isDark ? "#1a1f2a" : "#fafbfc",
            rowHoverBg: isDark ? "#1c2230" : "#f3f5fa",
            borderColor: isDark ? "#242a35" : "#eef0f4",
          },
          Card: {
            borderRadiusLG: 12,
          },
          Button: {
            controlHeight: 34,
            fontWeight: 500,
          },
        },
      }}
    >
      <AntdApp>
        <HashRouter>
          <App />
        </HashRouter>
      </AntdApp>
    </ConfigProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
