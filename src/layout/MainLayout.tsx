import { useState } from "react";
import { Layout, Menu, Avatar, Dropdown, Space } from "antd";
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
} from "@ant-design/icons";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/auth";
import { s1 } from "../api/s1";
import { useT } from "../i18n";

const { Header, Sider, Content } = Layout;

export default function MainLayout() {
  const nav = useNavigate();
  const loc = useLocation();
  const { userMeta, logout } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const t = useT();

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

  return (
    <Layout style={{ height: "100vh" }}>
      <Sider
        theme="dark"
        width={220}
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
      >
        <div
          style={{
            color: "#fff",
            padding: "18px 16px",
            fontWeight: 600,
            fontSize: 16,
            letterSpacing: 0.5,
            textAlign: collapsed ? "center" : "left",
            whiteSpace: "nowrap",
            overflow: "hidden",
          }}
        >
          {collapsed ? "S1" : "S1 Console"}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[loc.pathname]}
          items={menu}
          onClick={({ key }) => nav(key)}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: "#fff",
            borderBottom: "1px solid #f0f0f0",
            padding: "0 20px",
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
          }}
        >
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
            <Space style={{ cursor: "pointer" }}>
              <Avatar size="small" icon={<UserOutlined />} />
              <span>{userMeta?.email ?? userMeta?.full_name ?? t("common.account")}</span>
            </Space>
          </Dropdown>
        </Header>
        <Content style={{ padding: 20, overflow: "auto", background: "#f5f6fa" }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
