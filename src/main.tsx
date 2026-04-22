import React from "react";
import ReactDOM from "react-dom/client";
import { ConfigProvider, theme as antdTheme, App as AntdApp } from "antd";
import zhCN from "antd/locale/zh_CN";
import enUS from "antd/locale/en_US";
import { HashRouter } from "react-router-dom";
import dayjs from "dayjs";
import "dayjs/locale/zh-cn";
import App from "./App";
import { useSettings } from "./i18n";
import "./styles.css";

function Root() {
  const lang = useSettings((s) => s.lang);
  const isZh = lang === "zh";
  dayjs.locale(isZh ? "zh-cn" : "en");

  return (
    <ConfigProvider
      locale={isZh ? zhCN : enUS}
      theme={{
        algorithm: antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: "#6e29f0",
          borderRadius: 6,
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
