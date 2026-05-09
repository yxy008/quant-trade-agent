# AI 股票分析智能体 (Quant Agent)

基于 Flask 的 AI 量化交易分析平台，集成多种炒股技能，提供 Web 可视化界面。

## 项目结构

```
agent/
├── app.py                  # 主服务入口（精简版，仅负责启动和路由注册）
├── routes/                 # 路由模块（按功能拆分）
│   ├── __init__.py         # 蓝图注册中心
│   ├── utils.py            # 共享工具函数（缓存、信号解读、持仓加载等）
│   ├── market.py           # 大盘/板块/资金流向/市场宽度/股票筛选
│   ├── stock.py            # 股票分析/技术指标/K线/对比/评分
│   ├── portfolio.py        # 持仓管理/策略组合管理
│   ├── backtest.py         # 回测系统/策略框架/参数优化
│   ├── trading.py          # 模拟交易/订单管理(OMS)
│   ├── risk.py             # 风控系统/实时监控/蒙特卡洛模拟
│   ├── ai.py               # AI Agent 对话/分析/策略生成
│   ├── auth.py             # 用户认证/注册/登录/密码修改
│   ├── scheduler.py        # 定时任务调度/任务管理
│   ├── factor.py           # 因子分析/因子挖掘/因子回测
│   ├── attribution.py      # 归因分析/绩效归因
│   ├── notify.py           # 消息推送/通知管理
│   ├── skills.py           # Skills 管理/注册/发现/调用
│   └── data_quality.py     # 数据质量检查/清洗/修复
├── skill_loader.py         # 动态 Skill 加载器
├── skill_registry.py       # Skill 注册表管理
├── data_utils.py           # 数据获取工具（行情/K线/资金流向）
├── db_utils.py             # 数据库工具（MySQL 连接/查询）
├── auth_cli.py             # 用户认证模块
├── native_app.py           # 桌面应用入口（PyWebView）
├── desktop_launcher.py     # 桌面启动器
├── init_database.sql       # 数据库初始化 SQL
├── test.py                 # 测试脚本
├── window_config.json      # 窗口配置
├── static/                 # 前端静态资源
│   ├── css/style.css
│   └── js/app.js
├── templates/              # Jinja2 模板
│   └── index.html
└── docs/                   # 文档
    └── skills-externalization-guide.md
```

## 技术栈

| 层级 | 技术 |
|------|------|
| Web 框架 | Flask |
| 前端 | HTML5 + CSS3 + JavaScript (ECharts) |
| 数据库 | MySQL (PyMySQL) |
| 数据源 | AkShare |
| 技术指标 | TA-Lib |
| AI 对话 | OpenAI 兼容 API |
| 桌面端 | PyWebView |
| 打包 | PyInstaller |

## 快速开始

### 环境要求

- Python 3.10+
- MySQL 5.7+
- TA-Lib (需要系统级安装)

### 安装依赖

```bash
pip install -r requirements.txt
```

### 配置环境变量

```bash
# 数据库配置
export DB_HOST=127.0.0.1
export DB_PORT=3306
export DB_USER=root
export DB_PASSWORD=your_password
export DB_NAME=quant_agent

# AI 配置（可选）
export AI_API_KEY=your_api_key
export AI_BASE_URL=https://api.openai.com/v1
export AI_MODEL=gpt-4
```

### 初始化数据库

```bash
mysql -u root -p < init_database.sql
```

### 启动服务

```bash
cd agent
python app.py
```

访问 http://127.0.0.1:5000

### 桌面应用模式

```bash
python native_app.py
```

## API 路由概览

### 大盘相关 (`/api/market/*`)
| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/market/trend` | GET | 大盘趋势 |
| `/api/market/status` | GET | 市场状态 |
| `/api/market/news` | GET | 市场热点 |
| `/api/market/funds/northbound` | GET | 北向资金 |
| `/api/market/funds/industry` | GET | 行业资金 |
| `/api/market/funds/overview` | GET | 资金概览 |
| `/api/market/filter` | POST | 股票筛选 |
| `/api/market/breadth` | GET | 市场宽度 |
| `/api/market/breadth/sector` | GET | 板块宽度 |
| `/api/sectors` | GET | 板块列表 |
| `/api/sectors/<name>` | GET | 板块详情 |
| `/api/pool` | GET | 股票池 |
| `/api/pool/sectors` | GET | 股票池板块 |

### 股票分析 (`/api/stock/*`)
| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/stock/<symbol>/analysis` | GET | 综合分析 |
| `/api/stock/<symbol>/financial` | GET | 财务数据 |
| `/api/stock/<symbol>/news` | GET | 舆情分析 |
| `/api/stock/<symbol>/income` | GET | 利润表 |
| `/api/stock/<symbol>/balance` | GET | 资产负债表 |
| `/api/stock/risk` | GET | 风险指标 |
| `/api/stock/compare` | GET | 多股对比 |
| `/api/stock/indicators` | GET | 技术指标 |
| `/api/indicator/kline` | POST | K线数据 |
| `/api/score/batch` | POST | 批量评分 |
| `/api/position/single` | POST | 单股仓位 |
| `/api/position/batch` | POST | 批量仓位 |

### 持仓管理 (`/api/portfolio/*`)
| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/portfolio` | GET | 持仓列表 |
| `/api/portfolio/add` | POST | 添加持仓 |
| `/api/portfolio/<id>` | DELETE | 删除持仓 |
| `/api/portfolio/analysis` | GET | 持仓分析 |
| `/api/portfolio/create` | POST | 创建组合 |
| `/api/portfolio/allocate` | POST | 资金分配 |
| `/api/portfolio/backtest` | POST | 组合回测 |
| `/api/portfolio/optimize` | POST | 组合优化 |

### 回测系统 (`/api/backtest/*`)
| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/strategy/list` | GET | 策略列表 |
| `/api/strategy/signals` | POST | 策略信号 |
| `/api/backtest/run` | POST | 运行回测 |
| `/api/backtest/compare` | POST | 策略对比 |
| `/api/backtest/history` | GET | 回测历史 |
| `/api/backtest/trend` | GET | 回测趋势 |
| `/api/backtest/delete` | POST | 删除回测 |
| `/api/backtest/custom` | POST | 自定义回测 |
| `/api/backtest/batch` | POST | 批量回测 |
| `/api/backtest/records` | GET/DELETE | 回测记录 |
| `/api/backtest/portfolio` | POST | 组合回测 |
| `/api/optimizer/grid` | POST | 网格优化 |
| `/api/optimizer/ga` | POST | 遗传算法优化 |
| `/api/optimizer/walkforward` | POST | 步进优化 |

### 模拟交易 (`/api/paper/*`, `/api/oms/*`)
| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/paper/init` | POST | 初始化 |
| `/api/paper/account` | GET/POST | 账户管理 |
| `/api/paper/order` | POST | 下单 |
| `/api/paper/positions` | GET | 持仓查询 |
| `/api/paper/orders` | GET | 订单查询 |
| `/api/paper/trades` | GET | 成交查询 |
| `/api/paper/order/cancel` | POST | 撤单 |
| `/api/oms/twap` | POST | TWAP 拆单 |
| `/api/oms/vwap` | POST | VWAP 拆单 |
| `/api/oms/iceberg` | POST | 冰山订单 |
| `/api/oms/smart` | POST | 智能下单 |
| `/api/oms/modify` | POST | 改单 |

### 风控系统 (`/api/risk/*`, `/api/monitor/*`, `/api/monte-carlo/*`)
| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/risk/check` | POST | 风险检查 |
| `/api/risk/var` | POST | VaR 计算 |
| `/api/risk/drawdown` | POST | 回撤分析 |
| `/api/risk/limits` | POST | 限额检查 |
| `/api/risk/stress` | POST | 压力测试 |
| `/api/risk/pre-check` | POST | 事前风控 |
| `/api/risk/in-trade` | POST | 事中风控 |
| `/api/risk/post-trade` | POST | 事后风控 |
| `/api/risk/stress-test` | POST | 组合压力测试 |
| `/api/risk/var-breakdown` | POST | VaR 分解 |
| `/api/risk/config/default` | GET | 默认风控配置 |
| `/api/monitor/quote` | POST | 实时行情 |
| `/api/monitor/anomaly` | POST | 异常检测 |
| `/api/monitor/pnl` | POST | 盈亏计算 |
| `/api/monitor/portfolio` | POST | 组合监控 |
| `/api/monitor/market` | GET | 市场监控 |
| `/api/monte-carlo/simulate` | POST | 蒙特卡洛模拟 |
| `/api/monte-carlo/overfitting` | POST | 过拟合检测 |

### AI Agent (`/api/ai/*`)
| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/ai/chat` | POST | AI 对话 |
| `/api/ai/analyze` | POST | AI 分析 |
| `/api/ai/strategy` | POST | AI 策略生成 |
| `/api/ai/market` | POST | AI 市场分析 |
| `/api/ai/config` | GET/POST | AI 配置 |
| `/api/ai/models` | GET | 可用模型 |
| `/api/ai/history` | GET/DELETE | 对话历史 |

### 用户认证 (`/api/auth/*`)
| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/auth/register` | POST | 注册 |
| `/api/auth/login` | POST | 登录 |
| `/api/auth/change-password` | POST | 修改密码 |
| `/api/auth/reset-password` | POST | 重置密码 |
| `/api/auth/users` | GET | 用户列表 |

### 定时任务 (`/api/scheduler/*`)
| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/scheduler/status` | GET | 调度器状态 |
| `/api/scheduler/jobs` | GET | 任务列表 |
| `/api/scheduler/job` | POST | 添加任务 |
| `/api/scheduler/job/<id>` | DELETE | 删除任务 |
| `/api/scheduler/job/<id>/pause` | POST | 暂停任务 |
| `/api/scheduler/job/<id>/resume` | POST | 恢复任务 |
| `/api/scheduler/start` | POST | 启动调度器 |
| `/api/scheduler/stop` | POST | 停止调度器 |

### 因子分析 (`/api/factor/*`)
| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/factor/list` | GET | 因子列表 |
| `/api/factor/calculate` | POST | 计算因子 |
| `/api/factor/backtest` | POST | 因子回测 |
| `/api/factor/ic` | POST | IC 分析 |
| `/api/factor/correlation` | POST | 因子相关性 |
| `/api/factor/ranking` | POST | 因子排名 |

### 归因分析 (`/api/attribution/*`)
| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/attribution/brinson` | POST | Brinson 归因 |
| `/api/attribution/factor` | POST | 因子归因 |
| `/api/attribution/sector` | POST | 行业归因 |
| `/api/attribution/report` | POST | 归因报告 |

### 消息通知 (`/api/notify/*`)
| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/notify/send` | POST | 发送通知 |
| `/api/notify/channels` | GET | 通知渠道 |
| `/api/notify/config` | GET/POST | 通知配置 |
| `/api/notify/history` | GET | 通知历史 |
| `/api/notify/template` | POST | 保存模板 |
| `/api/notify/templates` | GET | 模板列表 |

### Skills 管理 (`/api/skills/*`)
| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/skills/list` | GET | Skill 列表 |
| `/api/skills/<name>` | GET/DELETE | Skill 详情/注销 |
| `/api/skills/<name>/call` | POST | 调用 Skill |
| `/api/skills/reload` | POST | 重新加载 |
| `/api/skills/refresh` | POST | 刷新注册表 |
| `/api/skills/status` | GET | 状态查询 |
| `/api/skills/register` | POST | 注册 Skill |
| `/api/skills/<name>/enable` | POST | 启用 |
| `/api/skills/<name>/disable` | POST | 禁用 |
| `/api/skills/<name>/config` | GET/POST | 配置管理 |
| `/api/skills/<name>/deps` | GET | 依赖查询 |
| `/api/skills/<name>/version` | GET | 版本查询 |
| `/api/skills/<name>/docs` | GET | 文档查询 |
| `/api/skills/<name>/test` | POST | 测试 |
| `/api/skills/<name>/logs` | GET | 日志查询 |
| `/api/skills/<name>/metrics` | GET | 指标查询 |
| `/api/skills/<name>/health` | GET | 健康检查 |
| `/api/skills/<name>/export` | GET | 导出 |
| `/api/skills/import` | POST | 导入 |
| `/api/skills/search` | GET | 搜索 |
| `/api/skills/categories` | GET | 分类 |
| `/api/skills/stats` | GET | 统计 |
| `/api/skills/graph` | GET | 依赖图 |
| `/api/skills/<name>/hotfix` | POST | 热修复 |
| `/api/skills/<name>/rollback` | POST | 回滚 |
| `/api/skills/<name>/audit` | GET | 审计 |
| `/api/skills/<name>/permissions` | GET/POST | 权限管理 |
| `/api/skills/<name>/rate-limit` | GET/POST | 限流管理 |
| `/api/skills/<name>/schedule` | POST/DELETE | 定时调度 |
| `/api/skills/<name>/backup` | POST | 备份 |
| `/api/skills/<name>/restore` | POST | 恢复 |
| `/api/skills/<name>/backups` | GET | 备份列表 |
| `/api/skills/<name>/events` | GET | 事件查询 |
| `/api/skills/<name>/subscribe` | POST | 事件订阅 |
| `/api/skills/<name>/unsubscribe` | POST | 取消订阅 |

### 数据质量 (`/api/data/quality/*`)
| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/data/quality/check` | POST | 质量检查 |
| `/api/data/quality/clean` | POST | 数据清洗 |
| `/api/data/quality/repair` | POST | 数据修复 |
| `/api/data/quality/report` | GET | 质量报告 |
| `/api/data/quality/validate` | POST | 数据校验 |
| `/api/data/quality/stats` | GET | 数据统计 |
| `/api/data/quality/missing` | GET | 缺失分析 |
| `/api/data/quality/outliers` | GET | 异常检测 |
| `/api/data/quality/duplicates` | GET | 重复检查 |
| `/api/data/quality/consistency` | GET | 一致性检查 |
| `/api/data/quality/timeliness` | GET | 时效性检查 |
| `/api/data/quality/completeness` | GET | 完整性检查 |
| `/api/data/quality/accuracy` | GET | 准确性检查 |
| `/api/data/quality/batch` | POST | 批量检查 |
| `/api/data/quality/schedule` | POST | 定时检查 |
| `/api/data/quality/alerts` | GET | 告警列表 |
| `/api/data/quality/alerts/<id>` | DELETE | 关闭告警 |
| `/api/data/quality/config` | GET/POST | 质量配置 |

## 架构设计

### 路由拆分原则

原始 `app.py` 包含全部路由（约 3700 行），现已按功能域拆分为 14 个独立模块：

- 每个模块使用 Flask Blueprint 管理路由
- `routes/__init__.py` 统一注册所有蓝图
- `routes/utils.py` 提供共享工具函数（缓存、信号解读、持仓加载等）
- `app.py` 精简为约 40 行的入口文件

### Skill 动态加载

项目采用插件化架构，通过 `skill_loader.py` 动态发现和加载 `skills/` 目录下的所有技能模块，避免硬编码导入。

### 缓存策略

- 大盘数据缓存 30 分钟
- 通用数据缓存 5 分钟
- 使用内存字典 + 线程锁实现

## 安全注意事项

- 数据库密码等敏感信息通过环境变量配置，不硬编码在代码中
- `.env` 文件已加入 `.gitignore`，不会提交到版本控制
- `skills/` 目录通过 Git Submodule 管理
- 运行时生成的配置文件（`db_config.json`、`ai_config.json` 等）不纳入版本控制