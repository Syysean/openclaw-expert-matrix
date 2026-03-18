# 🦞 OpenClaw × SiliconFlow 双模型智能路由部署方案

[![Docker](https://img.shields.io/badge/Docker-Ready-blue?logo=docker&logoColor=white)](https://www.docker.com)
[![Windows 11](https://img.shields.io/badge/OS-Windows_11-0078D4?logo=windows&logoColor=white)](https://www.microsoft.com/windows/windows-11)
[![SiliconFlow](https://img.shields.io/badge/API-SiliconFlow-black)](https://siliconflow.cn)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

本项目提供一套完整的实战部署方案，在 Windows 11 + Docker 环境下运行 OpenClaw，通过自建 **智能路由代理（proxy.js）** 对接 SiliconFlow 平台的 DeepSeek（文字）与 Qwen（视觉）双模型，并包含完整的安全加固措施。

> 本教程记录了真实部署过程中的所有步骤与踩坑经验，适合国内用户参考。

---

## 📑 目录

- [✨ 方案特性](#-方案特性)
- [🖥️ 环境信息](#️-环境信息)
- [📋 前置准备](#-前置准备必看)
- [🚀 部署步骤](#-部署步骤核心-10-步)
- [🎉 部署成功示例](#-部署成功示例)
- [🛑 服务管理](#-服务管理与停止)
- [❗ 常见报错与解决方法](#-常见报错与解决方法)
- [🔒 安全注意事项](#-安全注意事项)
- [📂 仓库文件说明](#-仓库文件说明)
- [📚 参考资料](#-参考资料)
- [👤 关于作者](#-关于作者)

---

## ✨ 方案特性

相比直接对接单一模型 API，本方案具备以下优势：

| 特性 | 说明 |
| --- | --- |
| **双模型智能路由** | 纯文字请求 → DeepSeek-V3，含图片请求 → Qwen 视觉模型，自动切换 |
| **独立 API Key 管理** | DeepSeek / Qwen / Embedding 三个 key 相互独立，可单独吊销 |
| **流式传输支持** | 直接 pipe 转发，零缓冲，首字延迟降到最低 |
| **安全加固** | 请求体大小限制（10MB）+ 上游超时保护（120s）|
| **全环境变量化** | 零硬编码，所有密钥通过 `.env` 注入 |

---

## 🖥️ 环境信息

| 项目 | 详情 |
| --- | --- |
| **操作系统** | Windows 11 Home China 25H2 64位 |
| **处理器** | AMD Ryzen 9 7945HX 十六核 |
| **内存** | 16GB DDR5 5200MHz |
| **显卡** | NVIDIA GeForce RTX 5070 Ti Laptop GPU (12GB) |
| **Docker** | Docker Desktop（[www.docker.com](https://www.docker.com)） |
| **AI 模型** | DeepSeek-V3 + Qwen3.5（均通过 SiliconFlow API） |

---

## 📋 前置准备（必看）

### 1. 开启 Windows 虚拟化与 WSL2

在 Windows 11 上运行 Docker 强依赖 WSL2：

1. 在 BIOS 中开启 CPU 虚拟化（任务管理器 → 性能 → CPU → 虚拟化：已启用）
2. 以管理员身份运行 PowerShell，执行以下命令后**重启电脑**：

```powershell
wsl --install
```

### 2. 安装 Git 和 Docker Desktop

- Git：[git-scm.com](https://git-scm.com)
- Docker Desktop：[docker.com](https://www.docker.com)，安装时勾选 "Use WSL 2 based engine"

### 3. 获取 SiliconFlow API Key

前往 [SiliconFlow 控制台](https://cloud.siliconflow.cn/account/ak) 注册并创建 API Key。

建议创建 **3 个独立的 Key**，分别用于：
- DeepSeek 文字推理
- Qwen 视觉推理
- bge-m3 向量嵌入（记忆功能）

> 独立 Key 的好处：某个 Key 泄露时可以单独吊销，不影响其他功能。

---

## 🚀 部署步骤（核心 10 步）

### 第一步：配置 Git 代理（国内网络可选）

```powershell
git config --global http.proxy http://127.0.0.1:10808
git config --global https.proxy http://127.0.0.1:10808
```

### 第二步：克隆 OpenClaw 仓库

```powershell
cd D:\AI
git clone --depth 1 https://github.com/openclaw/openclaw
cd openclaw
```

### 第三步：将本仓库文件覆盖到 openclaw 目录

```powershell
# 克隆本仓库
git clone https://github.com/Syysean/openclaw-deepseek-deploy D:\AI\openclaw-deploy

# 覆盖关键文件
Copy-Item D:\AI\openclaw-deploy\proxy.js D:\AI\openclaw\proxy.js -Force
Copy-Item D:\AI\openclaw-deploy\docker-compose.yml D:\AI\openclaw\docker-compose.yml -Force
Copy-Item D:\AI\openclaw-deploy\.env.example D:\AI\openclaw\.env.example -Force
```

### 第四步：配置环境变量

复制模板并填写真实值：

```powershell
Copy-Item .env.example .env
notepad .env
```

需要填写的关键变量：

```bash
# Gateway 认证 token（用下面命令生成）
# openssl rand -hex 24
OPENCLAW_GATEWAY_TOKEN=你生成的随机token

# SiliconFlow - DeepSeek 文字模型专用
SILICONFLOW_DEEPSEEK_API_KEY=sk-...

# SiliconFlow - Qwen 视觉模型专用
SILICONFLOW_QWEN_API_KEY=sk-...

# SiliconFlow - bge-m3 向量嵌入专用（记忆功能）
SILICONFLOW_EMBED_API_KEY=sk-...
```

> 🔴 **注意**：变量名和等号前后**绝对不能有空格**，否则 Key 读取失败。

### 第五步：构建 Docker 镜像

```powershell
docker build -t openclaw:local .
```

> ⏳ 若遇到 `unexpected EOF` 是网络中断，重跑即可。

### 第六步：启动所有容器

```powershell
docker compose up -d
docker compose ps
```

看到所有服务 `STATUS: Up` 说明启动成功。

验证 proxy 正常：

```powershell
docker compose logs siliconflow-proxy
```

应看到：
```
[proxy] Smart routing proxy on :13001
[proxy] text  -> Pro/deepseek-ai/DeepSeek-V3.2 (SILICONFLOW_DEEPSEEK_API_KEY)
[proxy] image -> Qwen/Qwen3.5-35B-A3B (SILICONFLOW_QWEN_API_KEY)
```

### 第七步：运行配置向导

```powershell
docker compose run --rm openclaw-cli configure
```

按向导依次选择：

| 选项 | 选择 |
| --- | --- |
| Gateway 位置 | Local (this machine) |
| 配置项目 | Gateway |
| Gateway port | 18789 |
| Gateway bind mode | **LAN (All interfaces)** |
| Gateway auth | Token |
| Tailscale exposure | Off |
| Gateway token | 填入 .env 里的 OPENCLAW_GATEWAY_TOKEN |

### 第八步：健康检查

```powershell
docker compose run --rm openclaw-cli health
```

看到 `Gateway: reachable` 说明配置成功。

### 第九步：测试终端对话

```powershell
docker compose run --rm openclaw-cli agent --session-id test01 -m "你好，请自我介绍一下"
```

### 第十步：访问网页界面并批准设备

1. 浏览器打开 `http://localhost:18789`
2. 填入 Gateway Token，点击连接
3. 首次连接需批准设备：

```powershell
# 查看待批准设备
docker compose run --rm openclaw-cli devices list

# 批准设备（替换为实际 ID）
docker compose run --rm openclaw-cli devices approve <requestId>
```

---

## 🎉 部署成功示例

### 终端对话
![终端对话截图](screenshot-cli.png)

### 网页界面
![网页界面截图](screenshot-webui.png)

---

## 🛑 服务管理与停止

```powershell
# 停止并保留数据
docker compose stop

# 停止并移除容器
docker compose down

# 查看实时日志
docker compose logs -f

# 只看 proxy 日志
docker compose logs -f siliconflow-proxy
```

---

## ❗ 常见报错与解决方法

<details>
<summary><b>🔥 点击展开查看全部常见报错</b></summary>

#### 1. `pull access denied for openclaw`
- **原因**：Docker Hub 无公开镜像，需本地构建
- **解决**：执行 `docker build -t openclaw:local .`

#### 2. `Missing config`（Gateway 一直重启）
- **原因**：首次启动无配置文件
- **解决**：`docker-compose.yml` 的 command 末尾已加入 `--allow-unconfigured`，本仓库文件已处理

#### 3. `non-loopback Control UI requires gateway.controlUi.allowedOrigins`
- **原因**：bind 为 lan 但未配置允许来源
- **解决**：`openclaw.json` 已加入 `dangerouslyAllowHostHeaderOriginFallback: true`

#### 4. `Invalid --bind`
- **原因**：`.env` 变量名前有空格
- **解决**：严格检查 `.env`，确保所有变量名前无空格

#### 5. `SILICONFLOW_DEEPSEEK_API_KEY is not set`
- **原因**：`.env` 里的 Key 未填写或变量名拼写错误
- **解决**：确认 `.env` 里三个 `SILICONFLOW_*` 变量均已填入真实 Key

#### 6. `SILICONFLOW_API_KEY is not set`（旧版 proxy.js）
- **原因**：项目目录里的 `proxy.js` 是旧版文件
- **解决**：用本仓库的新版 `proxy.js` 覆盖，再重启 proxy 容器

#### 7. `gateway token mismatch`
- **原因**：`.env` 里的 token 与 `openclaw.json` 里不一致
- **解决**：重跑 `configure` 向导，或确保两处完全一致

#### 8. `404 status code (no body)`
- **原因**：Agent 使用了错误的模型路径
- **解决**：确认 `openclaw.json` 里 model 为 `siliconflow/deepseek`

#### 9. `Verification failed: status 402`
- **原因**：SiliconFlow 账户余额不足
- **解决**：前往 SiliconFlow 控制台充值

#### 10. `LLM request timed out`
- **原因**：proxy 容器未正常启动或 Key 未配置
- **解决**：`docker compose logs siliconflow-proxy` 查看原因

#### 11. `unauthorized: gateway token missing`
- **原因**：网页端未填 token 或填错
- **解决**：填入与 `.env` 一致的 `OPENCLAW_GATEWAY_TOKEN`

#### 12. `pairing required`
- **原因**：新设备首次连接需批准
- **解决**：用 `devices list` 查看，`devices approve <id>` 批准

#### 13. `ERR_EMPTY_RESPONSE`
- **原因**：Gateway bind 或 controlUi 配置错误
- **解决**：检查 `openclaw.json` 的 bind 和 dangerouslyAllowHostHeaderOriginFallback

#### 14. `ERR_CONNECTION_REFUSED`
- **原因**：`openclaw.json` 格式错误导致容器崩溃
- **解决**：用备份恢复，在 [jsonlint.com](https://jsonlint.com) 验证格式后再修改

</details>

---

## 🔒 安全注意事项

1. **绝对不要**将 `.env` 上传至 GitHub（`.gitignore` 已排除）
2. **绝对不要**在任何文件里硬编码 API Key
3. API Key 泄露后立即在 SiliconFlow 控制台吊销并重新生成
4. Gateway Token 泄露后重新生成，更新 `.env` 后重启容器：
   ```powershell
   docker compose restart openclaw-gateway
   ```
5. `dangerouslyAllowHostHeaderOriginFallback: true` 为局域网部署必要配置，若绑定固定域名可关闭

---

## 📂 仓库文件说明

```
├── proxy.js              # 智能路由代理：双模型路由 + 流式转发 + 安全加固
├── docker-compose.yml    # 容器编排：SiliconFlow 变量注入
├── .env.example          # 环境变量模板，复制为 .env 后填入真实值
├── screenshot-cli.png    # 终端交互截图
└── screenshot-webui.png  # 网页控制台截图
```

### proxy.js 核心逻辑

```
请求进入 proxy（:13001）
    │
    ├─ 含图片？──→ Qwen/Qwen3.5-35B-A3B（SILICONFLOW_QWEN_API_KEY）
    │
    └─ 纯文字？──→ Pro/deepseek-ai/DeepSeek-V3.2（SILICONFLOW_DEEPSEEK_API_KEY）
```

---

## 📚 参考资料

- [OpenClaw 官方文档](https://docs.openclaw.ai)
- [OpenClaw GitHub](https://github.com/openclaw/openclaw)
- [SiliconFlow 文档](https://docs.siliconflow.cn)
- [Docker Desktop 官网](https://www.docker.com)

---

## 👤 关于作者

**湖南工商大学 机器人工程专业 大一学生**，借助 AI 完成了这次完整的部署实践。

欢迎提交 [Issue](https://github.com/Syysean/openclaw-deepseek-deploy/issues) 或 PR！
