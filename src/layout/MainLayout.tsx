import { useState } from "react";
import { Layout, Menu, Avatar, Dropdown, Space, Tooltip, Button } from "antd";
import {
  DashboardOutlined,
  DesktopOutlined,
  BugOutlined,
  ApartmentOutlined,
  StopOutlined,
  SearchOutlined,
  SettingOutlined,
  LogoutOutlined,
  UserOutlined,
  BulbOutlined,
  BulbFilled,
} from "@ant-design/icons";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/auth";
import { useSettings, useEffectiveTheme } from "../store/settings";
import { s1 } from "../api/s1";
import { useT } from "../i18n";

const { Header, Sider, Content } = Layout;

export default function MainLayout() {
  const nav = useNavigate();
  const loc = useLocation();
  const { userMeta, logout } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const t = useT();
  const themeMode = useSettings((s) => s.themeMode);
  const setThemeMode = useSettings((s) => s.setThemeMode);
  const effective = useEffectiveTheme();

  const menu = [
    { key: "/dashboard", icon: <DashboardOutlined />, label: t("menu.dashboard") },
    { key: "/agents", icon: <DesktopOutlined />, label: t("menu.agents") },
    { key: "/threats", icon: <BugOutlined />, label: t("menu.threats") },
    { key: "/sites", icon: <ApartmentOutlined />, label: t("menu.sites") },
    { key: "/exclusions", icon: <StopOutlined />, label: t("menu.exclusions") },
    { key: "/deep-visibility", icon: <SearchOutlined />, label: t("menu.dv") },
    { key: "/settings", icon: <SettingOutlined />, label: t("menu.settings") },
  ];

  async function handleLogout() {
    await s1.logout().catch(() => {});
    logout();
    nav("/login");
  }

  function toggleTheme() {
    if (themeMode === "light") setThemeMode("dark");
    else if (themeMode === "dark") setThemeMode("auto");
    else setThemeMode("light");
  }

  const themeTip =
    themeMode === "light"
      ? t("settings.themeLight")
      : themeMode === "dark"
        ? t("settings.themeDark")
        : t("settings.themeAuto");

  return (
    <Layout style={{ height: "100vh" }}>
      <Sider
        theme="dark"
        width={220}
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        className="app-sider"
      >
        <div className="app-brand">
          <div className="logo">{collapsed ? "S1" : "S1"}</div>
          {!collapsed && <div className="title">S1 Console</div>}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[loc.pathname]}
          items={menu}
          onClick={({ key }) => nav(key)}
          style={{ background: "transparent", borderInlineEnd: "none" }}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            borderBottom: "1px solid var(--border-subtle)",
            padding: "0 20px",
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Tooltip title={themeTip} placement="bottom">
            <Button
              type="text"
              icon={effective === "dark" ? <BulbFilled /> : <BulbOutlined />}
              onClick={toggleTheme}
              aria-label={t("settings.theme")}
            />
          </Tooltip>
          <Dropdown
            menu={{
              items: [
                {
                  key: "logout",
                  label: t("common.logout"),
                  icon: <LogoutOutlined />,
                  onClick: handleLogout,
                },
              ],
            }}
          >
            <Space style={{ cursor: "pointer", padding: "0 8px" }}>
              <Avatar size="small" icon={<UserOutlined />} />
              <span>{userMeta?.email ?? userMeta?.full_name ?? t("common.account")}</span>
            </Space>
          </Dropdown>
        </Header>
        <Content
          style={{
            padding: 20,
            overflow: "auto",
            background: "var(--bg-app)",
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
