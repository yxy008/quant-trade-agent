-- ============================================================
-- 量化交易系统 - 数据库初始化脚本 (MySQL)
-- 数据库名: quant_agent
-- 字符集: utf8mb4
-- 说明: 包含用户、持仓、回测、模拟交易、AI对话等全部业务表
-- ============================================================

-- 创建数据库
CREATE DATABASE IF NOT EXISTS `quant_agent`
    DEFAULT CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE `quant_agent`;

-- ============================================================
-- 1. 用户表
-- 说明: 存储系统注册用户的基本信息，支持登录认证和角色管理
-- ============================================================
CREATE TABLE IF NOT EXISTS `users` (
    `id`            INT             AUTO_INCREMENT  PRIMARY KEY     COMMENT '用户ID，主键，自增',
    `username`      VARCHAR(50)     NOT NULL        UNIQUE          COMMENT '用户名，唯一，用于登录',
    `password_hash` VARCHAR(255)    NOT NULL                        COMMENT '密码哈希值，使用安全哈希算法存储',
    `email`         VARCHAR(100)    DEFAULT ''                      COMMENT '电子邮箱，选填',
    `role`          VARCHAR(20)     DEFAULT 'user'                  COMMENT '用户角色: user-普通用户, admin-管理员',
    `status`        TINYINT         DEFAULT 1                       COMMENT '账户状态: 1-正常, 0-禁用',
    `created_at`    DATETIME        DEFAULT CURRENT_TIMESTAMP       COMMENT '账户创建时间',
    `updated_at`    DATETIME        DEFAULT CURRENT_TIMESTAMP
                                    ON UPDATE CURRENT_TIMESTAMP     COMMENT '信息最后更新时间',
    `last_login`    DATETIME        DEFAULT NULL                    COMMENT '最后登录时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表 - 存储注册用户信息';

-- ============================================================
-- 2. 会话表
-- 说明: 存储用户登录后的会话令牌，用于维持登录状态
-- ============================================================
CREATE TABLE IF NOT EXISTS `sessions` (
    `id`            INT             AUTO_INCREMENT  PRIMARY KEY     COMMENT '会话ID，主键，自增',
    `user_id`       INT             NOT NULL                        COMMENT '关联用户ID，外键引用 users.id',
    `token`         VARCHAR(64)     NOT NULL        UNIQUE          COMMENT '会话令牌，唯一，用于身份验证',
    `expires_at`    DATETIME        NOT NULL                        COMMENT '令牌过期时间',
    `created_at`    DATETIME        DEFAULT CURRENT_TIMESTAMP       COMMENT '会话创建时间',
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='会话表 - 存储用户登录会话令牌';

-- ============================================================
-- 3. 定时任务表
-- 说明: 存储系统定时任务的配置信息，如定时获取行情、发送通知等
-- ============================================================
CREATE TABLE IF NOT EXISTS `tasks` (
    `id`            INT             AUTO_INCREMENT  PRIMARY KEY     COMMENT '任务ID，主键，自增',
    `name`          VARCHAR(100)    NOT NULL                        COMMENT '任务名称，用于展示和识别',
    `task_type`     VARCHAR(50)     NOT NULL                        COMMENT '任务类型: fetch_data-获取数据, notify-发送通知, backtest-回测等',
    `config`        JSON                                            COMMENT '任务配置参数，JSON格式存储',
    `schedule_type` VARCHAR(20)     NOT NULL    DEFAULT 'daily'     COMMENT '调度类型: daily-每日, weekly-每周, interval-间隔, cron-表达式',
    `schedule_time` VARCHAR(10)     NOT NULL    DEFAULT '09:00'     COMMENT '调度时间，格式 HH:MM',
    `enabled`       TINYINT         NOT NULL    DEFAULT 1           COMMENT '是否启用: 1-启用, 0-禁用',
    `created_at`    DATETIME        DEFAULT CURRENT_TIMESTAMP       COMMENT '任务创建时间',
    `updated_at`    DATETIME        DEFAULT CURRENT_TIMESTAMP
                                    ON UPDATE CURRENT_TIMESTAMP     COMMENT '任务最后更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='定时任务表 - 存储系统定时任务配置';

-- ============================================================
-- 4. 任务执行日志表
-- 说明: 记录每次定时任务执行的详细日志，用于追踪和排查问题
-- ============================================================
CREATE TABLE IF NOT EXISTS `task_logs` (
    `id`            INT             AUTO_INCREMENT  PRIMARY KEY     COMMENT '日志ID，主键，自增',
    `task_id`       INT             NOT NULL                        COMMENT '关联任务ID，外键引用 tasks.id',
    `status`        VARCHAR(20)     NOT NULL    DEFAULT 'running'   COMMENT '执行状态: running-运行中, success-成功, failed-失败',
    `result`        JSON                                            COMMENT '执行结果数据，JSON格式',
    `error`         TEXT                                            COMMENT '错误信息，执行失败时记录',
    `started_at`    DATETIME        NOT NULL                        COMMENT '任务开始执行时间',
    `finished_at`   DATETIME        DEFAULT NULL                    COMMENT '任务完成时间',
    FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='任务执行日志表 - 记录定时任务执行历史';

-- ============================================================
-- 5. 持仓表
-- 说明: 存储用户当前持有的股票仓位信息
-- ============================================================
CREATE TABLE IF NOT EXISTS `holdings` (
    `id`            VARCHAR(16)                     PRIMARY KEY     COMMENT '持仓记录ID，主键，唯一标识',
    `user_id`       INT             NOT NULL    DEFAULT 1           COMMENT '关联用户ID，外键引用 users.id',
    `symbol`        VARCHAR(10)     NOT NULL                        COMMENT '股票代码，如 600519',
    `name`          VARCHAR(50)     DEFAULT ''                      COMMENT '股票名称，如 贵州茅台',
    `buy_date`      VARCHAR(20)     NOT NULL                        COMMENT '买入日期，格式 YYYY-MM-DD',
    `buy_price`     DECIMAL(10,3)   NOT NULL                        COMMENT '买入价格，保留3位小数',
    `lots`          INT             NOT NULL    DEFAULT 0           COMMENT '持仓数量（股）',
    `created_at`    DATETIME        DEFAULT CURRENT_TIMESTAMP       COMMENT '记录创建时间',
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='持仓表 - 存储用户股票持仓信息';

-- ============================================================
-- 6. 回测记录表
-- 说明: 存储策略回测的结果数据，包含收益、夏普比率等核心指标
-- ============================================================
CREATE TABLE IF NOT EXISTS `backtest_records` (
    `id`            INT             AUTO_INCREMENT  PRIMARY KEY     COMMENT '回测记录ID，主键，自增',
    `user_id`       INT             NOT NULL    DEFAULT 1           COMMENT '关联用户ID，外键引用 users.id',
    `symbol`        VARCHAR(10)     NOT NULL                        COMMENT '回测股票代码',
    `strategy`      VARCHAR(50)     NOT NULL                        COMMENT '回测策略名称',
    `metrics`       JSON                                            COMMENT '回测指标，JSON格式: 包含收益率、夏普比率、最大回撤等',
    `created_at`    DATETIME        DEFAULT CURRENT_TIMESTAMP       COMMENT '回测记录创建时间',
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='回测记录表 - 存储策略回测结果';

-- ============================================================
-- 7. AI对话历史表
-- 说明: 存储用户与AI助手的对话记录，支持多轮对话上下文
-- ============================================================
CREATE TABLE IF NOT EXISTS `ai_chat_history` (
    `id`            INT             AUTO_INCREMENT  PRIMARY KEY     COMMENT '对话记录ID，主键，自增',
    `user_id`       INT             NOT NULL                        COMMENT '关联用户ID，外键引用 users.id',
    `role`          VARCHAR(20)     NOT NULL                        COMMENT '消息角色: user-用户消息, assistant-AI回复, system-系统提示',
    `content`       TEXT            NOT NULL                        COMMENT '消息内容，支持长文本',
    `mode`          VARCHAR(30)     DEFAULT 'chat'                  COMMENT '对话模式: chat-自由对话, strategy-策略生成, backtest-回测解读, recommend-智能推荐',
    `created_at`    DATETIME        DEFAULT CURRENT_TIMESTAMP       COMMENT '消息创建时间',
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI对话历史表 - 存储用户与AI助手的对话记录';

-- ============================================================
-- 8. 通知配置表
-- 说明: 存储策略信号推送通知的配置，支持邮件和钉钉机器人
-- ============================================================
CREATE TABLE IF NOT EXISTS `notify_config` (
    `id`            INT             AUTO_INCREMENT  PRIMARY KEY     COMMENT '配置ID，主键，自增',
    `config_key`    VARCHAR(128)    NOT NULL        UNIQUE          COMMENT '配置键名，唯一: email_smtp_host, email_smtp_port, dingtalk_webhook 等',
    `config_value`  TEXT                                            COMMENT '配置值，文本存储',
    `updated_at`    TIMESTAMP       DEFAULT CURRENT_TIMESTAMP
                                    ON UPDATE CURRENT_TIMESTAMP     COMMENT '配置最后更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='通知配置表 - 存储邮件和钉钉通知的配置参数';

-- ============================================================
-- 9. 模拟账户表
-- 说明: 存储模拟交易账户的基本信息，用于纸上交易练习
-- ============================================================
CREATE TABLE IF NOT EXISTS `paper_accounts` (
    `account_id`        VARCHAR(64)                 PRIMARY KEY     COMMENT '模拟账户ID，主键，唯一标识',
    `account_name`      VARCHAR(128)    DEFAULT '默认账户'          COMMENT '模拟账户名称，便于区分多个账户',
    `cash`              DECIMAL(16,2)   DEFAULT 100000              COMMENT '当前可用资金',
    `initial_capital`   DECIMAL(16,2)   DEFAULT 100000              COMMENT '初始资金，用于计算收益率',
    `created_at`        TIMESTAMP       DEFAULT CURRENT_TIMESTAMP   COMMENT '账户创建时间',
    `updated_at`        TIMESTAMP       DEFAULT CURRENT_TIMESTAMP
                                        ON UPDATE CURRENT_TIMESTAMP COMMENT '账户最后更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='模拟账户表 - 存储模拟交易账户信息';

-- ============================================================
-- 10. 模拟持仓表
-- 说明: 存储模拟账户当前的持仓明细
-- ============================================================
CREATE TABLE IF NOT EXISTS `paper_positions` (
    `id`            INT             AUTO_INCREMENT  PRIMARY KEY     COMMENT '持仓记录ID，主键，自增',
    `account_id`    VARCHAR(64)     NOT NULL                        COMMENT '关联模拟账户ID',
    `symbol`        VARCHAR(16)     NOT NULL                        COMMENT '股票代码',
    `shares`        INT             DEFAULT 0                       COMMENT '持仓数量（股）',
    `avg_cost`      DECIMAL(10,4)   DEFAULT 0                       COMMENT '平均持仓成本',
    `updated_at`    TIMESTAMP       DEFAULT CURRENT_TIMESTAMP
                                    ON UPDATE CURRENT_TIMESTAMP     COMMENT '持仓最后更新时间',
    UNIQUE KEY `uk_account_symbol` (`account_id`, `symbol`)         COMMENT '同一账户同一股票唯一'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='模拟持仓表 - 存储模拟账户的持仓明细';

-- ============================================================
-- 11. 模拟订单表
-- 说明: 存储模拟交易的下单记录，包含订单状态跟踪
-- ============================================================
CREATE TABLE IF NOT EXISTS `paper_orders` (
    `id`                INT             AUTO_INCREMENT  PRIMARY KEY COMMENT '订单记录ID，主键，自增',
    `account_id`        VARCHAR(64)     NOT NULL                    COMMENT '关联模拟账户ID',
    `order_id`          VARCHAR(64)     NOT NULL        UNIQUE      COMMENT '订单编号，唯一标识',
    `symbol`            VARCHAR(16)     NOT NULL                    COMMENT '股票代码',
    `order_type`        VARCHAR(16)     DEFAULT 'market'            COMMENT '订单类型: market-市价单, limit-限价单',
    `direction`         VARCHAR(8)      NOT NULL                    COMMENT '买卖方向: buy-买入, sell-卖出',
    `price`             DECIMAL(10,4)   DEFAULT 0                   COMMENT '委托价格',
    `quantity`          INT             DEFAULT 0                   COMMENT '委托数量（股）',
    `filled_quantity`   INT             DEFAULT 0                   COMMENT '已成交数量（股）',
    `status`            VARCHAR(16)     DEFAULT 'pending'           COMMENT '订单状态: pending-待成交, partial-部分成交, filled-全部成交, cancelled-已撤销',
    `created_at`        TIMESTAMP       DEFAULT CURRENT_TIMESTAMP   COMMENT '订单创建时间',
    INDEX `idx_account` (`account_id`)                              COMMENT '按账户查询索引',
    INDEX `idx_status` (`status`)                                   COMMENT '按状态查询索引'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='模拟订单表 - 存储模拟交易的下单记录';

-- ============================================================
-- 12. 模拟成交表
-- 说明: 存储模拟交易的实际成交记录，包含费用明细
-- ============================================================
CREATE TABLE IF NOT EXISTS `paper_trades` (
    `id`            INT             AUTO_INCREMENT  PRIMARY KEY     COMMENT '成交记录ID，主键，自增',
    `account_id`    VARCHAR(64)     NOT NULL                        COMMENT '关联模拟账户ID',
    `trade_id`      VARCHAR(64)     NOT NULL        UNIQUE          COMMENT '成交编号，唯一标识',
    `symbol`        VARCHAR(16)     NOT NULL                        COMMENT '股票代码',
    `direction`     VARCHAR(8)      NOT NULL                        COMMENT '买卖方向: buy-买入, sell-卖出',
    `price`         DECIMAL(10,4)   DEFAULT 0                       COMMENT '成交价格',
    `quantity`      INT             DEFAULT 0                       COMMENT '成交数量（股）',
    `amount`        DECIMAL(16,2)   DEFAULT 0                       COMMENT '成交金额 = 价格 * 数量',
    `fee_detail`    JSON                                            COMMENT '费用明细，JSON格式: 包含佣金、印花税、过户费等',
    `traded_at`     TIMESTAMP       DEFAULT CURRENT_TIMESTAMP       COMMENT '成交时间',
    INDEX `idx_account` (`account_id`)                              COMMENT '按账户查询索引'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='模拟成交表 - 存储模拟交易的实际成交记录';

-- ============================================================
-- 初始化完成
-- ============================================================
