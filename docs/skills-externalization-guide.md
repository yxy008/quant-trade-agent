# Skills 外部化调用方案：Git Submodule + Function Call 桥接

## 一、方案概述

将 `skills/` 目录从主项目中剥离为独立的 Git 仓库，托管在 GitHub 上。主项目通过 **Git Submodule** 引用该仓库，通过 **skill_loader.py** 实现动态模块发现与加载，并通过 **Function Call 桥接层** 对外暴露 OpenAI 格式的工具调用接口。

| 维度 | 说明 |
|------|------|
| skills 管理方式 | 独立 Git 仓库，在 GitHub 上单独维护，有自己的版本号和发布周期 |
| 主项目引用方式 | Git Submodule，锁定到 skills 仓库的特定 commit |
| 动态加载机制 | skill_loader.py 启动时扫描 skills/ 目录，自动发现、导入、注册所有 skill |
| AI 调用方式 | `/api/fc/tools` 获取工具定义 -> AI 选择工具 -> `/api/fc/dispatch` 执行 |
| 新增 skill 步骤 | skills 仓库中创建目录 -> 推送 -> 主项目 `submodule update` |
| 置信度 | 98 |

---

## 二、整体架构

```
主项目 (d:\openclaw\skills\agent\)
├── app.py                    # Flask 主服务
├── skill_loader.py           # 动态加载 + Function Call 桥接层
├── data_utils.py             # 统一数据层
├── db_utils.py               # 数据库工具
├── auth_cli.py               # 认证模块
├── static/                   # 前端静态资源
├── templates/                # 前端模板
└── skills/   <-------------- Git Submodule 引用
    └── (来自独立仓库: https://github.com/yxy008/quant-trading-skills)

独立仓库 (quant-trading-skills)
├── akshare-stock/            # 每个 skill 一个目录
│   ├── scripts/
│   │   └── stock_cli.py
│   ├── _meta.json
│   └── SKILL.md
├── backtest/
│   ├── scripts/
│   │   └── backtest_cli.py
│   ├── _meta.json
│   └── SKILL.md
├── ... (共 50+ 个 skill)
├── README.md
├── LICENSE
├── requirements.txt
└── .gitignore
```

**核心原理**：skills 目录是一个独立的 Git 仓库，主项目通过 Git Submodule 引用它。`skill_loader.py` 在启动时自动扫描 `skills/` 目录，发现所有 skill 并动态加载其 Python 模块，同时生成 OpenAI Function Call 格式的工具定义。

---

## 三、操作步骤

### 第一步：将 skills 目录初始化为独立 Git 仓库

当前 `skills/` 目录已经包含了 `README.md`、`LICENSE`、`requirements.txt`、`.gitignore`，可以直接初始化为独立仓库。

```powershell
# 1. 进入 skills 目录
cd d:\openclaw\skills\agent\skills

# 2. 初始化为 Git 仓库
git init

# 3. 添加所有文件到暂存区
git add .

# 4. 查看将要提交的文件（确认没有敏感文件）
git status

# 5. 首次提交
git commit -m "初始化量化交易 Skills 集合，包含 50+ 个 skill 模块"
```

> `.gitignore` 已经配置好了，会排除 `__pycache__/`、`*.db`、`.cache/`、`data/` 等运行时生成的文件。

### 第二步：推送到 GitHub

```powershell
# 1. 在 GitHub 上创建新仓库（例如：quant-trading-skills）
#    访问 https://github.com/new
#    仓库名：quant-trading-skills
#    描述：A股量化交易 Skills 集合
#    不要勾选 "Initialize this repository with a README"（我们已经有了）

# 2. 添加远程仓库
git remote add origin https://github.com/yxy008/quant-trading-skills.git

# 3. 推送到 GitHub
git branch -M main
git push -u origin main

# 4. 验证：在浏览器打开 https://github.com/yxy008/quant-trading-skills
```

### 第三步：在主项目中配置 Git Submodule

```powershell
# 1. 回到主项目根目录
cd d:\openclaw\skills

# 2. 如果 skills 目录当前被主项目 git 跟踪，先移除索引
cd d:\openclaw\skills\agent
git rm --cached skills

# 3. 将 skills 目录移出（临时备份）
cd d:\openclaw\skills\agent
move skills ..\skills_backup

# 4. 添加 Git Submodule
cd d:\openclaw\skills
git submodule add https://github.com/yxy008/quant-trading-skills.git agent/skills

# 5. 初始化并更新 submodule
git submodule update --init --recursive

# 6. 提交主项目的 .gitmodules 变更
git add .gitmodules agent/skills
git commit -m "将 skills 目录迁移为 Git Submodule，引用 quant-trading-skills 仓库"

# 7. 验证 submodule 状态
git submodule status
# 输出类似：+abc1234 agent/skills (v1.0.0)
```

此时目录结构变为：

```
d:\openclaw\skills\
├── .gitmodules              # 新增：submodule 配置文件
├── agent/
│   ├── skills/              # 现在是 submodule（指向独立仓库的某个 commit）
│   ├── app.py
│   ├── skill_loader.py
│   └── ...
└── skills_backup/           # 备份（确认无误后可删除）
```

---

## 四、skill_loader 动态加载机制详解

### 4.1 启动流程

```
Flask 启动
  └─> app.py 导入 skill_loader
       └─> load_all_skills() 被调用
            ├─> _discover_skills()    扫描 skills/ 目录
            │    ├─> 遍历每个子目录
            │    ├─> 读取 _meta.json（元数据）
            │    ├─> 读取 SKILL.md（描述文档）
            │    └─> 找到 scripts/*_cli.py（入口模块）
            │
            ├─> 对每个 skill：
            │    ├─> 将 scripts/ 加入 sys.path
            │    ├─> importlib 动态导入 Python 模块
            │    └─> _extract_exports() 提取所有公开函数
            │
            └─> 返回 _skill_registry（注册表）
```

### 4.2 关键代码解读

#### 发现 skill

```python
def _discover_skills():
    """扫描 skills 目录，发现所有 skill"""
    for entry in sorted(os.listdir(SKILLS_DIR)):
        skill_dir = os.path.join(SKILLS_DIR, entry)
        # 1. 必须是目录
        # 2. 必须有 scripts/ 子目录
        # 3. 读取 _meta.json 获取 slug/version
        # 4. 读取 SKILL.md 获取 name/description
        # 5. 找到 scripts/ 下的 *_cli.py 作为入口
```

#### 动态导入

```python
# 使用 importlib 动态加载，不依赖硬编码的 import 语句
spec = importlib.util.spec_from_file_location(module_name, cli_path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
_module_cache[slug] = module  # 缓存已加载的模块
```

#### 提取导出函数

```python
# 自动提取模块中所有公开函数及其参数签名
# 用于生成 OpenAI function call 的 parameters schema
for attr_name in dir(module):
    if attr_name.startswith("_"):
        continue
    attr = getattr(module, attr_name)
    if callable(attr):
        sig = inspect.signature(attr)  # 获取参数签名
        # 提取参数名、类型、是否必填、默认值
```

### 4.3 app.py 如何使用

`app.py` 中不再有硬编码的 `from xxx import yyy`，而是：

```python
# 旧方式（硬编码，耦合严重）：
# from skills.backtest.scripts.backtest_cli import run_backtest

# 新方式（动态加载，完全解耦）：
from skill_loader import get_module

def _import_from_skill(slug, *names):
    """从指定 skill 动态导入函数"""
    mod = get_module(slug)  # 从缓存获取已加载的模块
    result = []
    for name in names:
        attr = getattr(mod, name, None)
        result.append(attr)
    return result[0] if len(result) == 1 else tuple(result)

# 使用示例：
get_stock_kline = _import_from_skill("akshare-stock", "get_stock_kline")
```

---

## 五、Function Call 桥接层详解

### 5.1 架构

```
外部 AI（如 OpenAI GPT）
  │
  │  function call 请求
  │  {"name": "akshare-stock__get_stock_kline", "arguments": {"symbol": "600519"}}
  ▼
┌─────────────────────────────────────────────┐
│         SkillFunctionCallBridge              │
│                                              │
│  get_tools()        -> 生成 OpenAI tool 定义 │
│  dispatch()         -> 分发单个 function call │
│  dispatch_batch()   -> 批量分发              │
│  search_tools()     -> 按关键词搜索工具      │
│  get_tool_schema()  -> 获取工具 schema       │
│                                              │
│  内部流程：                                  │
│  1. 解析 tool_name -> 提取 slug + func_name  │
│  2. 从 _module_cache 获取已加载的模块        │
│  3. 调用 call_skill_function(slug, fn, args) │
│  4. 序列化结果（DataFrame -> dict）          │
│  5. 返回统一格式 {"success": True/False}     │
└─────────────────────────────────────────────┘
  │
  │  HTTP API 端点
  ▼
app.py 中的 /api/fc/* 路由
```

### 5.2 API 端点一览

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/fc/tools` | GET | 获取所有可用工具定义（OpenAI 格式） |
| `/api/fc/tools/search?keyword=回测` | GET | 按关键词搜索工具 |
| `/api/fc/tools/<tool_name>` | GET | 获取指定工具的完整 schema |
| `/api/fc/dispatch` | POST | 分发单个 function call |
| `/api/fc/dispatch/batch` | POST | 批量分发多个 function call |
| `/api/fc/skills` | GET | 获取所有 skill 及其函数列表 |

### 5.3 使用示例

#### 获取所有工具定义（给 AI 用）

```bash
curl http://localhost:5000/api/fc/tools
```

返回：

```json
{
  "工具总数": 350,
  "工具列表": [
    {
      "type": "function",
      "function": {
        "name": "akshare-stock__get_stock_kline",
        "description": "[A股数据获取] 获取股票K线数据，支持多数据源降级...",
        "parameters": {
          "type": "object",
          "properties": {
            "symbol": {"type": "string", "description": "symbol 参数"},
            "days": {"type": "integer", "description": "days 参数"},
            "adjust": {"type": "string", "description": "adjust 参数"}
          },
          "required": ["symbol"]
        }
      }
    }
  ]
}
```

#### AI 调用 function call

```bash
curl -X POST http://localhost:5000/api/fc/dispatch \
  -H "Content-Type: application/json" \
  -d '{
    "tool_name": "akshare-stock__get_stock_kline",
    "arguments": {"symbol": "600519", "days": 30}
  }'
```

返回：

```json
{
  "success": true,
  "result": [
    {"日期": "2026-04-01", "开盘": 1680.0, "收盘": 1695.0}
  ],
  "tool_name": "akshare-stock__get_stock_kline",
  "skill": "A股数据获取",
  "function": "get_stock_kline"
}
```

#### 搜索回测相关工具

```bash
curl "http://localhost:5000/api/fc/tools/search?keyword=回测"
```

#### 批量调用

```bash
curl -X POST http://localhost:5000/api/fc/dispatch/batch \
  -H "Content-Type: application/json" \
  -d '{
    "tool_calls": [
      {"name": "akshare-stock__get_stock_kline", "arguments": {"symbol": "600519"}},
      {"name": "talib-indicator__calculate_all_indicators", "arguments": {"symbol": "600519"}}
    ]
  }'
```

---

## 六、后续 skills 管理流程

### 6.1 新增一个 skill

```powershell
# 1. 进入 skills 仓库目录
cd d:\openclaw\skills\agent\skills

# 2. 创建新 skill 目录（严格遵循格式）
mkdir my-new-skill
mkdir my-new-skill\scripts

# 3. 创建 _meta.json
# 内容示例：
# {
#   "slug": "my-new-skill",
#   "version": "1.0.0",
#   "author": "your-name",
#   "tags": ["选股", "技术分析"]
# }

# 4. 创建 SKILL.md
# 内容示例：
# ---
# name: 我的新策略
# description: 这是一个基于XXX的选股策略
# ---
# # 我的新策略
# ## 功能说明
# ...
# ## 使用方法
# ...

# 5. 创建 scripts/my_cli.py（入口模块）
# 导出公开函数即可，skill_loader 会自动发现

# 6. 提交到 skills 仓库
git add my-new-skill/
git commit -m "新增 my-new-skill 模块"
git push origin main

# 7. 在主项目中更新 submodule
cd d:\openclaw\skills
git submodule update --remote agent/skills
git add agent/skills
git commit -m "更新 skills submodule：新增 my-new-skill"
```

### 6.2 更新已有 skill

```powershell
# 1. 进入 skills 仓库
cd d:\openclaw\skills\agent\skills

# 2. 修改代码
# 编辑 akshare-stock/scripts/stock_cli.py

# 3. 提交
git add akshare-stock/
git commit -m "优化 akshare-stock K线数据获取逻辑"
git push origin main

# 4. 主项目更新
cd d:\openclaw\skills
git submodule update --remote agent/skills
```

### 6.3 克隆主项目（含 submodule）

```powershell
# 新开发者克隆项目时：
git clone --recurse-submodules https://github.com/yxy008/your-main-project.git

# 或者先克隆再初始化 submodule：
git clone https://github.com/yxy008/your-main-project.git
cd your-main-project
git submodule update --init --recursive
```

### 6.4 日常开发工作流

```powershell
# 日常开发时，skills 目录就是一个普通的 Git 仓库：

cd d:\openclaw\skills\agent\skills
git pull origin main        # 拉取最新 skills
# ... 修改代码 ...
git add .
git commit -m "xxx"
git push origin main        # 推送到 skills 独立仓库

cd d:\openclaw\skills
git add agent/skills        # 主项目记录新的 submodule commit
git commit -m "更新 skills"
```

---

## 七、Skill 目录格式规范

每个 skill 必须遵循以下目录结构：

```
skill-name/
├── scripts/           # Python 脚本目录（必须）
│   └── xxx_cli.py     # 入口模块，导出公开函数
├── _meta.json         # 元数据文件（必须）
└── SKILL.md           # 说明文档（必须）
```

### _meta.json 格式

```json
{
  "slug": "skill-name",
  "version": "1.0.0",
  "author": "author-name",
  "tags": ["标签1", "标签2"],
  "dependencies": ["akshare", "pandas"]
}
```

### SKILL.md 格式

```markdown
---
name: Skill 中文名称
description: Skill 的简要描述
---

# Skill 中文名称

## 功能说明
...

## 使用方法
...

## API 参考
...
```

---

## 八、验证与测试

```powershell
# 1. 启动主项目
cd d:\openclaw\skills\agent
.venv\Scripts\python app.py

# 2. 测试 skill 加载状态
curl http://localhost:5000/api/fc/skills
# 应返回所有 skill 列表和函数总数

# 3. 测试 Function Call 工具定义
curl http://localhost:5000/api/fc/tools
# 应返回所有 OpenAI 格式的 tool 定义

# 4. 测试单个 function call 分发
curl -X POST http://localhost:5000/api/fc/dispatch ^
  -H "Content-Type: application/json" ^
  -d "{\"tool_name\": \"akshare-stock__get_stock_kline\", \"arguments\": {\"symbol\": \"600519\", \"days\": 10}}"

# 5. 测试搜索
curl "http://localhost:5000/api/fc/tools/search?keyword=回测"
```

---

## 九、关键文件清单

| 文件 | 作用 |
|------|------|
| `agent/skill_loader.py` | 核心：动态发现、加载、Function Call 桥接 |
| `agent/app.py` | 主服务：使用 `_import_from_skill()` 动态导入 + `/api/fc/*` 端点 |
| `agent/skills/.gitignore` | 独立仓库的忽略规则 |
| `agent/skills/README.md` | 独立仓库的说明文档 |
| `agent/skills/requirements.txt` | 独立仓库的依赖 |
| `agent/skills/LICENSE` | MIT 许可证 |
| `agent/docs/skills-externalization-guide.md` | 本文档 |

---

## 十、常见问题

### Q: 为什么不直接用 pip 包？

A: pip 包适合稳定发布的场景，但 skills 需要频繁迭代。Git Submodule 允许主项目精确锁定到某个 commit，同时 skills 仓库可以独立快速迭代。

### Q: submodule 更新后需要重启服务吗？

A: 如果只是更新了 skill 的 Python 代码，可以调用 `/api/fc/reload`（如有）或重启服务。`skill_loader.py` 支持 `force_reload=True` 参数强制重新加载。

### Q: 多个项目可以共享同一个 skills 仓库吗？

A: 可以。每个项目通过 Git Submodule 引用同一个 skills 仓库，各自锁定到不同的 commit 版本。

### Q: skills 仓库中的 `data/` 目录会被提交吗？

A: 不会。`.gitignore` 中已配置 `data/` 目录忽略，该目录存放运行时生成的数据库文件。