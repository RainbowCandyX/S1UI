import { useEffect, useState } from "react";
import { Button, Form, Input, App as AntdApp, Space } from "antd";
import { useNavigate } from "react-router-dom";
import { s1 } from "../api/s1";
import { useAuthStore } from "../store/auth";
import { useT } from "../i18n";

interface FormValues {
  hostname: string;
  apiToken: string;
}

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [form] = Form.useForm<FormValues>();
  const nav = useNavigate();
  const { message } = AntdApp.useApp();
  const setConnected = useAuthStore((s) => s.setConnected);
  const t = useT();

  useEffect(() => {
    s1.loadSavedCredentials()
      .then((saved) => {
        if (saved) {
          form.setFieldsValue({
            hostname: saved.hostname,
            apiToken: saved.api_token,
          });
          setHasSaved(true);
        }
      })
      .catch(() => {});
  }, [form]);

  async function onFinish(v: FormValues) {
    setLoading(true);
    try {
      const meta = await s1.login(v);
      setConnected(v.hostname, meta);
      message.success(
        meta.email ? `${t("login.connected")}: ${meta.email}` : t("login.connected"),
      );
      nav("/dashboard");
    } catch (e) {
      message.error(`${t("login.failed")}: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  async function onClear() {
    await s1.clearSavedCredentials();
    form.resetFields();
    form.setFieldsValue({
      hostname: "https://usea1-partners.sentinelone.net",
    });
    setHasSaved(false);
    message.success(t("login.clearSuccess"));
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="brand-bar" />
        <div className="brand-head">
          <div className="brand-logo">S1</div>
          <div>
            <div className="brand-title">{t("login.title")}</div>
            <div className="brand-sub">
              {hasSaved ? t("login.subtitleSaved") : t("login.subtitleNormal")}
            </div>
          </div>
        </div>
        <div className="form-body">
          <Form<FormValues>
            form={form}
            layout="vertical"
            initialValues={{
              hostname: "https://usea1-partners.sentinelone.net",
            }}
            onFinish={onFinish}
            autoComplete="off"
          >
            <Form.Item
              label={t("login.hostname")}
              name="hostname"
              rules={[{ required: true, message: t("login.hostnameRequired") }]}
            >
              <Input placeholder="https://xxx.sentinelone.net" />
            </Form.Item>

            <Form.Item
              label={t("login.token")}
              name="apiToken"
              rules={[{ required: true, message: t("login.tokenRequired") }]}
            >
              <Input.Password placeholder={t("login.tokenPlaceholder")} />
            </Form.Item>

            <Space style={{ width: "100%" }} direction="vertical">
              <Button type="primary" htmlType="submit" loading={loading} block>
                {t("login.submit")}
              </Button>
              {hasSaved && (
                <Button block onClick={onClear} type="text" danger>
                  {t("login.clear")}
                </Button>
              )}
            </Space>
          </Form>
        </div>
      </div>
    </div>
  );
}
