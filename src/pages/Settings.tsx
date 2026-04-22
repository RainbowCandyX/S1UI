import { useEffect, useState } from "react";
import {
  Card,
  Segmented,
  Typography,
  Space,
  Switch,
  Input,
  Select,
  Button,
  App as AntdApp,
} from "antd";
import { useSettings, useT, Lang } from "../i18n";
import { ThemeMode } from "../store/settings";
import { s1, ProxySettings } from "../api/s1";

export default function Settings() {
  const t = useT();
  const { message } = AntdApp.useApp();
  const lang = useSettings((s) => s.lang);
  const setLang = useSettings((s) => s.setLang);
  const themeMode = useSettings((s) => s.themeMode);
  const setThemeMode = useSettings((s) => s.setThemeMode);

  const [proxy, setProxy] = useState<ProxySettings>({
    enabled: false,
    proxy_type: "http",
    url: "",
  });
  const [savingProxy, setSavingProxy] = useState(false);
  const [testingProxy, setTestingProxy] = useState(false);

  useEffect(() => {
    s1.loadProxySettings()
      .then(setProxy)
      .catch((e) => message.warning(`${t("settings.proxyLoadFailed")}: ${(e as Error).message}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSaveProxy() {
    setSavingProxy(true);
    try {
      await s1.saveProxySettings(proxy);
      message.success(t("settings.proxySaved"));
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setSavingProxy(false);
    }
  }

  async function handleTestProxy() {
    setTestingProxy(true);
    try {
      // 不读取已保存的设置；直接用当前表单值（若 enabled=false 则走直连）
      const info = await s1.testProxy(proxy);
      message.success(`${t("settings.proxyTestOk")} · ${info}`, 6);
    } catch (e) {
      message.error(`${t("settings.proxyTestFail")}: ${(e as Error).message}`, 6);
    } finally {
      setTestingProxy(false);
    }
  }

  return (
    <Space
      direction="vertical"
      size="middle"
      style={{ width: "100%" }}
      className="page-transition"
    >
      <Card size="small" title={t("settings.title")} style={{ width: "100%" }}>
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <div>
            <Typography.Text strong>{t("settings.language")}</Typography.Text>
            <div style={{ color: "var(--text-muted)", fontSize: 12, margin: "4px 0 12px" }}>
              {t("settings.languageHint")}
            </div>
            <Segmented
              block
              value={lang}
              onChange={(v) => setLang(v as Lang)}
              options={[
                { label: t("common.chinese"), value: "zh" },
                { label: t("common.english"), value: "en" },
              ]}
            />
          </div>
          <div>
            <Typography.Text strong>{t("settings.theme")}</Typography.Text>
            <div style={{ color: "var(--text-muted)", fontSize: 12, margin: "4px 0 12px" }}>
              {t("settings.themeHint")}
            </div>
            <Segmented
              block
              value={themeMode}
              onChange={(v) => setThemeMode(v as ThemeMode)}
              options={[
                { label: t("settings.themeLight"), value: "light" },
                { label: t("settings.themeDark"), value: "dark" },
                { label: t("settings.themeAuto"), value: "auto" },
              ]}
            />
          </div>
        </Space>
      </Card>

      <Card size="small" title={t("settings.proxy")} style={{ width: "100%" }}>
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <Typography.Text strong>{t("settings.proxyEnabled")}</Typography.Text>
              <div style={{ color: "#8c8c8c", fontSize: 12 }}>
                {t("settings.proxyEnabledHint")}
              </div>
            </div>
            <Switch
              checked={proxy.enabled}
              onChange={(v) => setProxy({ ...proxy, enabled: v })}
            />
          </div>

          <div>
            <Typography.Text strong>{t("settings.proxyType")}</Typography.Text>
            <Select
              style={{ width: "100%", marginTop: 6 }}
              value={proxy.proxy_type}
              onChange={(v) => setProxy({ ...proxy, proxy_type: v })}
              disabled={!proxy.enabled}
              options={[
                { value: "http", label: "HTTP / HTTPS" },
                { value: "socks5", label: "SOCKS5" },
              ]}
            />
          </div>

          <div>
            <Typography.Text strong>{t("settings.proxyUrl")}</Typography.Text>
            <Input
              style={{ marginTop: 6 }}
              value={proxy.url}
              onChange={(e) => setProxy({ ...proxy, url: e.target.value })}
              placeholder={t("settings.proxyUrlHint")}
              disabled={!proxy.enabled}
            />
          </div>

          <Space>
            <Button type="primary" loading={savingProxy} onClick={handleSaveProxy}>
              {t("settings.proxySave")}
            </Button>
            <Button loading={testingProxy} onClick={handleTestProxy}>
              {t("settings.proxyTest")}
            </Button>
          </Space>
        </Space>
      </Card>
    </Space>
  );
}
