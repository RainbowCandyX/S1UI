# S1UI — SentinelOne 管理控制台

> 基于 **Rust + Tauri 2 + React 18 + Vite + Ant Design 5** 构建的跨平台 SentinelOne 管理控制台。  
> 复刻 SentinelOne 官方 Web Console 的常用运维操作，API 层参考官方 Python SDK。

---

## 功能特性

| 模块 | 说明 |
| --- | --- |
| **登录 / 凭据管理** | 本地 AES-256-GCM 加密保存 API Token + hostname，重开自动填充。SSL 证书验证始终开启。支持「清除保存的凭据」。 |
| **代理设置** | 支持 HTTP / SOCKS5 代理，含开关、地址输入、`myip.ipip.net` 测试按钮。**保存后立即生效**（无需重登）；关闭开关时测试直连。代理地址与 Token 同样加密落盘。 |
| **总览 Dashboard** | Agents 总数 / 在线 / 感染 / 版本过期 / 未处置威胁 / 威胁总数 六宫格。 |
| **Agents（端点）** | 列选择（默认隐藏站点/组/外网 IP/域）、客户端模糊搜索、批量操作（断网隔离 / 恢复网络 / 关机 / 重启 / 全盘扫描 / 抓取日志 / 卸载 / 升级）、保护控制（启用 / 禁用 + 可选重启）。 |
| **Threats（威胁）** | 四组操作菜单：缓解（kill/quarantine/remediate/rollback）、分析判定、事件状态、黑/白名单。客户端模糊搜索 + 列选择。 |
| **Sites（站点）** | 列选择 + 模糊搜索。 |
| **Exclusions（排除列表）** | 单页内 Segmented 切换「白名单 / 黑名单」，默认隐藏 cloud 内置条目。支持添加弹窗（作用域 site/group + 类型 + OS + 值 + 描述），按类型分组批量删除。 |
| **Deep Visibility** | 异步 init-query → 轮询 query-status → 拉取 events。预设 9 种（进程/网络/文件/DNS/注册表/登录/计划任务/驱动加载/自定义），状态含失败超时处理，CSV 导出。 |
| **Settings（设置）** | 界面语言切换（简体中文 / English，AntD locale 自动同步）；代理配置与测试。 |

---

## 技术栈

- **后端**: Rust 2024 edition  
  - `tauri = 2` / `tauri-plugin-opener`
  - `reqwest 0.12`（rustls-tls + gzip + socks）
  - `aes-gcm 0.10` + `base64 0.22`（凭据加密）
  - `serde` / `serde_json` / `tokio`
- **前端**: React 18 + TypeScript
  - Vite 5 构建
  - `antd 5` + `@ant-design/pro-components`
  - `react-router-dom 6`（HashRouter）
  - `zustand 5` + `zustand/middleware`（状态 + localStorage 持久化）
  - `dayjs`（时间本地化）

---

## 目录结构

```
S1UI/
├── Cargo.toml                  # workspace + profiles
├── package.json
├── vite.config.ts              # 固定端口 1420 / HMR 1421
├── tsconfig.json
├── index.html
├── src/                        # 前端源码
│   ├── main.tsx                # 根组件 + AntD ConfigProvider（语言联动）
│   ├── App.tsx                 # 路由守卫 + 页面注册
│   ├── styles.css
│   ├── api/
│   │   ├── s1.ts               # 所有 Tauri invoke 封装 + TS 类型
│   │   └── filters.ts          # 内置 exclusion 判定
│   ├── i18n/index.ts           # 语言字典 + zustand store + useT() hook
│   ├── store/auth.ts           # 登录态
│   ├── utils/time.ts           # ISO→本地时区
│   ├── components/
│   │   ├── ResourceTable.tsx   # 通用列表（搜索/分页/选择/列切换）
│   │   └── ColumnPicker.tsx    # S1 Web 风格列选择器
│   ├── layout/MainLayout.tsx   # 侧栏 + 账户下拉
│   └── pages/                  # Login / Dashboard / Agents / Threats / Sites /
│                               # Exclusions / DeepVisibility / Settings
└── src-tauri/
    ├── Cargo.toml
    ├── build.rs
    ├── tauri.conf.json         # bundle.active = false（默认只产可执行文件）
    ├── capabilities/default.json
    ├── icons/                  # 从 SentinelOne_UI/resources/Logo.png 生成
    └── src/
        ├── main.rs
        ├── lib.rs              # invoke_handler 注册所有命令
        ├── error.rs            # thiserror + Serialize
        ├── models.rs           # DTO（Agent / Threat / DVEvent …）
        ├── client.rs           # Session = reqwest Client + 可选 proxy
        ├── config.rs           # s1ui.ini 读写 + AES-GCM
        └── commands.rs         # #[tauri::command] —— 登录 / 列表 / 动作 / DV / Proxy
```

---

## API 映射（Python SDK → 本项目）

| Python SDK | Rust Command | S1 端点 |
| --- | --- | --- |
| `Management.agents.get()` | `s1_list_agents` | `GET /agents` |
| `AgentActions.*` | `s1_agent_action` | `POST /agents/actions/{action}` |
| `agent_actions.enable_agent()` | `s1_enable_agent` | `POST /agents/actions/enable-agent` |
| `agent_actions.disable_agent()` | `s1_disable_agent` | `POST /agents/actions/disable-agent` |
| `Management.threats.get()` | `s1_list_threats` | `GET /threats` |
| `ThreatActions.mitigate()` | `s1_threat_action` | `POST /threats/mitigate/{action}` |
| — | `s1_threat_verdict` | `POST /threats/analyst-verdict` |
| — | `s1_threat_incident_status` | `POST /threats/incident` |
| `Management.sites` | `s1_list_sites` | `GET /sites`（`data.sites` 嵌套） |
| `Management.exclusions.get_white()` | `s1_list_exclusions` | `GET /exclusions`（循环 cursor 拉全部） |
| `Management.exclusions.get_black()` | `s1_list_restrictions` | `GET /restrictions` |
| `create_white/black()` | `s1_create_exclusion/restriction` | `POST /exclusions` / `/restrictions` |
| `delete_white/black()` | `s1_delete_exclusions/restrictions` | `DELETE /exclusions` / `/restrictions` |
| `deep_visibility_v2.init_query()` | `s1_dv_init_query` | `POST /dv/init-query` |
| `deep_visibility_v2.get_query_status()` | `s1_dv_query_status` | `GET /dv/query-status` |
| `deep_visibility_v2.get_events()` | `s1_dv_events` | `GET /dv/events` |

所有请求共享以下规则：
- `Authorization: APIToken <token>`（**大写 API**，这是 SentinelOne 后端要求，小写会 401）
- Exclusions / Restrictions list 请求必带 `includeChildren=true` + `includeParents=true`（否则返回空）
- limit 上限：`/sites` = 100，`/groups` = 200，`/exclusions` = 1000（硬上限 300）
- 代理通过 `reqwest::Proxy::all(...)`，SOCKS5 需 `socks` feature

---

## 环境要求

- Rust 1.85+（当前测试于 1.94；edition 2024 要求 ≥ 1.85）
- Node 18+ / pnpm 9+
- macOS / Windows / Linux（Tauri 2 支持）

```bash
# 工具链（一次性）
cargo install tauri-cli --locked
pnpm install
```

---

## 运行与构建

| 命令 | 用途 | 产物 |
| --- | --- | --- |
| `pnpm tauri dev` | 开发模式，Vite HMR + Rust 热重启 | — |
| `pnpm tauri build --debug --no-bundle` | 增量 Debug 可执行文件 | `target/debug/s1ui` (~39 MB，带符号) |
| `pnpm tauri build --no-bundle` | Release 构建（LTO），不打安装包 | `target/release/s1ui` (~7 MB) |
| `pnpm tauri icon <path.png>` | 生成完整图标集 | `src-tauri/icons/` |

> `tauri.conf.json` 的 `bundle.active = false`，所以默认永远只产二进制不产 `.app / .dmg`。  
> 若需要安装包，先把它改回 `true` 再 `pnpm tauri build`。

### 从终端启动（可看 Rust 日志）

```bash
cd /Users/rainbow/Dev/S1UI
RUST_LOG=info ./target/debug/s1ui
```

---

## 配置文件 s1ui.ini

启动后在**可执行文件同级目录**自动生成（`target/debug/s1ui.ini` 或 `target/release/s1ui.ini`）。

```ini
[auth]
hostname = https://xxx.sentinelone.net
api_token_enc = <base64-nonce>|<base64-ciphertext>

[proxy]
enabled = true
proxy_type = http
url_enc = <base64-nonce>|<base64-ciphertext>
```

- **加密算法**: AES-256-GCM，密钥内嵌二进制（本地 obfuscation）
- **清除凭据**: 登录页面的「清除保存的凭据」按钮会删除整个 ini 文件

---

## License

[MIT License](LICENSE) © 2026 Rainbow
