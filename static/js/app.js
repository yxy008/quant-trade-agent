/**
 * AI 股票分析智能体 - 前端交互逻辑
 */

// ==================== 页面切换 ====================
// 需要登录才能访问的页面
var AUTH_REQUIRED_PAGES = [
    'attribution', 'risk-monitor',
    'backtest', 'rotation', 'paper-trading', 'notify',
    'monte-carlo', 'position', 'portfolio',
    'monitor', 'ai', 'scheduler'
];

var pageCache = {};
var pageInitialized = {};

function switchPage(pageName) {
    if (AUTH_REQUIRED_PAGES.indexOf(pageName) >= 0 && !authToken) {
        showAuthFullscreen();
        return;
    }

    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    var page = document.getElementById('page-' + pageName);
    if (page) {
        page.classList.add('active');
    } else if (pageCache[pageName]) {
        var container = document.getElementById('page-container');
        if (container) {
            container.innerHTML = pageCache[pageName];
            page = document.getElementById('page-' + pageName);
            if (page) page.classList.add('active');
        }
    } else {
        fetch('/api/page/' + pageName)
            .then(function(resp) { return resp.text(); })
            .then(function(html) {
                pageCache[pageName] = html;
                var container = document.getElementById('page-container');
                if (container) {
                    var temp = document.createElement('div');
                    temp.innerHTML = html;
                    container.appendChild(temp.firstElementChild);
                }
                var newPage = document.getElementById('page-' + pageName);
                if (newPage) newPage.classList.add('active');
                initPage(pageName);
            })
            .catch(function(err) {
                console.error('页面加载失败:', pageName, err);
            });
    }

    var nav = document.querySelector('[data-page="' + pageName + '"]');
    if (nav) {
        nav.classList.add('active');
        var group = nav.closest('.nav-group');
        if (group) {
            group.classList.remove('collapsed');
        }
    }

    initPage(pageName);
}

function initPage(pageName) {
    if (pageInitialized[pageName]) return;
    pageInitialized[pageName] = true;

    if (pageName === 'dashboard') loadDashboard();
    if (pageName === 'pool') { initPoolSectors(); }
    if (pageName === 'news') loadNews();
    if (pageName === 'portfolio') loadPortfolio();
    if (pageName === 'funds') loadFundsData();
    if (pageName === 'breadth') loadBreadth();
    if (pageName === 'backtest') loadStrategyList();
    if (pageName === 'analysis') { /* 股票分析页由用户输入触发 */ }
    if (pageName === 'compare') { /* 股票对比页由用户输入触发 */ }
    if (pageName === 'kline') loadKlineChart();
    if (pageName === 'risk') { /* 风险评估页由用户输入触发 */ }
    if (pageName === 'monte-carlo') { /* 蒙特卡洛页由用户输入触发 */ }
    if (pageName === 'position') { /* 仓位管理页由用户输入触发 */ }
    if (pageName === 'monitor') { /* 实时监控页由用户输入触发 */ }
    if (pageName === 'attribution') { /* 绩效归因页由用户输入触发 */ }
    if (pageName === 'multi-factor') { /* 多因子选股页由用户输入触发 */ }
    if (pageName === 'ai') loadAiConfig();
    if (pageName === 'scheduler') loadSchedulerTasks();
    if (pageName === 'rotation') { /* 行业轮动页由用户输入触发 */ }
    if (pageName === 'sentiment') { /* 市场情绪页由用户输入触发 */ }
    if (pageName === 'risk-monitor') { /* 风控监控页由用户输入触发 */ }
    if (pageName === 'paper-trading') { initPaperTrading(); }
    if (pageName === 'notify') { loadNotifyConfig(); }
    if (pageName === 'settings') { loadSettings(); }
}

function toggleNavGroup(titleEl) {
    var group = titleEl.parentElement;
    group.classList.toggle('collapsed');
}

// ==================== API 请求封装 ====================
async function apiGet(url) {
    try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error('请求失败: ' + resp.status);
        return await resp.json();
    } catch (e) {
        return { error: e.message };
    }
}

async function apiPost(url, body) {
    try {
        const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!resp.ok) throw new Error('请求失败: ' + resp.status);
        return await resp.json();
    } catch (e) {
        return { error: e.message };
    }
}

async function apiDelete(url) {
    try {
        const resp = await fetch(url, { method: 'DELETE' });
        if (!resp.ok) throw new Error('请求失败: ' + resp.status);
        return await resp.json();
    } catch (e) {
        return { error: e.message };
    }
}

// ==================== 格式化工具 ====================
function formatMoney(val) {
    if (val === undefined || val === null) return '--';
    const n = Number(val);
    if (isNaN(n)) return '--';
    if (Math.abs(n) >= 100000000) return (n / 100000000).toFixed(2) + '亿';
    if (Math.abs(n) >= 10000) return (n / 10000).toFixed(2) + '万';
    return n.toFixed(2);
}

function fmtChange(val) {
    if (val === undefined || val === null) return '--';
    const n = Number(val);
    if (isNaN(n)) return '--';
    const cls = n >= 0 ? 'up' : 'down';
    const sign = n >= 0 ? '+' : '';
    return { text: sign + n.toFixed(2) + '%', cls: cls };
}

function fmtPrice(val) {
    if (val === undefined || val === null) return '--';
    const n = Number(val);
    if (isNaN(n)) return '--';
    return n.toFixed(2);
}

function fmtMoney(val) {
    if (val === undefined || val === null) return '--';
    const n = Number(val);
    if (isNaN(n)) return '--';
    if (Math.abs(n) >= 1e8) return (n / 1e8).toFixed(2) + '亿';
    if (Math.abs(n) >= 1e4) return (n / 1e4).toFixed(2) + '万';
    return n.toFixed(2);
}

// ==================== 仪表盘 ====================
async function loadDashboard() {
    loadMarketTrend();
    loadSectorsOverview();
    loadHotStocks();
}

async function loadMarketTrend() {
    const container = document.getElementById('trendContent');
    const badge = document.getElementById('trendBadge');
    const statusEl = document.getElementById('marketStatus');

    const data = await apiGet('/api/market/trend');

    if (data.error) {
        container.innerHTML = '<div class="error-box">' + data.error + '</div>';
        return;
    }

    const trend = data['整体趋势'] || '未知';
    const riskLevel = data['建议风险等级'] || 'medium';
    const suggestion = data['仓位建议'] || '';

    let trendCls = 'shock';
    if (trend === '牛市') trendCls = 'bull';
    else if (trend === '熊市') trendCls = 'bear';

    badge.textContent = trend;
    badge.className = 'card-badge ' + trendCls;

    const sh = data['上证指数'] || {};
    const sz = data['深证成指'] || {};

    container.innerHTML = `
        <div class="trend-info">
            <div class="trend-main">
                <div class="trend-label">整体趋势</div>
                <div class="trend-value ${trendCls}">${trend}</div>
                <div class="trend-suggestion">${suggestion}</div>
            </div>
            <div class="trend-detail">
                <div class="trend-row">
                    <span class="label">上证指数趋势</span>
                    <span class="value">${sh['趋势'] || '--'}</span>
                </div>
                <div class="trend-row">
                    <span class="label">深证成指趋势</span>
                    <span class="value">${sz['趋势'] || '--'}</span>
                </div>
                <div class="trend-row">
                    <span class="label">建议风险等级</span>
                    <span class="value">${riskLevel === 'high' ? '高' : riskLevel === 'low' ? '低' : '中'}</span>
                </div>
            </div>
        </div>
    `;

    // 更新侧边栏状态
    statusEl.innerHTML = `
        <span class="status-dot" style="background: ${trendCls === 'bull' ? 'var(--red)' : trendCls === 'bear' ? 'var(--green)' : 'var(--yellow)'}"></span>
        <span class="status-text">市场: ${trend}</span>
    `;

    // 更新指数卡片
    updateIndexCard('shIndexContent', sh);
    updateIndexCard('szIndexContent', sz);
}

function updateIndexCard(elId, data) {
    const el = document.getElementById(elId);
    if (!el) return;

    const price = data['最新点位'] || 0;
    const change20 = data['20日涨跌幅'] || 0;
    const ma20 = data['20日均线'] || 0;
    const ma60 = data['60日均线'] || 0;
    const trend = data['趋势'] || '--';

    const ch = fmtChange(change20);

    el.innerHTML = `
        <div class="index-price">${fmtPrice(price)}</div>
        <div class="index-change ${ch.cls}">${ch.text} (20日)</div>
        <div class="index-detail">
            <div class="index-row">
                <span class="label">20日均线</span>
                <span class="value">${fmtPrice(ma20)}</span>
            </div>
            <div class="index-row">
                <span class="label">60日均线</span>
                <span class="value">${fmtPrice(ma60)}</span>
            </div>
            <div class="index-row">
                <span class="label">趋势判断</span>
                <span class="value">${trend}</span>
            </div>
        </div>
    `;
}

async function loadSectorsOverview() {
    const container = document.getElementById('sectorsOverview');
    const data = await apiGet('/api/sectors');

    if (data.error) {
        container.innerHTML = '<div class="error-box">' + data.error + '</div>';
        return;
    }

    const sectors = (data['板块列表'] || []).slice(0, 5);
    let html = '<div class="sector-list">';
    sectors.forEach(s => {
        const ch = fmtChange(s['平均涨跌幅']);
        html += `
            <div class="sector-item" onclick="switchPage('pool')">
                <span class="sector-name">${s['名称']}</span>
                <span class="sector-change ${ch.cls}">${ch.text}</span>
            </div>
        `;
    });
    html += '</div>';
    container.innerHTML = html;
}

async function loadHotStocks() {
    const container = document.getElementById('hotStocks');
    const data = await apiGet('/api/pool?count=2');

    if (data.error) {
        container.innerHTML = '<div class="error-box">' + data.error + '</div>';
        return;
    }

    const stocks = (data['股票列表'] || []).slice(0, 5);
    let html = '<div class="hot-list">';
    stocks.forEach(s => {
        const ch = fmtChange(s['涨跌幅']);
        html += `
            <div class="hot-item" onclick="quickAnalyze('${s['代码']}')">
                <span class="hot-name">${s['名称']} <span style="color:var(--text-muted);font-size:12px;">${s['代码']}</span></span>
                <div class="hot-info">
                    <span class="hot-price">${fmtPrice(s['最新价'])}</span>
                    <span class="hot-change ${ch.cls}">${ch.text}</span>
                </div>
            </div>
        `;
    });
    html += '</div>';
    container.innerHTML = html;
}

// ==================== 股票分析 ====================
function quickAnalyze(symbol) {
    document.getElementById('stockSearch').value = symbol;
    switchPage('analysis');
    analyzeStock();
}

// ==================== 智能推荐助手（对话式） ====================

var recommendAssistContext = null;  // 保存当前推荐上下文，支持多轮对话

function handleRecommendAssistInputKey(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendRecommendAssistMessage();
    }
}

function sendRecommendAssistSuggestion(text) {
    document.getElementById('aiRecommendAssistInput').value = text;
    sendRecommendAssistMessage();
}

async function sendRecommendAssistMessage() {
    var inputEl = document.getElementById('aiRecommendAssistInput');
    var text = inputEl.value.trim();
    if (!text) return;

    inputEl.value = '';
    inputEl.style.height = 'auto';

    var messagesEl = document.getElementById('aiRecommendAssistMessages');

    // 隐藏欢迎界面
    var welcomeEl = messagesEl.querySelector('.ai-welcome');
    if (welcomeEl) welcomeEl.style.display = 'none';

    // 添加用户消息
    appendAssistMsg(messagesEl, 'user', text);

    // 添加助手"思考中"消息
    var thinkingMsg = appendAssistMsg(messagesEl, 'assistant', '<span class="msg-thinking">正在分析你的需求...</span>');

    try {
        var resp = await fetch('/api/ai/recommend/assist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: text,
                context: recommendAssistContext
            })
        });
        var data = await resp.json();

        // 移除思考中消息
        thinkingMsg.remove();

        if (data.error) {
            appendAssistMsg(messagesEl, 'assistant', '抱歉，处理请求时出错：' + data.error);
            return;
        }

        // 保存上下文
        recommendAssistContext = data.context || null;

        // 显示解析结果
        var replyHtml = '';
        if (data.parsed_params) {
            replyHtml += '<div class="msg-parsed-params">已识别参数：';
            var params = data.parsed_params;
            if (params.market) replyHtml += '<span>市场：' + params.market + '</span>';
            if (params.price_range) replyHtml += '<span>价格：' + params.price_range + '</span>';
            if (params.top_n) replyHtml += '<span>数量：' + params.top_n + '只</span>';
            if (params.risk_level) replyHtml += '<span>风险：' + params.risk_level + '</span>';
            if (params.preference) replyHtml += '<span>偏好：' + params.preference + '</span>';
            if (params.extra_dimensions && params.extra_dimensions.length > 0) {
                replyHtml += '<span>额外维度：' + params.extra_dimensions.join('、') + '</span>';
            }
            replyHtml += '</div>';
        }

        // 显示助手回复
        if (data.reply) {
            replyHtml += '<div>' + data.reply.replace(/\n/g, '<br>') + '</div>';
        }

        // 显示分析结果（个股分析模式）
        if (data.analysis_result && data.analysis_result.summary) {
            replyHtml += renderAssistAnalysisResult(data.analysis_result);
        }

        // 显示推荐结果表格（推荐模式）
        if (data.recommend_result && data.recommend_result.length > 0) {
            replyHtml += renderAssistRecommendTable(data.recommend_result);
        }

        appendAssistMsg(messagesEl, 'assistant', replyHtml);

    } catch (e) {
        thinkingMsg.remove();
        appendAssistMsg(messagesEl, 'assistant', '抱歉，网络请求失败，请稍后重试。');
    }

    // 滚动到底部
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

function appendAssistMsg(container, role, html) {
    var div = document.createElement('div');
    div.className = 'assist-msg ' + role;
    var avatarText = role === 'user' ? '我' : 'AI';
    div.innerHTML = '<div class="msg-avatar">' + avatarText + '</div><div class="msg-bubble">' + html + '</div>';
    container.appendChild(div);
    return div;
}

function renderAssistAnalysisResult(analysis) {
    var html = '<div class="msg-analysis-result">';
    if (analysis.summary) {
        html += '<div class="analysis-summary">' + analysis.summary.replace(/\n/g, '<br>') + '</div>';
    }
    html += '</div>';
    return html;
}

function renderAssistRecommendTable(stocks) {
    var rankColors = ['#e74c3c', '#e67e22', '#f39c12', '#3498db', '#2ecc71', '#9b59b6', '#1abc9c', '#34495e', '#e91e63', '#00bcd4'];
    var html = '<div class="msg-recommend-result"><table class="data-table recommend-table"><thead><tr><th>#</th><th>股票</th><th>最新价</th><th>涨跌幅</th><th>换手率</th><th>市盈率</th><th>市净率</th><th>评分</th><th>评级</th><th>推荐理由</th></tr></thead><tbody>';

    for (var i = 0; i < stocks.length; i++) {
        var s = stocks[i];
        var bgColor = rankColors[i] || '#95a5a6';
        var chgPct = s['涨跌幅'] || 0;
        var chgColor = chgPct > 0 ? 'var(--red)' : chgPct < 0 ? 'var(--green)' : 'var(--text-secondary)';
        var chgSign = chgPct > 0 ? '+' : '';
        var score = s['综合评分'] || 0;
        var scoreColor = score >= 70 ? '#27ae60' : score >= 55 ? '#2ecc71' : score >= 40 ? '#f39c12' : '#e74c3c';
        var turnover = s['换手率'];
        var pe = s['市盈率'];
        var pb = s['市净率'];

        html += '<tr>';
        html += '<td><span class="rank-badge" style="background:' + bgColor + ';">' + (i + 1) + '</span></td>';
        html += '<td><a href="javascript:void(0)" onclick="quickAnalyze(\'' + s['代码'] + '\')" class="stock-link">' + (s['名称'] || s['代码']) + '</a><span class="stock-code-sub">' + s['代码'] + '</span></td>';
        html += '<td class="num-cell">' + (s['最新价'] ? s['最新价'].toFixed(2) : '--') + '</td>';
        html += '<td class="num-cell" style="color:' + chgColor + ';font-weight:600;">' + chgSign + (chgPct ? chgPct.toFixed(2) : '0.00') + '%</td>';
        html += '<td class="num-cell">' + (turnover != null ? turnover.toFixed(2) + '%' : '--') + '</td>';
        html += '<td class="num-cell">' + (pe != null && pe > 0 ? pe.toFixed(1) : '--') + '</td>';
        html += '<td class="num-cell">' + (pb != null && pb > 0 ? pb.toFixed(2) : '--') + '</td>';
        html += '<td><span class="score-badge" style="background:' + scoreColor + ';">' + score + '</span></td>';
        html += '<td><span class="rating-tag">' + (s['评级'] || '--') + '</span></td>';
        html += '<td class="reason-cell">' + (s['推荐理由'] || '暂无详细分析') + '</td>';
        html += '</tr>';
    }
    html += '</tbody></table></div>';
    return html;
}

async function analyzeStock() {
    const symbol = document.getElementById('stockSearch').value.trim();
    if (!symbol || symbol.length !== 6) {
        alert('请输入6位股票代码');
        return;
    }

    const container = document.getElementById('analysisResult');
    container.innerHTML = '<div class="loading-spinner"></div>';

    const data = await apiGet('/api/stock/' + symbol + '/analysis');

    if (data.error) {
        container.innerHTML = '<div class="error-box">分析失败: ' + data.error + '</div>';
        return;
    }

    const scoring = data['评分'] || {};
    const financial = data['财务'] || {};
    const details = scoring['评分详情'] || {};
    const tech = details['技术面'] || {};
    const fund = details['基本面'] || {};
    const risk = details['风险'] || {};
    const sector = details['板块'] || {};

    const total = scoring['总分'] || 0;
    const suggestion = scoring['建议'] || '--';

    let scoreCls = 'low';
    let sugCls = 'avoid';
    if (total >= 80) { scoreCls = 'high'; sugCls = 'buy'; }
    else if (total >= 60) { scoreCls = 'medium'; sugCls = 'watch'; }

    let html = '<div class="score-overview">';
    html += '<div class="score-circle-wrap">';
    html += '<div class="score-number ' + scoreCls + '">' + total + '</div>';
    html += '<div class="score-suggestion ' + sugCls + '">' + suggestion + '</div>';
    html += '</div>';

    html += '<div class="score-details">';
    html += scoreItemHtml('技术面', tech['得分'] || 0, 40, tech['详情'] || []);
    html += scoreItemHtml('基本面', fund['得分'] || 0, 30, fund['详情'] || []);
    html += scoreItemHtml('风险', risk['得分'] || 0, 20, risk['详情'] || []);
    html += scoreItemHtml('板块', sector['得分'] || 0, 10, sector['详情'] || []);
    html += '</div></div>';

    // 财务数据
    html += '<div class="financial-section"><h3>实时行情数据</h3>';
    html += '<div class="financial-grid">';
    html += finItemHtml('最新价', fmtPrice(financial['最新价']));
    html += finItemHtml('涨跌幅', fmtChange(financial['涨跌幅']).text, fmtChange(financial['涨跌幅']).cls === 'up' ? 'var(--red)' : 'var(--green)');
    html += finItemHtml('波动率', (financial['波动率'] || 0).toFixed(2) + '%');
    html += finItemHtml('成交量', fmtMoney(financial['成交量']));
    html += finItemHtml('成交额', fmtMoney(financial['成交额']));
    html += finItemHtml('数据质量', financial['数据质量'] || '--');
    html += '</div></div>';

    container.innerHTML = html;
}

function scoreItemHtml(name, score, max, details) {
    let html = '<div class="score-item">';
    html += '<div class="score-item-header">';
    html += '<span class="score-item-name">' + name + ' (' + score + '/' + max + ')</span>';
    html += '<span class="score-item-value">' + score + '</span>';
    html += '</div>';
    html += '<div class="score-item-detail">';
    details.forEach(d => { html += '<div>' + d + '</div>'; });
    html += '</div></div>';
    return html;
}

function finItemHtml(label, value, color) {
    const style = color ? ' style="color:' + color + '"' : '';
    return '<div class="financial-item"><div class="financial-label">' + label + '</div><div class="financial-value"' + style + '>' + value + '</div></div>';
}

// ==================== 股票池（多选板块版） ====================

var selectedSectors = [];
var allSectorNames = [];

function initPoolSectors() {
    fetch('/api/pool/sectors')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            var sectors = data['板块列表'] || [];
            allSectorNames = sectors.map(function(s) { return s['名称']; });
            selectedSectors = allSectorNames.slice();

            var optionsHtml = '';
            sectors.forEach(function(s) {
                optionsHtml += '<div class="multi-select-option" onclick="toggleSectorOption(\'' + s['名称'] + '\', event)">';
                optionsHtml += '<input type="checkbox" checked onclick="event.stopPropagation(); toggleSectorCheckbox(\'' + s['名称'] + '\', this)">';
                optionsHtml += '<label>' + s['名称'] + '</label>';
                optionsHtml += '<span class="option-count">' + s['股票数量'] + '</span>';
                optionsHtml += '</div>';
            });
            document.getElementById('poolSectorOptions').innerHTML = optionsHtml;
            updateSectorDisplay();
            loadPool();
        })
        .catch(function() {
            document.getElementById('poolSectorOptions').innerHTML = '<div class="loading-text">加载失败</div>';
        });
}

function toggleSectorDropdown() {
    var wrapper = document.getElementById('poolSectorSelect');
    var dropdown = document.getElementById('poolSectorDropdown');
    var isOpen = dropdown.style.display !== 'none';

    if (isOpen) {
        dropdown.style.display = 'none';
        wrapper.classList.remove('open');
    } else {
        dropdown.style.display = 'flex';
        wrapper.classList.add('open');
    }
}

function toggleSectorOption(sectorName, event) {
    var checkbox = event.currentTarget.querySelector('input[type="checkbox"]');
    checkbox.checked = !checkbox.checked;
    toggleSectorCheckbox(sectorName, checkbox);
}

function toggleSectorCheckbox(sectorName, checkbox) {
    if (checkbox.checked) {
        if (selectedSectors.indexOf(sectorName) < 0) {
            selectedSectors.push(sectorName);
        }
    } else {
        var idx = selectedSectors.indexOf(sectorName);
        if (idx >= 0) {
            selectedSectors.splice(idx, 1);
        }
    }
    updateSectorDisplay();
    loadPool();
}

function selectAllSectors() {
    selectedSectors = allSectorNames.slice();
    var checkboxes = document.querySelectorAll('#poolSectorOptions input[type="checkbox"]');
    checkboxes.forEach(function(cb) { cb.checked = true; });
    updateSectorDisplay();
    loadPool();
}

function deselectAllSectors() {
    selectedSectors = [];
    var checkboxes = document.querySelectorAll('#poolSectorOptions input[type="checkbox"]');
    checkboxes.forEach(function(cb) { cb.checked = false; });
    updateSectorDisplay();
    loadPool();
}

function updateSectorDisplay() {
    var textEl = document.getElementById('poolSectorText');
    if (selectedSectors.length === 0) {
        textEl.textContent = '未选择板块';
    } else if (selectedSectors.length === allSectorNames.length) {
        textEl.textContent = '全部板块 (' + allSectorNames.length + ')';
    } else {
        textEl.textContent = '已选 ' + selectedSectors.length + ' 个板块';
    }
}

async function loadPool() {
    var container = document.getElementById('poolResult');
    container.innerHTML = '<div class="loading-spinner"></div>';

    var url = '/api/pool?count=10';
    if (selectedSectors.length > 0 && selectedSectors.length < allSectorNames.length) {
        url += '&sectors=' + encodeURIComponent(selectedSectors.join(','));
    }

    var data = await apiGet(url);

    if (data.error) {
        container.innerHTML = '<div class="error-box">' + data.error + '</div>';
        return;
    }

    var stocks = data['股票列表'] || [];
    if (stocks.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>暂无数据，请选择板块后刷新</p></div>';
        return;
    }

    var grouped = {};
    stocks.forEach(function(s) {
        var sector = s['板块'] || '其他';
        if (!grouped[sector]) grouped[sector] = [];
        grouped[sector].push(s);
    });

    var html = '';
    for (var sector in grouped) {
        var list = grouped[sector];
        html += '<div class="pool-sector">';
        html += '<div class="pool-sector-header">';
        html += '<span class="pool-sector-name">' + sector + '</span>';
        html += '<span class="pool-sector-count">' + list.length + ' 只股票</span>';
        html += '</div>';
        html += '<table class="pool-table"><thead><tr>';
        html += '<th>代码</th><th>名称</th><th>最新价</th><th>涨跌幅</th><th>标签</th>';
        html += '</tr></thead><tbody>';

        list.forEach(function(s) {
            var ch = fmtChange(s['涨跌幅']);
            var tags = (s['标签'] || []).map(function(t) { return '<span class="pool-tag">' + t + '</span>'; }).join('');
            html += '<tr onclick="quickAnalyze(\'' + s['代码'] + '\')" style="cursor:pointer">';
            html += '<td><span class="pool-code">' + s['代码'] + '</span></td>';
            html += '<td>' + s['名称'] + '</td>';
            html += '<td>' + fmtPrice(s['最新价']) + '</td>';
            html += '<td style="color:' + (ch.cls === 'up' ? 'var(--red)' : 'var(--green)') + '">' + ch.text + '</td>';
            html += '<td><div class="pool-tags">' + tags + '</div></td>';
            html += '</tr>';
        });

        html += '</tbody></table></div>';
    }

    container.innerHTML = html;
}

// 点击页面其他地方关闭下拉框
document.addEventListener('click', function(e) {
    var wrapper = document.getElementById('poolSectorSelect');
    if (wrapper && !wrapper.contains(e.target)) {
        var dropdown = document.getElementById('poolSectorDropdown');
        if (dropdown && dropdown.style.display !== 'none') {
            dropdown.style.display = 'none';
            wrapper.classList.remove('open');
        }
    }
});

// ==================== 仓位管理 ====================
async function calculatePosition() {
    const symbols = document.getElementById('posSymbols').value.trim();
    const capital = parseFloat(document.getElementById('posCapital').value) || 100000;
    const risk = document.getElementById('posRisk').value;

    if (!symbols) {
        alert('请输入股票代码');
        return;
    }

    const container = document.getElementById('positionResult');
    container.innerHTML = '<div class="loading-spinner"></div>';

    const data = await apiPost('/api/position/batch', {
        symbols: symbols,
        capital: capital,
        risk: risk
    });

    if (data.error) {
        container.innerHTML = '<div class="error-box">' + data.error + '</div>';
        return;
    }

    const positions = data['仓位列表'] || [];

    let html = '<div class="position-summary">';
    html += '<div class="summary-item"><div class="summary-label">总资金</div><div class="summary-value">' + fmtMoney(data['总资金'] || capital) + '</div></div>';
    html += '<div class="summary-item"><div class="summary-label">已使用</div><div class="summary-value">' + fmtMoney(data['已使用'] || 0) + '</div></div>';
    html += '<div class="summary-item"><div class="summary-label">现金剩余</div><div class="summary-value">' + fmtMoney(data['现金剩余'] || 0) + '</div></div>';
    html += '<div class="summary-item"><div class="summary-label">股票数量</div><div class="summary-value">' + (data['股票数量'] || 0) + '</div></div>';
    html += '</div>';

    if (positions.length > 0) {
        html += '<div class="position-table-wrap"><table class="position-table"><thead><tr>';
        html += '<th>代码</th><th>名称</th><th>最新价</th><th>涨跌幅</th><th>评分</th><th>建议资金</th><th>股数</th><th>仓位</th>';
        html += '</tr></thead><tbody>';

        positions.forEach(p => {
            const ch = fmtChange(p['涨跌幅']);
            html += '<tr>';
            html += '<td><span class="pool-code">' + p['代码'] + '</span></td>';
            html += '<td>' + p['名称'] + '</td>';
            html += '<td>' + fmtPrice(p['最新价']) + '</td>';
            html += '<td style="color:' + (ch.cls === 'up' ? 'var(--red)' : 'var(--green)') + '">' + ch.text + '</td>';
            html += '<td><strong>' + (p['评分'] || '--') + '</strong></td>';
            html += '<td style="color:var(--accent);font-weight:600;">' + fmtMoney(p['资金']) + '</td>';
            html += '<td>' + (p['股数'] || 0) + '</td>';
            html += '<td><strong>' + (p['仓位'] || '--') + '</strong></td>';
            html += '</tr>';
        });

        html += '</tbody></table></div>';
    } else {
        html += '<div class="empty-state"><p>' + (data['建议'] || '无符合条件的股票') + '</p></div>';
    }

    container.innerHTML = html;
}

// ==================== 新闻 ====================
async function loadNews() {
    const container = document.getElementById('newsResult');
    container.innerHTML = '<div class="loading-spinner"></div>';

    const data = await apiGet('/api/market/news');

    if (data.error) {
        container.innerHTML = '<div class="error-box">' + data.error + '</div>';
        return;
    }

    const news = data['市场新闻'] || [];
    if (news.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>暂无新闻数据</p></div>';
        return;
    }

    let html = '';
    news.forEach((n, idx) => {
        const content = n['内容'] || '';
        const hasContent = content.length > 0;
        html += '<div class="news-card" onclick="toggleNews(' + idx + ')" id="news-card-' + idx + '">';
        html += '<div class="news-title">' + (n['标题'] || '无标题') + (hasContent ? ' <span class="news-expand-icon">+</span>' : '') + '</div>';
        html += '<div class="news-content" id="news-content-' + idx + '">' + content + '</div>';
        html += '<div class="news-meta">';
        if (n['时间']) html += '<span>' + n['时间'] + '</span>';
        if (n['来源']) html += '<span>' + n['来源'] + '</span>';
        html += '</div></div>';
    });

    container.innerHTML = html;
}

function toggleNews(idx) {
    const content = document.getElementById('news-content-' + idx);
    const card = document.getElementById('news-card-' + idx);
    const icon = card.querySelector('.news-expand-icon');
    if (!content) return;

    if (content.classList.contains('expanded')) {
        content.classList.remove('expanded');
        if (icon) icon.textContent = '+';
    } else {
        content.classList.add('expanded');
        if (icon) icon.textContent = '-';
    }
}

// ==================== 持仓管理 ====================
async function loadPortfolio() {
    const container = document.getElementById('portfolioList');
    container.innerHTML = '<div class="loading-spinner"></div>';

    const data = await apiGet('/api/portfolio');

    if (data.error) {
        container.innerHTML = '<div class="error-box">' + data.error + '</div>';
        return;
    }

    const holdings = data['持仓列表'] || [];
    if (holdings.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>暂无持仓，请先添加</p></div>';
        return;
    }

    // 汇总卡片
    let summaryHtml = '<div class="portfolio-summary">';
    summaryHtml += '<div class="portfolio-summary-item"><div class="portfolio-summary-label">持仓数量</div><div class="portfolio-summary-value">' + (data['持仓数量'] || 0) + ' 只</div></div>';
    summaryHtml += '<div class="portfolio-summary-item"><div class="portfolio-summary-label">总成本</div><div class="portfolio-summary-value">' + formatMoney(data['总成本']) + '</div></div>';
    summaryHtml += '<div class="portfolio-summary-item"><div class="portfolio-summary-label">总市值</div><div class="portfolio-summary-value">' + formatMoney(data['总市值']) + '</div></div>';
    const totalPct = data['总盈亏比例'] || 0;
    summaryHtml += '<div class="portfolio-summary-item"><div class="portfolio-summary-label">总盈亏</div><div class="portfolio-summary-value ' + (totalPct >= 0 ? 'up' : 'down') + '">' + formatMoney(data['总盈亏']) + ' (' + (totalPct >= 0 ? '+' : '') + totalPct.toFixed(2) + '%)</div></div>';
    summaryHtml += '</div>';

    // 表格
    let tableHtml = '<table class="portfolio-table"><thead><tr>';
    tableHtml += '<th>代码</th><th>名称</th><th>购买日期</th><th>成本价</th><th>手数</th><th>现价</th><th>市值</th><th>盈亏</th><th>盈亏%</th><th>操作</th>';
    tableHtml += '</tr></thead><tbody>';

    holdings.forEach(h => {
        const pct = h.profit_pct || 0;
        const cls = pct >= 0 ? 'portfolio-profit-up' : 'portfolio-profit-down';
        tableHtml += '<tr>';
        tableHtml += '<td>' + h.symbol + '</td>';
        tableHtml += '<td>' + h.name + '</td>';
        tableHtml += '<td>' + h.buy_date + '</td>';
        tableHtml += '<td>' + (h.buy_price || 0).toFixed(2) + '</td>';
        tableHtml += '<td>' + h.lots + '</td>';
        tableHtml += '<td>' + (h.current_price ? h.current_price.toFixed(2) : '--') + '</td>';
        tableHtml += '<td>' + formatMoney(h.current_value) + '</td>';
        tableHtml += '<td class="' + cls + '">' + formatMoney(h.profit) + '</td>';
        tableHtml += '<td class="' + cls + '">' + (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%</td>';
        tableHtml += '<td><button class="portfolio-delete-btn" onclick="deletePortfolio(\'' + h.id + '\')">删除</button></td>';
        tableHtml += '</tr>';
    });

    tableHtml += '</tbody></table>';
    container.innerHTML = summaryHtml + tableHtml;
}

async function addPortfolio() {
    const symbol = document.getElementById('pfSymbol').value.trim();
    const buyDate = document.getElementById('pfDate').value;
    const buyPrice = document.getElementById('pfPrice').value;
    const lots = document.getElementById('pfLots').value;

    if (!symbol || symbol.length !== 6) {
        alert('请输入正确的6位股票代码');
        return;
    }
    if (!buyDate) {
        alert('请选择购买日期');
        return;
    }
    if (!buyPrice || parseFloat(buyPrice) <= 0) {
        alert('请输入有效的购买单价');
        return;
    }
    if (!lots || parseInt(lots) <= 0) {
        alert('请输入有效的购买手数');
        return;
    }

    const data = await apiPost('/api/portfolio/add', {
        symbol: symbol,
        buy_date: buyDate,
        buy_price: parseFloat(buyPrice),
        lots: parseInt(lots)
    });

    if (data.error) {
        alert(data.error);
        return;
    }

    // 清空表单
    document.getElementById('pfSymbol').value = '';
    document.getElementById('pfDate').value = '';
    document.getElementById('pfPrice').value = '';
    document.getElementById('pfLots').value = '';

    loadPortfolio();
}

async function deletePortfolio(id) {
    if (!confirm('确定要删除该持仓吗？')) return;

    const data = await apiDelete('/api/portfolio/' + id);
    if (data.error) {
        alert(data.error);
        return;
    }
    loadPortfolio();
}

async function analyzePortfolio() {
    const container = document.getElementById('portfolioAnalysis');
    container.innerHTML = '<div class="loading-spinner"></div>';

    const data = await apiGet('/api/portfolio/analysis');

    if (data.error) {
        container.innerHTML = '<div class="error-box">' + data.error + '</div>';
        return;
    }

    const results = data['分析结果'] || [];
    if (results.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>' + (data['提示'] || '暂无持仓数据') + '</p></div>';
        return;
    }

    let html = '<h3 style="margin-bottom:16px;">持仓分析建议</h3>';
    results.forEach(r => {
        const score = r.score || 0;
        let scoreCls = 'low';
        if (score >= 80) scoreCls = 'high';
        else if (score >= 60) scoreCls = 'medium';

        let holdCls = 'sell';
        if (r.hold_suggestion && r.hold_suggestion.includes('强烈')) holdCls = 'hold';
        else if (r.hold_suggestion && (r.hold_suggestion.includes('继续') || r.hold_suggestion.includes('观望'))) holdCls = 'caution';

        let sellCls = 'hold';
        if (r.sell_suggestion && r.sell_suggestion.includes('卖出')) sellCls = 'sell';
        else if (r.sell_suggestion && r.sell_suggestion.includes('减仓')) sellCls = 'caution';

        html += '<div class="portfolio-analysis-card">';
        html += '<div class="portfolio-analysis-header">';
        html += '<div><span class="portfolio-analysis-name">' + r.symbol + ' ' + r.name + '</span><span style="color:var(--text-muted);font-size:13px;margin-left:8px;">成本 ' + (r.buy_price || 0).toFixed(2) + ' | ' + r.lots + '手</span></div>';
        html += '<div class="portfolio-analysis-score ' + scoreCls + '">' + score + '分</div>';
        html += '</div>';

        html += '<div class="portfolio-analysis-grid">';
        html += '<div class="portfolio-analysis-item"><div class="label">当前价格</div><div class="value">' + (r.current_price ? r.current_price.toFixed(2) : '--') + '</div></div>';
        html += '<div class="portfolio-analysis-item"><div class="label">盈亏比例</div><div class="value ' + ((r.profit_pct || 0) >= 0 ? 'hold' : 'sell') + '">' + ((r.profit_pct || 0) >= 0 ? '+' : '') + (r.profit_pct || 0).toFixed(2) + '%</div></div>';
        html += '<div class="portfolio-analysis-item"><div class="label">是否值得持有</div><div class="value ' + holdCls + '">' + (r.hold_suggestion || '--') + '</div></div>';
        html += '<div class="portfolio-analysis-item"><div class="label">卖出建议</div><div class="value ' + sellCls + '">' + (r.sell_suggestion || '--') + '</div></div>';
        html += '</div>';

        html += '<div style="margin-top:12px;padding:12px 16px;background:var(--bg-secondary);border-radius:var(--radius-sm);font-size:13px;color:var(--text-secondary);">';
        html += '<strong>评分建议：</strong>' + (r.score_suggestion || '--') + '<br>';
        html += '<strong>持有理由：</strong>' + (r.hold_reason || '--');
        html += '</div>';

        html += '</div>';
    });

    container.innerHTML = html;
}

// ==================== 资金流向 ====================
let currentFundsTab = 'northbound';

function switchFundsTab(tab) {
    currentFundsTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => {
        if (b.textContent.includes(tab === 'northbound' ? '北向' : tab === 'industry' ? '行业' : '总览')) {
            b.classList.add('active');
        }
    });
    var datePicker = document.getElementById('fundsDatePicker');
    if (datePicker) {
        datePicker.style.display = tab === 'overview' ? 'block' : 'none';
    }
    loadFundsData();
}

function initDatePickers() {
    var today = new Date().toISOString().split('T')[0];
    var fundsDate = document.getElementById('fundsOverviewDate');
    var breadthDate = document.getElementById('breadthDate');
    if (fundsDate) fundsDate.setAttribute('max', today);
    if (breadthDate) breadthDate.setAttribute('max', today);
}

function onFundsDateChange() {
    var dateVal = document.getElementById('fundsOverviewDate').value;
    var statusEl = document.getElementById('fundsDateStatus');
    if (dateVal) {
        var d = new Date(dateVal);
        var day = d.getDay();
        if (day === 0 || day === 6) {
            statusEl.innerHTML = '<span style="color:#f59e0b;">' + (day === 0 ? '周日' : '周六') + ' 休市</span>';
        } else {
            statusEl.innerHTML = '<span style="color:var(--text-muted);">查询中...</span>';
        }
    } else {
        statusEl.innerHTML = '';
    }
    loadFundsData();
}

function clearFundsDate() {
    document.getElementById('fundsOverviewDate').value = '';
    document.getElementById('fundsDateStatus').innerHTML = '';
    loadFundsData();
}

function onBreadthDateChange() {
    var dateVal = document.getElementById('breadthDate').value;
    var statusEl = document.getElementById('breadthDateStatus');
    if (dateVal) {
        var d = new Date(dateVal);
        var day = d.getDay();
        if (day === 0 || day === 6) {
            statusEl.innerHTML = '<span style="color:#f59e0b;">' + (day === 0 ? '周日' : '周六') + ' 休市</span>';
        } else {
            statusEl.innerHTML = '<span style="color:var(--text-muted);">查询中...</span>';
        }
    } else {
        statusEl.innerHTML = '';
    }
    loadBreadth();
}

function clearBreadthDate() {
    document.getElementById('breadthDate').value = '';
    document.getElementById('breadthDateStatus').innerHTML = '';
    loadBreadth();
}

async function loadFundsData() {
    const container = document.getElementById('fundsResult');
    container.innerHTML = '<div class="loading-spinner"></div>';

    let url = '/api/market/funds/northbound';
    if (currentFundsTab === 'industry') url = '/api/market/funds/industry';
    if (currentFundsTab === 'overview') {
        url = '/api/market/funds/overview';
        var dateVal = document.getElementById('fundsOverviewDate').value;
        if (dateVal) {
            url += '?date=' + encodeURIComponent(dateVal);
        }
    }

    const data = await apiGet(url);

    if (data.error) {
        container.innerHTML = '<div class="error-box">' + data.error + '</div>';
        return;
    }

    if (currentFundsTab === 'northbound') {
        const note = data['数据日期说明'] || '';
        const list = data['数据'] || data;
        if (!Array.isArray(list) || list.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>暂无北向资金数据</p>' + (note ? '<p style="font-size:12px;color:var(--text-muted);margin-top:8px;">' + note + '</p>' : '') + '</div>';
            return;
        }
        let html = (note ? '<div class="data-date-note">' + note + '</div>' : '');
        html += '<table class="funds-table"><thead><tr><th>日期</th><th>当日净流入</th></tr></thead><tbody>';
        list.slice(0, 20).forEach(d => {
            const val = d['当日净流入'] || 0;
            const cls = val >= 0 ? 'funds-inflow' : 'funds-outflow';
            html += '<tr><td>' + (d['日期'] || '') + '</td><td class="' + cls + '">' + (val >= 0 ? '+' : '') + (val / 100000000).toFixed(2) + ' 亿</td></tr>';
        });
        html += '</tbody></table>';
        container.innerHTML = html;
    } else if (currentFundsTab === 'industry') {
        const note = data['数据日期说明'] || '';
        const list = data['数据'] || data;
        if (!Array.isArray(list) || list.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>暂无行业资金数据</p>' + (note ? '<p style="font-size:12px;color:var(--text-muted);margin-top:8px;">' + note + '</p>' : '') + '</div>';
            return;
        }
        let html = (note ? '<div class="data-date-note">' + note + '</div>' : '');
        html += '<table class="funds-table"><thead><tr><th>板块名称</th><th>涨跌幅</th><th>主力净流入</th></tr></thead><tbody>';
        list.forEach(d => {
            const inflow = d['主力净流入'] || 0;
            const cls = inflow >= 0 ? 'funds-inflow' : 'funds-outflow';
            html += '<tr><td>' + (d['板块名称'] || '') + '</td><td>' + (d['涨跌幅'] || 0).toFixed(2) + '%</td><td class="' + cls + '">' + (inflow >= 0 ? '+' : '') + (inflow / 100000000).toFixed(2) + ' 亿</td></tr>';
        });
        html += '</tbody></table>';
        container.innerHTML = html;
    } else if (currentFundsTab === 'overview') {
        if (!data || Object.keys(data).length === 0) {
            container.innerHTML = '<div class="empty-state"><p>暂无市场总览数据</p></div>';
            return;
        }
        const note = data['数据日期说明'] || '';
        const isClosed = data['休市'] === true;
        let html = '<div style="padding:24px;">';
        if (note) {
            html += '<div class="data-date-note" style="' + (isClosed ? 'background:#fef3c7;color:#92400e;border:1px solid #f59e0b;' : '') + '">' + note + '</div>';
        }
        if (isClosed) {
            html += '<div class="empty-state" style="padding:40px 0;"><p style="font-size:16px;color:#92400e;">该日期为非交易日，市场休市</p></div>';
        } else {
            html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;">';
            html += '<div class="risk-metric-card"><div class="metric-label">上涨家数</div><div class="metric-value" style="color:var(--red)">' + (data['上涨家数'] || 0) + '</div></div>';
            html += '<div class="risk-metric-card"><div class="metric-label">下跌家数</div><div class="metric-value" style="color:var(--green)">' + (data['下跌家数'] || 0) + '</div></div>';
            html += '<div class="risk-metric-card"><div class="metric-label">上涨比例</div><div class="metric-value">' + (data['上涨比例'] || 0).toFixed(1) + '%</div></div>';
            html += '</div>';
            html += '<div style="margin-top:20px;padding:16px;background:var(--bg-secondary);border-radius:var(--radius-sm);">';
            html += '<span style="color:var(--text-muted);">总成交额：</span><strong>' + formatMoney(data['总成交额']) + '</strong>';
            html += '</div>';
        }

        // 显示指数详情（历史数据查询时）
        if (data['上证指数'] || data['深证成指']) {
            html += '<div style="margin-top:20px;"><h4 style="margin-bottom:12px;">主要指数</h4>';
            html += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;">';
            if (data['上证指数']) {
                var sh = data['上证指数'];
                html += '<div class="risk-metric-card"><div class="metric-label">上证指数</div>';
                html += '<div class="metric-value" style="font-size:20px;">' + (sh['收盘'] || 0).toFixed(2) + '</div>';
                html += '<div style="font-size:12px;color:' + (sh['涨跌幅'] >= 0 ? 'var(--red)' : 'var(--green)') + ';">' + (sh['涨跌幅'] >= 0 ? '+' : '') + (sh['涨跌幅'] || 0).toFixed(2) + '%</div></div>';
            }
            if (data['深证成指']) {
                var sz = data['深证成指'];
                html += '<div class="risk-metric-card"><div class="metric-label">深证成指</div>';
                html += '<div class="metric-value" style="font-size:20px;">' + (sz['收盘'] || 0).toFixed(2) + '</div>';
                html += '<div style="font-size:12px;color:' + (sz['涨跌幅'] >= 0 ? 'var(--red)' : 'var(--green)') + ';">' + (sz['涨跌幅'] >= 0 ? '+' : '') + (sz['涨跌幅'] || 0).toFixed(2) + '%</div></div>';
            }
            html += '</div></div>';
        }
        html += '</div>';
        container.innerHTML = html;
    }
}

// ==================== 市场宽度 ====================
async function loadBreadth() {
    // 市场涨跌统计
    const marketCard = document.getElementById('breadthMarket');
    const sectorCard = document.getElementById('breadthSector');

    var dateVal = document.getElementById('breadthDate').value;
    var breadthUrl = '/api/market/breadth';
    var sectorUrl = '/api/market/breadth/sector';
    if (dateVal) {
        breadthUrl += '?date=' + encodeURIComponent(dateVal);
        sectorUrl += '?date=' + encodeURIComponent(dateVal);
    }

    const breadthData = await apiGet(breadthUrl);
    const sectorData = await apiGet(sectorUrl);

    // 渲染市场宽度
    if (breadthData.error) {
        marketCard.innerHTML = '<h3>市场涨跌统计</h3><div class="error-box">' + breadthData.error + '</div>';
    } else {
        const upPct = breadthData['上涨比例'] || 0;
        const note = breadthData['数据日期说明'] || '';
        const isClosed = breadthData['休市'] === true;

        let html = '<h3>市场涨跌统计</h3>';
        if (note) {
            html += '<div class="data-date-note" style="' + (isClosed ? 'background:#fef3c7;color:#92400e;border:1px solid #f59e0b;' : '') + '">' + note + '</div>';
        }
        if (isClosed) {
            html += '<div class="empty-state" style="padding:30px 0;"><p style="font-size:14px;color:#92400e;">该日期为非交易日，市场休市</p></div>';
        } else {
            html += '<div class="breadth-bar-container"><div class="breadth-bar-label"><span>上涨 ' + (breadthData['上涨家数'] || 0) + ' 家</span><span>' + upPct.toFixed(1) + '%</span></div><div class="breadth-bar"><div class="breadth-bar-fill up" style="width:' + upPct + '%"></div></div></div>';
            html += '<div class="breadth-bar-container"><div class="breadth-bar-label"><span>下跌 ' + (breadthData['下跌家数'] || 0) + ' 家</span><span>' + (100 - upPct).toFixed(1) + '%</span></div><div class="breadth-bar"><div class="breadth-bar-fill down" style="width:' + (100 - upPct) + '%"></div></div></div>';

            html += '<div class="breadth-distribution">';
            html += '<div class="breadth-dist-item"><div class="num" style="color:var(--red)">' + (breadthData['涨停家数'] || 0) + '</div><div class="lbl">涨停</div></div>';
            html += '<div class="breadth-dist-item"><div class="num" style="color:var(--green)">' + (breadthData['跌停家数'] || 0) + '</div><div class="lbl">跌停</div></div>';
            html += '<div class="breadth-dist-item"><div class="num">' + formatMoney(breadthData['总成交额']) + '</div><div class="lbl">成交额</div></div>';
            html += '</div>';

            const sentiment = breadthData['市场情绪'] || '--';
            let sentCls = 'neutral';
            if (sentiment.includes('乐观')) sentCls = 'bullish';
            else if (sentiment.includes('悲观')) sentCls = 'bearish';

            html += '<div class="breadth-sentiment"><div class="breadth-sentiment-label">市场情绪</div><div class="breadth-sentiment-value ' + sentCls + '">' + sentiment + '</div></div>';
        }

        marketCard.innerHTML = html;
    }

    // 渲染板块宽度
    if (sectorData.error) {
        sectorCard.innerHTML = '<h3>板块宽度</h3><div class="error-box">' + sectorData.error + '</div>';
    } else {
        const sectorNote = sectorData['数据日期说明'] || '';
        const sectorClosed = sectorData['休市'] === true;
        let html = '<h3>板块宽度</h3>';
        if (sectorNote) {
            html += '<div class="data-date-note" style="' + (sectorClosed ? 'background:#fef3c7;color:#92400e;border:1px solid #f59e0b;' : '') + '">' + sectorNote + '</div>';
        }
        if (sectorClosed) {
            html += '<div class="empty-state" style="padding:30px 0;"><p style="font-size:14px;color:#92400e;">该日期为非交易日，市场休市</p></div>';
        } else {
            html += '<div class="breadth-bar-container"><div class="breadth-bar-label"><span>上涨板块 ' + (sectorData['上涨板块'] || 0) + '</span><span>' + (sectorData['板块上涨比例'] || 0).toFixed(1) + '%</span></div><div class="breadth-bar"><div class="breadth-bar-fill up" style="width:' + (sectorData['板块上涨比例'] || 0) + '%"></div></div></div>';

            const topSectors = sectorData['领涨板块'] || [];
            if (topSectors.length > 0) {
                html += '<div style="margin-top:12px;"><div style="font-size:12px;color:var(--text-muted);margin-bottom:6px;">领涨板块</div>';
                topSectors.forEach(s => {
                    html += '<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;"><span>' + s['板块'] + '</span><span style="color:var(--red)">+' + s['涨跌幅'].toFixed(2) + '%</span></div>';
                });
                html += '</div>';
            }

            const bottomSectors = sectorData['领跌板块'] || [];
            if (bottomSectors.length > 0) {
                html += '<div style="margin-top:8px;"><div style="font-size:12px;color:var(--text-muted);margin-bottom:6px;">领跌板块</div>';
                bottomSectors.forEach(s => {
                    html += '<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;"><span>' + s['板块'] + '</span><span style="color:var(--green)">' + s['涨跌幅'].toFixed(2) + '%</span></div>';
                });
                html += '</div>';
            }
        }

        sectorCard.innerHTML = html;
    }
}

// ==================== 策略回测 ====================
let btStrategies = [];
let btCurrentResult = null;
let btCurrentTab = 'metrics';

async function loadStrategyList() {
    const select = document.getElementById('btStrategy');
    const data = await apiGet('/api/strategy/list');

    if (data.error || !Array.isArray(data)) {
        select.innerHTML = '<option value="">加载失败</option>';
        return;
    }

    btStrategies = data;
    select.innerHTML = data.map(s =>
        '<option value="' + s.id + '">' + s.name + '</option>'
    ).join('');

    onStrategyChange();
}

function onStrategyChange() {
    const strategyId = document.getElementById('btStrategy').value;
    const paramsDiv = document.getElementById('btStrategyParams');
    const strategy = btStrategies.find(s => s.id === strategyId);

    if (!strategy) {
        paramsDiv.innerHTML = '<p class="text-muted">请选择策略后配置参数</p>';
        return;
    }

    let html = '<div class="param-desc">' + (strategy.description || '') + '</div>';

    if (strategy.params && Object.keys(strategy.params).length > 0) {
        html += '<div style="margin-top:8px;">';
        for (const [key, val] of Object.entries(strategy.params)) {
            const label = getParamLabel(key);
            html += '<div class="param-row">';
            html += '<span class="param-label">' + label + '</span>';
            html += '<input type="number" class="param-input" id="btParam_' + key + '" value="' + val.default + '" min="' + (val.min || 1) + '" max="' + (val.max || 999) + '" step="' + (val.step || 1) + '">';
            html += '</div>';
        }
        html += '</div>';
    }

    paramsDiv.innerHTML = html;
}

function getParamLabel(key) {
    const labels = {
        'fast_period': '快线周期',
        'slow_period': '慢线周期',
        'fast': '快线(DIF)',
        'slow': '慢线(DEA)',
        'signal_period': '信号线周期',
        'period': '计算周期',
        'oversold': '超卖阈值',
        'overbought': '超买阈值',
        'std_dev': '标准差倍数',
        'lookback': '回看周期',
        'volume_multiple': '成交量倍数',
        'price_threshold': '价格突破阈值',
        'ma_fast': '快线周期',
        'ma_slow': '慢线周期',
        'rsi_period': 'RSI周期',
        'rsi_oversold': 'RSI超卖',
        'rsi_overbought': 'RSI超买'
    };
    return labels[key] || key;
}

function getBtParams() {
    const strategyId = document.getElementById('btStrategy').value;
    const strategy = btStrategies.find(s => s.id === strategyId);
    const params = {};

    if (strategy && strategy.params) {
        for (const [key, info] of Object.entries(strategy.params)) {
            const input = document.getElementById('btParam_' + key);
            if (input) {
                if (info.type === 'float') {
                    params[key] = parseFloat(input.value);
                } else {
                    params[key] = parseInt(input.value);
                }
            }
        }
    }

    return params;
}

function setBtSymbol(code) {
    document.getElementById('btSymbol').value = code;
}

async function runBacktest() {
    const symbol = document.getElementById('btSymbol').value.trim();
    const strategyId = document.getElementById('btStrategy').value;
    const capital = parseFloat(document.getElementById('btCapital').value);
    const days = parseInt(document.getElementById('btDays').value);
    const positionSize = parseFloat(document.getElementById('btPositionSize').value);
    const commissionRate = parseFloat(document.getElementById('btCommission').value);
    const slippage = parseFloat(document.getElementById('btSlippage').value);
    const allowShort = document.getElementById('btAllowShort').checked;
    const params = getBtParams();

    if (!symbol || symbol.length !== 6) {
        alert('请输入6位股票代码');
        return;
    }

    const resultDiv = document.getElementById('backtestResult');
    resultDiv.innerHTML = '<div class="bt-loading"><div class="loading-spinner"></div><p>正在执行回测，请稍候...</p></div>';

    const data = await apiPost('/api/backtest/run', {
        symbol: symbol,
        strategy: strategyId,
        capital: capital,
        days: days,
        position_size: positionSize,
        commission_rate: commissionRate,
        slippage: slippage,
        allow_short: allowShort,
        params: params
    });

    if (data.error) {
        resultDiv.innerHTML = '<div class="error-box">' + data.error + '</div>';
        return;
    }

    btCurrentResult = data;
    btCurrentTab = 'metrics';
    renderBacktestResult(data);

    // 关联到 AI 助手上下文
    setAiBacktestContext(data, strategyId);
}

function renderBacktestResult(data) {
    const resultDiv = document.getElementById('backtestResult');
    const metrics = data['绩效指标'] || {};
    const trades = data['交易记录'] || [];
    const equityCurve = data['权益曲线'] || [];
    const strategyName = data['策略'] ? data['策略']['name'] : '';

    const totalReturn = metrics['总收益率'] || 0;
    const annualReturn = metrics['年化收益率'] || 0;
    const sharpe = metrics['夏普比率'] || 0;
    const maxDD = metrics['最大回撤'] || 0;
    const winRate = metrics['胜率'] || 0;
    const tradeCount = metrics['交易总次数'] || 0;
    const benchmark = metrics['基准(买入持有)收益率'] || 0;
    const excess = metrics['超额收益'] || 0;

    let html = '';

    // 摘要卡片
    html += '<div class="bt-summary">';
    html += buildSummaryCard('总收益率', totalReturn.toFixed(2) + '%', totalReturn >= 0 ? 'positive' : 'negative');
    html += buildSummaryCard('年化收益', annualReturn.toFixed(2) + '%', annualReturn >= 0 ? 'positive' : 'negative');
    html += buildSummaryCard('夏普比率', sharpe.toFixed(2), sharpe >= 1 ? 'positive' : (sharpe >= 0 ? 'neutral' : 'negative'));
    html += buildSummaryCard('最大回撤', maxDD.toFixed(2) + '%', 'negative');
    html += '</div>';

    // 标签切换
    html += '<div class="bt-tabs">';
    html += '<button class="bt-tab active" onclick="switchBtTab(\'metrics\')">绩效指标</button>';
    html += '<button class="bt-tab" onclick="switchBtTab(\'trades\')">交易记录 (' + trades.length + ')</button>';
    html += '<button class="bt-tab" onclick="switchBtTab(\'equity\')">权益曲线</button>';
    html += '<button class="bt-tab" onclick="switchBtTab(\'position\')">持仓与信号</button>';
    html += '</div>';

    // 绩效指标内容
    html += '<div class="bt-tab-content active" id="btTab-metrics">';
    html += '<div class="bt-metrics-grid">';
    html += buildMetricItem('总收益率', totalReturn.toFixed(2) + '%', totalReturn >= 0 ? 'positive' : 'negative');
    html += buildMetricItem('年化收益率', annualReturn.toFixed(2) + '%', annualReturn >= 0 ? 'positive' : 'negative');
    html += buildMetricItem('日均收益率', (metrics['日均收益率'] || 0).toFixed(4) + '%', (metrics['日均收益率'] || 0) >= 0 ? 'positive' : 'negative');
    html += buildMetricItem('日收益率标准差', (metrics['日收益率标准差'] || 0).toFixed(4) + '%', 'neutral');
    html += buildMetricItem('夏普比率', sharpe.toFixed(2), sharpe >= 1 ? 'positive' : (sharpe >= 0 ? 'neutral' : 'negative'));
    html += buildMetricItem('索提诺比率', (metrics['索提诺比率'] || 0).toFixed(2), (metrics['索提诺比率'] || 0) >= 1 ? 'positive' : 'neutral');
    html += buildMetricItem('最大回撤', maxDD.toFixed(2) + '%', 'negative');
    html += buildMetricItem('最大回撤持续天数', (metrics['最大回撤持续天数'] || 0) + '天', 'neutral');
    html += buildMetricItem('卡玛比率', (metrics['卡玛比率'] || 0).toFixed(2), (metrics['卡玛比率'] || 0) >= 1 ? 'positive' : 'neutral');
    html += buildMetricItem('交易总次数', tradeCount, 'neutral');
    html += buildMetricItem('胜率', winRate.toFixed(2) + '%', winRate >= 50 ? 'positive' : 'negative');
    html += buildMetricItem('平均盈利', (metrics['平均盈利'] || 0).toFixed(2) + '%', 'positive');
    html += buildMetricItem('平均亏损', (metrics['平均亏损'] || 0).toFixed(2) + '%', 'negative');
    html += buildMetricItem('盈亏比', (metrics['盈亏比'] || 0).toFixed(2), (metrics['盈亏比'] || 0) >= 1 ? 'positive' : 'negative');
    html += buildMetricItem('总盈亏', (metrics['总盈亏'] || 0).toFixed(2) + '%', (metrics['总盈亏'] || 0) >= 0 ? 'positive' : 'negative');
    html += buildMetricItem('总交易费用', (metrics['总交易费用'] || 0).toFixed(2) + '元', 'neutral');
    html += buildMetricItem('基准(买入持有)收益率', benchmark.toFixed(2) + '%', benchmark >= 0 ? 'positive' : 'negative');
    html += buildMetricItem('超额收益', excess.toFixed(2) + '%', excess >= 0 ? 'positive' : 'negative');
    html += '</div>';
    html += '</div>';

    // 交易记录内容
    html += '<div class="bt-tab-content" id="btTab-trades">';
    if (trades.length === 0) {
        html += '<div class="empty-state"><p>该策略在回测期间未产生交易信号</p></div>';
    } else {
        html += '<table class="bt-trades-table"><thead><tr>';
        html += '<th>日期</th><th>类型</th><th>数量(股)</th><th>价格</th><th>金额</th><th>费用</th>';
        html += '</tr></thead><tbody>';
        trades.forEach(t => {
            const isBuy = t['类型'].includes('买入') && !t['类型'].includes('卖出');
            const typeCls = isBuy ? 'trade-buy' : 'trade-sell';
            html += '<tr>';
            html += '<td>' + (t['日期'] || '') + '</td>';
            html += '<td class="' + typeCls + '">' + (t['类型'] || '') + '</td>';
            html += '<td>' + (t['数量'] || 0) + '</td>';
            html += '<td>' + fmtPrice(t['价格']) + '</td>';
            html += '<td>' + fmtMoney(t['金额']) + '</td>';
            html += '<td>' + fmtPrice(t['费用']) + '</td>';
            html += '</tr>';
        });
        html += '</tbody></table>';
    }
    html += '</div>';

    // 权益曲线内容
    html += '<div class="bt-tab-content" id="btTab-equity">';
    html += '<div class="bt-equity-chart"><canvas id="btEquityCanvas"></canvas></div>';
    html += '</div>';

    // 持仓与信号内容
    html += '<div class="bt-tab-content" id="btTab-position">';
    html += '<div class="bt-position-chart"><canvas id="btPositionCanvas"></canvas></div>';
    html += '<div class="bt-signal-summary" style="margin-top:16px;"></div>';
    html += '</div>';

    // 导出按钮
    html += '<div style="margin-top:16px;display:flex;gap:8px;">';
    html += '<button class="btn-secondary" onclick="exportBacktestExcel()">导出Excel</button>';
    html += '<button class="btn-secondary" onclick="exportBacktestHtml()">导出HTML报告</button>';
    html += '</div>';

    resultDiv.innerHTML = html;

    // 绘制权益曲线（含买卖信号标记）
    if (equityCurve.length > 0) {
        setTimeout(() => drawEquityCurve(equityCurve, trades), 100);
    }
    // 绘制持仓与信号图
    if (equityCurve.length > 0) {
        setTimeout(() => drawPositionChart(equityCurve, trades), 150);
    }
}

function buildSummaryCard(label, value, cls) {
    return '<div class="bt-summary-card">' +
        '<div class="bt-label">' + label + '</div>' +
        '<div class="bt-value" style="color:' + getColorByClass(cls) + '">' + value + '</div>' +
        '</div>';
}

function buildMetricItem(name, value, cls) {
    return '<div class="bt-metric-item">' +
        '<span class="metric-name">' + name + '</span>' +
        '<span class="metric-val ' + cls + '">' + value + '</span>' +
        '</div>';
}

function getColorByClass(cls) {
    if (cls === 'positive') return 'var(--red)';
    if (cls === 'negative') return 'var(--green)';
    return 'var(--text-primary)';
}

function switchBtTab(tabName) {
    btCurrentTab = tabName;

    document.querySelectorAll('.bt-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.bt-tab-content').forEach(c => c.classList.remove('active'));

    const tabs = document.querySelectorAll('.bt-tab');
    tabs.forEach(t => {
        if (t.textContent.includes(tabName === 'metrics' ? '绩效指标' : (tabName === 'trades' ? '交易记录' : '权益曲线'))) {
            t.classList.add('active');
        }
    });

    const content = document.getElementById('btTab-' + tabName);
    if (content) content.classList.add('active');

    // 切换到权益曲线时重新绘制
    if (tabName === 'equity' && btCurrentResult && btCurrentResult['权益曲线']) {
        setTimeout(() => drawEquityCurve(btCurrentResult['权益曲线'], btCurrentResult['交易记录'] || []), 100);
    }
    // 切换到持仓与信号时重新绘制
    if (tabName === 'position' && btCurrentResult && btCurrentResult['权益曲线']) {
        setTimeout(() => drawPositionChart(btCurrentResult['权益曲线'], btCurrentResult['交易记录'] || []), 150);
    }
}

function drawEquityCurve(equityCurve, trades) {
    trades = trades || [];
    const canvas = document.getElementById('btEquityCanvas');
    if (!canvas) return;

    const container = canvas.parentElement;
    canvas.width = container.clientWidth - 40;
    canvas.height = container.clientHeight - 40;

    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const padding = { top: 20, right: 20, bottom: 40, left: 70 };

    ctx.clearRect(0, 0, w, h);

    const values = equityCurve.map(e => e['权益']);
    const dates = equityCurve.map(e => e['日期']);
    const minVal = Math.min(...values) * 0.995;
    const maxVal = Math.max(...values) * 1.005;
    const range = maxVal - minVal || 1;

    const plotW = w - padding.left - padding.right;
    const plotH = h - padding.top - padding.bottom;

    function x(i) { return padding.left + (i / (values.length - 1)) * plotW; }
    function y(v) { return padding.top + plotH - ((v - minVal) / range) * plotH; }
    function findIndexByDate(dateStr) {
        for (var j = 0; j < dates.length; j++) {
            if (dates[j] === dateStr) return j;
        }
        return -1;
    }

    // 网格线
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
        const gy = padding.top + (plotH / gridLines) * i;
        ctx.beginPath();
        ctx.moveTo(padding.left, gy);
        ctx.lineTo(w - padding.right, gy);
        ctx.stroke();

        const gval = maxVal - (range / gridLines) * i;
        ctx.fillStyle = 'var(--text-muted)';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(formatMoney(gval), padding.left - 8, gy + 4);
    }

    // 初始资金参考线
    const initY = y(equityCurve[0]['权益']);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(padding.left, initY);
    ctx.lineTo(w - padding.right, initY);
    ctx.stroke();
    ctx.setLineDash([]);

    // 权益曲线
    ctx.strokeStyle = '#4f8cff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < values.length; i++) {
        const px = x(i);
        const py = y(values[i]);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // 填充区域
    ctx.lineTo(x(values.length - 1), y(minVal));
    ctx.lineTo(x(0), y(minVal));
    ctx.closePath();
    const gradient = ctx.createLinearGradient(0, padding.top, 0, h - padding.bottom);
    gradient.addColorStop(0, 'rgba(79, 140, 255, 0.2)');
    gradient.addColorStop(1, 'rgba(79, 140, 255, 0.02)');
    ctx.fillStyle = gradient;
    ctx.fill();

    // 买卖信号标记
    var markerSize = 6;
    for (var t = 0; t < trades.length; t++) {
        var trade = trades[t];
        var idx = findIndexByDate(trade['日期']);
        if (idx < 0) continue;
        var px = x(idx);
        var py = y(values[idx]);
        var isBuy = trade['类型'].indexOf('买入') >= 0 && trade['类型'].indexOf('卖出') < 0;
        if (isBuy) {
            ctx.fillStyle = '#ef5350';
            ctx.beginPath();
            ctx.moveTo(px, py - markerSize - 4);
            ctx.lineTo(px - markerSize, py - 4);
            ctx.lineTo(px + markerSize, py - 4);
            ctx.closePath();
            ctx.fill();
        } else {
            ctx.fillStyle = '#26a69a';
            ctx.beginPath();
            ctx.moveTo(px, py + markerSize + 4);
            ctx.lineTo(px - markerSize, py + 4);
            ctx.lineTo(px + markerSize, py + 4);
            ctx.closePath();
            ctx.fill();
        }
    }

    // X轴日期标签
    ctx.fillStyle = '#9aa0b0';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    const dateStep = Math.max(1, Math.floor(values.length / 6));
    for (let i = 0; i < values.length; i += dateStep) {
        const date = equityCurve[i]['日期'] || '';
        ctx.fillText(date.substring(5), x(i), h - padding.bottom + 16);
    }
    const lastDate = equityCurve[values.length - 1]['日期'] || '';
    ctx.fillText(lastDate.substring(5), x(values.length - 1), h - padding.bottom + 16);

    // 图例
    ctx.fillStyle = '#ef5350';
    ctx.fillRect(w - 120, 8, 10, 10);
    ctx.fillStyle = '#9aa0b0';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('买入', w - 106, 17);
    ctx.fillStyle = '#26a69a';
    ctx.fillRect(w - 60, 8, 10, 10);
    ctx.fillStyle = '#9aa0b0';
    ctx.fillText('卖出', w - 46, 17);
}

function drawPositionChart(equityCurve, trades) {
    trades = trades || [];
    var canvas = document.getElementById('btPositionCanvas');
    if (!canvas) return;

    var container = canvas.parentElement;
    var containerW = container.clientWidth - 40;
    var containerH = 300;
    canvas.width = containerW;
    canvas.height = containerH;

    var ctx = canvas.getContext('2d');
    var w = canvas.width;
    var h = canvas.height;
    var padding = { top: 20, right: 20, bottom: 40, left: 70 };

    ctx.clearRect(0, 0, w, h);

    var dates = equityCurve.map(function(e) { return e['日期']; });
    var directions = equityCurve.map(function(e) {
        var d = e['持仓方向'] || '空仓';
        if (d === '多头') return 1;
        if (d === '空头') return -1;
        return 0;
    });

    var plotW = w - padding.left - padding.right;
    var plotH = h - padding.top - padding.bottom;

    function x(i) { return padding.left + (i / (dates.length - 1)) * plotW; }
    function y(v) { return padding.top + plotH / 2 - (v / 2) * plotH * 0.8; }
    function findIndexByDate(dateStr) {
        for (var j = 0; j < dates.length; j++) {
            if (dates[j] === dateStr) return j;
        }
        return -1;
    }

    // 背景网格
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    // 零线
    var zeroY = y(0);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.moveTo(padding.left, zeroY);
    ctx.lineTo(w - padding.right, zeroY);
    ctx.stroke();

    // 标签
    ctx.fillStyle = '#9aa0b0';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('多头', padding.left - 8, y(1) + 4);
    ctx.fillText('空仓', padding.left - 8, zeroY + 4);
    ctx.fillText('空头', padding.left - 8, y(-1) + 4);

    // 持仓区域填充
    var longPoints = [];
    var shortPoints = [];
    for (var i = 0; i < directions.length; i++) {
        var px = x(i);
        if (directions[i] === 1) {
            longPoints.push({ x: px, yTop: y(1), yBot: zeroY });
        } else if (directions[i] === -1) {
            shortPoints.push({ x: px, yTop: zeroY, yBot: y(-1) });
        }
    }

    // 绘制多头持仓区域
    if (longPoints.length > 0) {
        ctx.fillStyle = 'rgba(239, 83, 80, 0.15)';
        ctx.beginPath();
        for (var li = 0; li < longPoints.length; li++) {
            var lp = longPoints[li];
            if (li === 0) ctx.moveTo(lp.x, lp.yTop);
            else ctx.lineTo(lp.x, lp.yTop);
        }
        for (li = longPoints.length - 1; li >= 0; li--) {
            ctx.lineTo(longPoints[li].x, longPoints[li].yBot);
        }
        ctx.closePath();
        ctx.fill();
    }

    // 绘制空头持仓区域
    if (shortPoints.length > 0) {
        ctx.fillStyle = 'rgba(38, 166, 154, 0.15)';
        ctx.beginPath();
        for (var si = 0; si < shortPoints.length; si++) {
            var sp = shortPoints[si];
            if (si === 0) ctx.moveTo(sp.x, sp.yTop);
            else ctx.lineTo(sp.x, sp.yTop);
        }
        for (si = shortPoints.length - 1; si >= 0; si--) {
            ctx.lineTo(shortPoints[si].x, shortPoints[si].yBot);
        }
        ctx.closePath();
        ctx.fill();
    }

    // 买卖信号标记
    var markerSize = 5;
    for (var t = 0; t < trades.length; t++) {
        var trade = trades[t];
        var idx = findIndexByDate(trade['日期']);
        if (idx < 0) continue;
        var px = x(idx);
        var isBuy = trade['类型'].indexOf('买入') >= 0 && trade['类型'].indexOf('卖出') < 0;
        if (isBuy) {
            ctx.fillStyle = '#ef5350';
            ctx.beginPath();
            ctx.arc(px, zeroY - 8, markerSize, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.fillStyle = '#26a69a';
            ctx.beginPath();
            ctx.arc(px, zeroY + 8, markerSize, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // X轴日期标签
    ctx.fillStyle = '#9aa0b0';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    var dateStep = Math.max(1, Math.floor(dates.length / 6));
    for (var di = 0; di < dates.length; di += dateStep) {
        ctx.fillText(dates[di].substring(5), x(di), h - padding.bottom + 16);
    }
    ctx.fillText(dates[dates.length - 1].substring(5), x(dates.length - 1), h - padding.bottom + 16);

    // 图例
    ctx.fillStyle = '#ef5350';
    ctx.fillRect(w - 140, 8, 10, 10);
    ctx.fillStyle = '#9aa0b0';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('买入/多头', w - 126, 17);
    ctx.fillStyle = '#26a69a';
    ctx.fillRect(w - 60, 8, 10, 10);
    ctx.fillStyle = '#9aa0b0';
    ctx.fillText('卖出/空头', w - 46, 17);

    // 信号统计摘要
    var buyCount = 0, sellCount = 0;
    for (var tc = 0; tc < trades.length; tc++) {
        var tt = trades[tc];
        if (tt['类型'].indexOf('买入') >= 0 && tt['类型'].indexOf('卖出') < 0) buyCount++;
        else sellCount++;
    }
    var longDays = directions.filter(function(d) { return d === 1; }).length;
    var shortDays = directions.filter(function(d) { return d === -1; }).length;
    var flatDays = directions.filter(function(d) { return d === 0; }).length;
    var totalDays = directions.length;

    var summaryDiv = document.querySelector('.bt-signal-summary');
    if (summaryDiv) {
        summaryDiv.innerHTML = '<div class="result-card"><h4>持仓与信号统计</h4>' +
            '<div style="display:flex;gap:24px;flex-wrap:wrap;">' +
            '<div><span style="color:#9aa0b0;">买入信号: </span><span style="color:#ef5350;font-weight:600;">' + buyCount + '次</span></div>' +
            '<div><span style="color:#9aa0b0;">卖出信号: </span><span style="color:#26a69a;font-weight:600;">' + sellCount + '次</span></div>' +
            '<div><span style="color:#9aa0b0;">多头持仓: </span><span style="color:#ef5350;font-weight:600;">' + longDays + '天 (' + (longDays/totalDays*100).toFixed(1) + '%)</span></div>' +
            '<div><span style="color:#9aa0b0;">空头持仓: </span><span style="color:#26a69a;font-weight:600;">' + shortDays + '天 (' + (shortDays/totalDays*100).toFixed(1) + '%)</span></div>' +
            '<div><span style="color:#9aa0b0;">空仓: </span><span style="font-weight:600;">' + flatDays + '天 (' + (flatDays/totalDays*100).toFixed(1) + '%)</span></div>' +
            '</div></div>';
    }
}

async function exportBacktestExcel() {
    if (!btCurrentResult) { alert('请先执行回测'); return; }
    var data = await apiPost('/api/export/excel', { data: btCurrentResult });
    if (data.error) { alert(data.error); return; }
    if (data.data) {
        var byteChars = atob(data.data);
        var byteNums = new Array(byteChars.length);
        for (var i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
        var byteArr = new Uint8Array(byteNums);
        var blob = new Blob([byteArr], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        var link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = data.filename || '回测报告.xlsx';
        link.click();
    }
}

async function exportBacktestHtml() {
    if (!btCurrentResult) { alert('请先执行回测'); return; }
    var data = await apiPost('/api/export/html', { data: btCurrentResult });
    if (data.error) { alert(data.error); return; }
    if (data.html) {
        var win = window.open('', '_blank');
        win.document.write(data.html);
        win.document.close();
    }
}

async function compareStrategies() {
    const symbol = document.getElementById('btSymbol').value.trim();
    const capital = parseFloat(document.getElementById('btCapital').value);
    const days = parseInt(document.getElementById('btDays').value);
    const positionSize = parseFloat(document.getElementById('btPositionSize').value);
    const commissionRate = parseFloat(document.getElementById('btCommission').value);
    const slippage = parseFloat(document.getElementById('btSlippage').value);

    if (!symbol || symbol.length !== 6) {
        alert('请输入6位股票代码');
        return;
    }

    const resultDiv = document.getElementById('backtestResult');
    resultDiv.innerHTML = '<div class="bt-loading"><div class="loading-spinner"></div><p>正在对比所有策略，请稍候...</p></div>';

    const data = await apiPost('/api/backtest/compare', {
        symbol: symbol,
        capital: capital,
        days: days,
        position_size: positionSize,
        commission_rate: commissionRate,
        slippage: slippage
    });

    if (data.error) {
        resultDiv.innerHTML = '<div class="error-box">' + data.error + '</div>';
        return;
    }

    // 关联到 AI 助手上下文（使用最佳策略）
    var bestStrategy = data['最佳策略'];
    if (bestStrategy) {
        setAiBacktestContext(data, bestStrategy['策略ID'] || 'compare');
    }

    renderCompareResult(data);
}

function renderCompareResult(data) {
    const resultDiv = document.getElementById('backtestResult');
    const results = data['策略对比'] || [];
    const symbol = data['股票代码'] || '';

    if (results.length === 0) {
        resultDiv.innerHTML = '<div class="empty-state"><p>没有可对比的策略结果</p></div>';
        return;
    }

    const bestTotalReturn = Math.max(...results.map(r => r['总收益率'] || -Infinity));
    const bestSharpe = Math.max(...results.map(r => r['夏普比率'] || -Infinity));
    const bestWinRate = Math.max(...results.map(r => r['胜率'] || -Infinity));
    const bestMaxDD = Math.max(...results.map(r => r['最大回撤'] || -Infinity));
    const bestExcess = Math.max(...results.map(r => r['超额收益'] || -Infinity));

    let html = '<h3 style="margin-bottom:16px;">' + symbol + ' 策略对比</h3>';
    html += '<table class="bt-compare-table"><thead><tr>';
    html += '<th>策略</th><th>总收益率</th><th>年化收益</th><th>夏普比率</th><th>最大回撤</th><th>胜率</th><th>交易次数</th><th>超额收益</th>';
    html += '</tr></thead><tbody>';

    results.forEach(r => {
        const name = r['策略名称'] || r['策略ID'];
        const totalRet = r['总收益率'] || 0;
        const annualRet = r['年化收益率'] || 0;
        const sharpe = r['夏普比率'] || 0;
        const maxDD = r['最大回撤'] || 0;
        const winRate = r['胜率'] || 0;
        const tradeCount = r['交易次数'] || 0;
        const excess = r['超额收益'] || 0;

        html += '<tr>';
        html += '<td>' + name + '</td>';
        html += '<td class="' + (totalRet === bestTotalReturn ? 'best' : '') + '" style="color:' + (totalRet >= 0 ? 'var(--red)' : 'var(--green)') + '">' + totalRet.toFixed(2) + '%</td>';
        html += '<td style="color:' + (annualRet >= 0 ? 'var(--red)' : 'var(--green)') + '">' + annualRet.toFixed(2) + '%</td>';
        html += '<td class="' + (sharpe === bestSharpe ? 'best' : '') + '">' + sharpe.toFixed(2) + '</td>';
        html += '<td class="' + (maxDD === bestMaxDD ? 'best' : '') + '" style="color:var(--green)">' + maxDD.toFixed(2) + '%</td>';
        html += '<td class="' + (winRate === bestWinRate ? 'best' : '') + '">' + winRate.toFixed(2) + '%</td>';
        html += '<td>' + tradeCount + '</td>';
        html += '<td class="' + (excess === bestExcess ? 'best' : '') + '" style="color:' + (excess >= 0 ? 'var(--red)' : 'var(--green)') + '">' + excess.toFixed(2) + '%</td>';
        html += '</tr>';
    });

    html += '</tbody></table>';

    resultDiv.innerHTML = html;
}

// ==================== 股票对比 ====================
async function compareStocks() {
    const symbols = document.getElementById('compareSymbols').value.trim();
    if (!symbols) {
        alert('请输入股票代码');
        return;
    }

    const container = document.getElementById('compareResult');
    container.innerHTML = '<div class="loading-spinner"></div>';

    const data = await apiGet('/api/stock/compare?symbols=' + encodeURIComponent(symbols));

    if (data.error) {
        container.innerHTML = '<div class="error-box">' + data.error + '</div>';
        return;
    }

    const stocks = data['对比股票'] || [];
    if (stocks.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>无法获取对比数据</p></div>';
        return;
    }

    let html = '<table class="compare-table"><thead><tr>';
    html += '<th>代码</th><th>名称</th><th>最新价</th><th>涨跌幅</th><th>市盈率</th><th>市净率</th><th>总市值</th><th>5日涨跌</th><th>20日涨跌</th><th>波动率</th>';
    html += '</tr></thead><tbody>';

    stocks.forEach(s => {
        if (s.error) {
            html += '<tr><td>' + s['代码'] + '</td><td colspan="9" style="color:var(--text-muted)">数据获取失败</td></tr>';
            return;
        }
        html += '<tr>';
        html += '<td>' + (s['代码'] || '') + '</td>';
        html += '<td>' + (s['名称'] || '') + '</td>';
        html += '<td>' + (s['最新价'] || 0).toFixed(2) + '</td>';
        html += '<td style="color:' + ((s['涨跌幅'] || 0) >= 0 ? 'var(--red)' : 'var(--green)') + '">' + ((s['涨跌幅'] || 0) >= 0 ? '+' : '') + (s['涨跌幅'] || 0).toFixed(2) + '%</td>';
        html += '<td>' + (s['市盈率-动态'] ? s['市盈率-动态'].toFixed(2) : '--') + '</td>';
        html += '<td>' + (s['市净率'] ? s['市净率'].toFixed(2) : '--') + '</td>';
        html += '<td>' + formatMoney(s['总市值']) + '</td>';
        html += '<td>' + (s['5日涨跌幅'] !== null ? (s['5日涨跌幅'] >= 0 ? '+' : '') + s['5日涨跌幅'].toFixed(2) + '%' : '--') + '</td>';
        html += '<td>' + (s['20日涨跌幅'] !== null ? (s['20日涨跌幅'] >= 0 ? '+' : '') + s['20日涨跌幅'].toFixed(2) + '%' : '--') + '</td>';
        html += '<td>' + (s['年化波动率'] ? s['年化波动率'].toFixed(2) + '%' : '--') + '</td>';
        html += '</tr>';
    });

    html += '</tbody></table>';

    // 排名分析
    const rankings = data['排名分析'] || {};
    if (Object.keys(rankings).length > 0) {
        html += '<div class="compare-rank-section">';
        for (const [title, items] of Object.entries(rankings)) {
            html += '<h3>' + title + '</h3><div class="compare-rank-list">';
            items.forEach((item, idx) => {
                html += '<div class="compare-rank-item"><span class="rank-num">#' + (idx + 1) + '</span>' + item['名称'] + '</div>';
            });
            html += '</div>';
        }
        html += '</div>';
    }

    container.innerHTML = html;
}

// ==================== 风险分析 ====================
async function analyzeRisk() {
    const symbol = document.getElementById('riskSymbol').value.trim();
    if (!symbol) {
        alert('请输入股票代码');
        return;
    }

    const container = document.getElementById('riskResult');
    container.innerHTML = '<div class="loading-spinner"></div>';

    const data = await apiGet('/api/stock/risk?symbol=' + symbol);

    if (data.error) {
        container.innerHTML = '<div class="error-box">' + data.error + '</div>';
        return;
    }

    const volLevel = data['波动率等级'] || '--';
    let volCls = 'risk-level-low';
    if (volLevel.includes('高')) volCls = 'risk-level-high';
    else if (volLevel.includes('中')) volCls = 'risk-level-medium';

    const sharpeLevel = data['夏普等级'] || '--';
    let sharpeCls = 'risk-level-low';
    if (sharpeLevel === '较差') sharpeCls = 'risk-level-high';
    else if (sharpeLevel === '一般') sharpeCls = 'risk-level-medium';

    let html = '<div class="risk-metrics-grid">';
    html += '<div class="risk-metric-card"><div class="metric-label">年化波动率</div><div class="metric-value">' + (data['年化波动率'] || 0).toFixed(2) + '%</div><div class="metric-level ' + volCls + '">' + volLevel + '风险</div></div>';
    html += '<div class="risk-metric-card"><div class="metric-label">最大回撤</div><div class="metric-value" style="color:var(--green)">' + (data['最大回撤'] || 0).toFixed(2) + '%</div><div class="metric-level">历史最大亏损</div></div>';
    html += '<div class="risk-metric-card"><div class="metric-label">夏普比率</div><div class="metric-value">' + (data['夏普比率'] || 0).toFixed(2) + '</div><div class="metric-level ' + sharpeCls + '">' + sharpeLevel + '</div></div>';
    html += '<div class="risk-metric-card"><div class="metric-label">VaR(95%)</div><div class="metric-value">' + (data['VaR_95'] || 0).toFixed(2) + '%</div><div class="metric-level">单日最大亏损</div></div>';
    html += '<div class="risk-metric-card"><div class="metric-label">胜率</div><div class="metric-value">' + (data['胜率'] || 0).toFixed(1) + '%</div><div class="metric-level">上涨交易日占比</div></div>';
    html += '<div class="risk-metric-card"><div class="metric-label">Beta</div><div class="metric-value">' + (data['Beta'] !== null ? data['Beta'].toFixed(2) : '--') + '</div><div class="metric-level">市场敏感度</div></div>';
    html += '</div>';

    if (data['Alpha'] !== null) {
        html += '<div style="padding:16px;background:var(--bg-secondary);border-radius:var(--radius-sm);margin-top:8px;">';
        html += '<span style="color:var(--text-muted);">Alpha：</span><strong>' + data['Alpha'].toFixed(2) + '%</strong>';
        html += '<span style="color:var(--text-muted);margin-left:16px;">数据天数：</span><strong>' + (data['数据天数'] || 0) + ' 个交易日</strong>';
        html += '</div>';
    }

    container.innerHTML = html;
}

// ==================== 因子库 ====================

async function calcFactors() {
    const symbol = document.getElementById('factorSymbol').value.trim();
    const days = parseInt(document.getElementById('factorDays').value);

    if (!symbol || symbol.length !== 6) {
        alert('请输入6位股票代码');
        return;
    }

    const container = document.getElementById('factorResult');
    container.innerHTML = '<div class="loading-spinner"></div>';

    const data = await apiPost('/api/factor/calc', { symbol: symbol, days: days });

    if (data.error) {
        container.innerHTML = '<div class="error-box">' + data.error + '</div>';
        return;
    }

    renderFactorResult(data);
}

function renderFactorResult(data) {
    const container = document.getElementById('factorResult');
    const scores = data['因子评分'] || {};
    const tech = data['技术因子'] || {};
    const fund = data['基本面因子'] || {};
    const sent = data['情绪因子'] || {};

    let html = '';

    // 评分卡片
    html += '<div class="factor-score-card">';
    html += '<div class="score-big">' + (scores['综合评分'] || 0) + '</div>';
    html += '<div class="score-grade">' + (scores['评级'] || '--') + '</div>';
    html += '<div class="factor-score-dims">';
    const dims = scores['各维度评分'] || {};
    for (const [k, v] of Object.entries(dims)) {
        html += '<div class="factor-score-dim"><div class="dim-name">' + k + '</div><div class="dim-val">' + v + '</div></div>';
    }
    html += '</div>';
    if (scores['评分说明']) {
        html += '<ul class="factor-insights">';
        scores['评分说明'].forEach(function (s) { html += '<li>' + s + '</li>'; });
        html += '</ul>';
    }
    html += '</div>';

    // 技术因子
    html += '<div class="factor-category"><h3>技术因子</h3>';
    for (const [catName, catFactors] of Object.entries(tech)) {
        html += '<div class="factor-subcategory"><h4>' + catName + '</h4>';
        html += '<div class="factor-grid">';
        for (const [k, v] of Object.entries(catFactors)) {
            if (k === '指标说明') continue;
            if (typeof v === 'boolean') {
                html += '<div class="factor-item"><span class="fname">' + k + '</span><span class="fval ' + (v ? 'positive' : '') + '">' + (v ? '是' : '否') + '</span></div>';
            } else if (v !== null && v !== undefined) {
                let cls = '';
                if (typeof v === 'number') cls = v >= 0 ? 'positive' : 'negative';
                html += '<div class="factor-item"><span class="fname">' + k + '</span><span class="fval ' + cls + '">' + (typeof v === 'number' ? v.toFixed(2) : v) + '</span></div>';
            } else {
                html += '<div class="factor-item"><span class="fname">' + k + '</span><span class="fval">--</span></div>';
            }
        }
        html += '</div></div>';
    }
    html += '</div>';

    // 基本面因子
    html += '<div class="factor-category"><h3>基本面因子</h3>';
    for (const [catName, catFactors] of Object.entries(fund)) {
        html += '<div class="factor-subcategory"><h4>' + catName + '</h4>';
        html += '<div class="factor-grid">';
        for (const [k, v] of Object.entries(catFactors)) {
            if (k === '指标说明') continue;
            if (v !== null && v !== undefined) {
                html += '<div class="factor-item"><span class="fname">' + k + '</span><span class="fval">' + (typeof v === 'number' ? v.toFixed(2) : v) + '</span></div>';
            } else {
                html += '<div class="factor-item"><span class="fname">' + k + '</span><span class="fval">--</span></div>';
            }
        }
        html += '</div></div>';
    }
    html += '</div>';

    // 情绪因子
    html += '<div class="factor-category"><h3>情绪因子</h3>';
    for (const [catName, catFactors] of Object.entries(sent)) {
        html += '<div class="factor-subcategory"><h4>' + catName + '</h4>';
        html += '<div class="factor-grid">';
        for (const [k, v] of Object.entries(catFactors)) {
            if (k === '指标说明') continue;
            if (v !== null && v !== undefined) {
                html += '<div class="factor-item"><span class="fname">' + k + '</span><span class="fval">' + (typeof v === 'number' ? v.toFixed(2) : v) + '</span></div>';
            } else {
                html += '<div class="factor-item"><span class="fname">' + k + '</span><span class="fval">--</span></div>';
            }
        }
        html += '</div></div>';
    }
    html += '</div>';

    container.innerHTML = html;
}

// ==================== 多因子选股 ====================

async function runMultiFactor() {
    const symbolsStr = document.getElementById('mfSymbols').value.trim();
    const method = document.getElementById('mfMethod').value;
    const normalize = document.getElementById('mfNormalize').value;
    const topN = parseInt(document.getElementById('mfTopN').value);

    if (!symbolsStr) {
        alert('请输入股票代码列表');
        return;
    }

    const symbols = symbolsStr.split(',').map(function(s) { return s.trim(); }).filter(function(s) { return s.length === 6; });

    if (symbols.length < 5) {
        alert('至少需要5只有效股票代码');
        return;
    }

    const container = document.getElementById('mfResult');
    container.innerHTML = '<div class="loading-spinner"></div><p style="text-align:center;color:var(--text-muted);">正在计算多因子得分，请耐心等待...</p>';

    const data = await apiPost('/api/multi-factor/select', {
        symbols: symbols,
        method: method,
        normalize: normalize,
        top_n: topN,
        days: 250
    });

    if (data.error) {
        container.innerHTML = '<div class="error-box">' + data.error + '</div>';
        return;
    }

    renderMultiFactorResult(data);
}

function renderMultiFactorResult(data) {
    const container = document.getElementById('mfResult');
    const stocks = data['选股结果'] || [];
    const factorWeights = data['因子权重'] || {};
    const allRanked = data['全部排名'] || [];

    var html = '';

    // 概览信息
    html += '<div class="mf-summary">';
    html += '<div class="mf-summary-item"><span class="mf-summary-label">选股时间</span><span class="mf-summary-value">' + (data['选股时间'] || '--') + '</span></div>';
    html += '<div class="mf-summary-item"><span class="mf-summary-label">候选股票</span><span class="mf-summary-value">' + (data['候选股票数'] || 0) + ' 只</span></div>';
    html += '<div class="mf-summary-item"><span class="mf-summary-label">合成方法</span><span class="mf-summary-value">' + (data['合成方法'] || '--') + '</span></div>';
    html += '<div class="mf-summary-item"><span class="mf-summary-label">标准化</span><span class="mf-summary-value">' + (data['标准化方法'] || '--') + '</span></div>';
    html += '</div>';

    // 因子权重
    html += '<div class="mf-weights">';
    html += '<h3>因子权重分配</h3>';
    html += '<div class="mf-weight-bars">';
    for (var f in factorWeights) {
        if (factorWeights.hasOwnProperty(f)) {
            var w = factorWeights[f];
            html += '<div class="mf-weight-item"><span class="mf-weight-name">' + f + '</span><div class="mf-weight-bar-bg"><div class="mf-weight-bar-fill" style="width:' + w + '%"></div></div><span class="mf-weight-val">' + w + '%</span></div>';
        }
    }
    html += '</div></div>';

    // 选股结果表格
    html += '<div class="mf-table-wrap">';
    html += '<h3>选股结果 TOP' + stocks.length + '</h3>';
    html += '<table class="mf-table"><thead><tr><th>排名</th><th>代码</th><th>综合得分</th><th>因子明细</th></tr></thead><tbody>';

    for (var i = 0; i < stocks.length; i++) {
        var s = stocks[i];
        var details = s['因子明细'] || {};
        var detailHtml = '';
        for (var dk in details) {
            if (details.hasOwnProperty(dk)) {
                var dv = details[dk];
                var dcls = dv >= 50 ? 'positive' : 'negative';
                detailHtml += '<span class="mf-detail-tag ' + dcls + '">' + dk + ': ' + (dv || 0).toFixed(1) + '</span>';
            }
        }
        html += '<tr><td class="mf-rank">' + s['排名'] + '</td><td class="mf-code">' + s['代码'] + '</td><td class="mf-score">' + (s['综合得分'] || 0).toFixed(2) + '</td><td class="mf-details">' + detailHtml + '</td></tr>';
    }

    html += '</tbody></table></div>';

    // 全部排名
    if (allRanked.length > stocks.length) {
        html += '<details class="mf-all-ranked"><summary>查看全部排名（共' + allRanked.length + '只）</summary>';
        html += '<table class="mf-table"><thead><tr><th>排名</th><th>代码</th><th>得分</th></tr></thead><tbody>';
        for (var j = 0; j < allRanked.length; j++) {
            var r = allRanked[j];
            html += '<tr><td>' + (j + 1) + '</td><td>' + r['代码'] + '</td><td>' + (r['得分'] || 0).toFixed(2) + '</td></tr>';
        }
        html += '</tbody></table></details>';
    }

    container.innerHTML = html;
}

// ==================== 组合优化 ====================

async function runOptimizer() {
    const symbolsStr = document.getElementById('optSymbols').value.trim();
    const capital = parseFloat(document.getElementById('optCapital').value);

    if (!symbolsStr) {
        alert('请输入股票代码');
        return;
    }

    const symbols = symbolsStr.split(',').map(function (s) { return s.trim(); }).filter(function (s) { return s.length === 6; });

    if (symbols.length < 2) {
        alert('至少需要2只有效的股票代码（6位数字）');
        return;
    }

    const container = document.getElementById('optimizerResult');
    container.innerHTML = '<div class="loading-spinner"></div>';

    const data = await apiPost('/api/portfolio/optimize', {
        symbols: symbols,
        capital: capital,
        days: 250
    });

    if (data.error) {
        container.innerHTML = '<div class="error-box">' + data.error + '</div>';
        return;
    }

    renderOptimizerResult(data);
}

function renderOptimizerResult(data) {
    const container = document.getElementById('optimizerResult');
    const methods = data['优化方法'] || {};
    const recommend = data['推荐方案'] || '';
    const allocation = data['资金分配'] || {};

    let html = '';

    // 推荐方案
    if (recommend && methods[recommend]) {
        html += '<div class="opt-recommend">';
        html += '<span class="rec-badge">推荐</span>';
        html += '<span class="rec-text">推荐使用 <strong>' + recommend + '</strong> 方案 - ' + (methods[recommend]['说明'] || '') + '</span>';
        html += '</div>';
    }

    // 各方法卡片
    html += '<div class="opt-methods">';
    for (const [name, method] of Object.entries(methods)) {
        const isRec = name === recommend;
        html += '<div class="opt-method-card' + (isRec ? ' recommended' : '') + '">';
        html += '<h4>' + name + (isRec ? ' <span style="color:var(--accent);">推荐</span>' : '') + '</h4>';
        html += '<div class="method-desc">' + (method['说明'] || '') + '</div>';

        const weights = method['权重'] || {};
        html += '<div class="opt-weights">';
        for (const [sym, w] of Object.entries(weights)) {
            html += '<span class="opt-weight-tag"><span class="wsym">' + sym + '</span> <span class="wval">' + w + '%</span></span>';
        }
        html += '</div>';

        if (method['绩效']) {
            const perf = method['绩效'];
            html += '<div class="opt-metrics">';
            html += '<span>年化收益: ' + (perf['组合年化收益率'] || 0).toFixed(2) + '%</span>';
            html += '<span>波动率: ' + (perf['组合年化波动率'] || 0).toFixed(2) + '%</span>';
            html += '<span>夏普: ' + (perf['组合夏普比率'] || 0).toFixed(2) + '</span>';
            html += '<span>最大回撤: ' + (perf['组合最大回撤'] || 0).toFixed(2) + '%</span>';
            html += '</div>';
        }

        html += '</div>';
    }
    html += '</div>';

    // 资金分配明细
    html += '<div class="opt-allocation"><h3>推荐方案资金分配明细</h3>';
    html += '<table class="opt-alloc-table"><thead><tr><th>股票代码</th><th>权重</th><th>金额</th><th>建议手数</th></tr></thead><tbody>';
    for (const [sym, alloc] of Object.entries(allocation)) {
        html += '<tr>';
        html += '<td>' + sym + '</td>';
        html += '<td>' + (alloc['权重'] || '') + '</td>';
        html += '<td>' + fmtMoney(alloc['金额']) + '</td>';
        html += '<td>' + (alloc['建议手数'] || 0) + '手</td>';
        html += '</tr>';
    }
    html += '</tbody></table></div>';

    container.innerHTML = html;
}

// ==================== 绩效归因 ====================

async function runAttribution() {
    const symbol = document.getElementById('attrSymbol').value.trim();
    const type = document.getElementById('attrType').value;

    if (!symbol || symbol.length !== 6) {
        alert('请输入6位股票代码');
        return;
    }

    const container = document.getElementById('attributionResult');
    container.innerHTML = '<div class="loading-spinner"></div>';

    let endpoint = '/api/attribution/' + type;
    const data = await apiPost(endpoint, { symbol: symbol, days: 250 });

    if (data.error) {
        container.innerHTML = '<div class="error-box">' + data.error + '</div>';
        return;
    }

    renderAttributionResult(data, type);
}

function renderAttributionResult(data, type) {
    const container = document.getElementById('attributionResult');
    let html = '';

    if (type === 'full') {
        // 收益分解
        const decomp = data['收益分解'] || {};
        if (decomp && !decomp.error) {
            html += '<div class="attr-section"><h3>收益分解</h3>';
            html += '<div class="attr-decomp-grid">';
            html += buildAttrItem('总收益率', decomp['总收益率'], '%');
            html += buildAttrItem('年化收益率', decomp['年化收益率'], '%');
            html += buildAttrItem('市场收益(Beta)', decomp['收益分解'] ? decomp['收益分解']['市场收益(Beta)'] : 0, '%');
            html += buildAttrItem('个股Alpha', decomp['收益分解'] ? decomp['收益分解']['个股Alpha'] : 0, '%');
            html += buildAttrItem('Beta系数', decomp['收益分解'] ? decomp['收益分解']['Beta系数'] : 0, '');
            html += buildAttrItem('信息比率', decomp['风险指标'] ? decomp['风险指标']['信息比率'] : 0, '');
            html += '</div>';
            if (decomp['解读']) {
                html += '<ul class="attr-insights">';
                decomp['解读'].forEach(function (s) { html += '<li>' + s + '</li>'; });
                html += '</ul>';
            }
            html += '</div>';
        }

        // Brinson归因
        const brinson = data['Brinson归因'] || {};
        if (brinson && !brinson.error) {
            html += '<div class="attr-section"><h3>Brinson归因</h3>';
            html += '<div class="attr-decomp-grid">';
            html += buildAttrItem('总超额收益', brinson['总超额收益'], '%');
            const bAttr = brinson['Brinson归因'] || {};
            html += buildAttrItem('配置效应', bAttr['配置效应'], '%');
            html += buildAttrItem('选择效应', bAttr['选择效应'], '%');
            html += buildAttrItem('交互效应', bAttr['交互效应'], '%');
            html += buildAttrItem('组合收益', brinson['参考数据'] ? brinson['参考数据']['组合收益'] : 0, '%');
            html += buildAttrItem('基准收益', brinson['参考数据'] ? brinson['参考数据']['基准收益'] : 0, '%');
            html += '</div></div>';
        }

        // 因子归因
        const factor = data['因子归因'] || {};
        if (factor && !factor.error) {
            html += '<div class="attr-section"><h3>因子归因</h3>';
            html += renderFactorBars(factor['因子贡献'] || {});
            if (factor['主导因子']) {
                html += '<div class="attr-dominant">' + factor['主导因子'] + '</div>';
            }
            html += '</div>';
        }
    } else if (type === 'decompose') {
        html += '<div class="attr-section"><h3>收益分解</h3>';
        html += '<div class="attr-decomp-grid">';
        html += buildAttrItem('总收益率', data['总收益率'], '%');
        html += buildAttrItem('年化收益率', data['年化收益率'], '%');
        html += buildAttrItem('市场收益(Beta)', data['收益分解'] ? data['收益分解']['市场收益(Beta)'] : 0, '%');
        html += buildAttrItem('个股Alpha', data['收益分解'] ? data['收益分解']['个股Alpha'] : 0, '%');
        html += buildAttrItem('Beta系数', data['收益分解'] ? data['收益分解']['Beta系数'] : 0, '');
        html += buildAttrItem('信息比率', data['风险指标'] ? data['风险指标']['信息比率'] : 0, '');
        html += '</div>';
        if (data['解读']) {
            html += '<ul class="attr-insights">';
            data['解读'].forEach(function (s) { html += '<li>' + s + '</li>'; });
            html += '</ul>';
        }
        html += '</div>';
    } else if (type === 'brinson') {
        html += '<div class="attr-section"><h3>Brinson归因</h3>';
        html += '<div class="attr-decomp-grid">';
        html += buildAttrItem('总超额收益', data['总超额收益'], '%');
        const bAttr = data['Brinson归因'] || {};
        html += buildAttrItem('配置效应', bAttr['配置效应'], '%');
        html += buildAttrItem('选择效应', bAttr['选择效应'], '%');
        html += buildAttrItem('交互效应', bAttr['交互效应'], '%');
        html += buildAttrItem('组合收益', data['参考数据'] ? data['参考数据']['组合收益'] : 0, '%');
        html += buildAttrItem('基准收益', data['参考数据'] ? data['参考数据']['基准收益'] : 0, '%');
        html += '</div></div>';
    } else if (type === 'factor') {
        html += '<div class="attr-section"><h3>因子归因</h3>';
        html += renderFactorBars(data['因子贡献'] || {});
        if (data['主导因子']) {
            html += '<div class="attr-dominant">' + data['主导因子'] + '</div>';
        }
        html += '</div>';
    }

    container.innerHTML = html;
}

function buildAttrItem(label, value, unit) {
    const numVal = parseFloat(value) || 0;
    let cls = '';
    if (numVal > 0) cls = 'positive';
    else if (numVal < 0) cls = 'negative';
    return '<div class="attr-decomp-item"><div class="attr-label">' + label + '</div><div class="attr-val ' + cls + '">' + numVal.toFixed(2) + unit + '</div></div>';
}

function renderFactorBars(contributions) {
    const maxAbs = Math.max.apply(null, Object.values(contributions).map(function (v) { return Math.abs(parseFloat(v) || 0); }).concat([1]));
    let html = '<div class="attr-factor-bars">';
    for (const [name, val] of Object.entries(contributions)) {
        const numVal = parseFloat(val) || 0;
        const pct = Math.min(100, Math.abs(numVal) / maxAbs * 100);
        const cls = numVal >= 0 ? 'positive' : 'negative';
        html += '<div class="attr-factor-bar">';
        html += '<span class="bar-label">' + name + '</span>';
        html += '<div class="bar-track"><div class="bar-fill ' + cls + '" style="width:' + pct + '%"></div></div>';
        html += '<span class="bar-val" style="color:' + (numVal >= 0 ? 'var(--red)' : 'var(--green)') + '">' + numVal.toFixed(2) + '%</span>';
        html += '</div>';
    }
    html += '</div>';
    return html;
}

// ==================== 实时监控 ====================

let currentMonitorTab = 'anomaly';

function switchMonitorTab(tab) {
    currentMonitorTab = tab;
    document.querySelectorAll('.monitor-tab').forEach(function (t) { t.classList.remove('active'); });
    document.querySelectorAll('.monitor-tab-content').forEach(function (c) { c.classList.remove('active'); });
    document.querySelector('.monitor-tab[onclick="switchMonitorTab(\'' + tab + '\')"]').classList.add('active');
    document.getElementById('monitorTab-' + tab).classList.add('active');
}

async function runAnomalyCheck() {
    const symbol = document.getElementById('monSymbol').value.trim();

    if (!symbol || symbol.length !== 6) {
        alert('请输入6位股票代码');
        return;
    }

    const container = document.getElementById('anomalyResult');
    container.innerHTML = '<div class="loading-spinner"></div>';

    const data = await apiPost('/api/monitor/anomaly', { symbol: symbol });

    if (data.error) {
        container.innerHTML = '<div class="error-box">' + data.error + '</div>';
        return;
    }

    renderAnomalyResult(data);
}

function renderAnomalyResult(data) {
    const container = document.getElementById('anomalyResult');
    const riskLevel = data['风险等级'] || '正常';
    const alerts = data['告警列表'] || [];
    const rtData = data['实时数据'] || {};

    let riskCls = 'normal';
    if (riskLevel === '高风险' || riskLevel === '较高风险') riskCls = 'warning';
    else if (riskLevel === '关注' || riskLevel === '留意') riskCls = 'attention';

    let html = '';

    // 风险等级
    html += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">';
    html += '<span class="anomaly-risk-badge ' + riskCls + '">风险等级: ' + riskLevel + '</span>';
    html += '<span style="font-size:13px;color:var(--text-muted);">' + data['股票名称'] + ' | 当前价: ' + fmtPrice(data['当前价']) + ' | 涨跌幅: <span style="color:' + ((data['涨跌幅'] || 0) >= 0 ? 'var(--red)' : 'var(--green)') + ';font-weight:600;">' + ((data['涨跌幅'] || 0) >= 0 ? '+' : '') + (data['涨跌幅'] || 0).toFixed(2) + '%</span></span>';
    html += '</div>';

    // 实时数据
    html += '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px;font-size:12px;color:var(--text-muted);">';
    html += '<span>今开: ' + fmtPrice(rtData['今开']) + '</span>';
    html += '<span>最高: ' + fmtPrice(rtData['最高']) + '</span>';
    html += '<span>最低: ' + fmtPrice(rtData['最低']) + '</span>';
    html += '<span>昨收: ' + fmtPrice(rtData['昨收']) + '</span>';
    html += '<span>振幅: ' + (rtData['振幅'] || 0).toFixed(2) + '%</span>';
    html += '<span>换手率: ' + (rtData['换手率'] || 0).toFixed(2) + '%</span>';
    html += '<span>量比: ' + (rtData['量比'] || 0).toFixed(2) + '</span>';
    html += '<span>成交额: ' + (rtData['成交额(亿)'] || 0).toFixed(2) + '亿</span>';
    html += '</div>';

    // 告警列表
    if (alerts.length === 0) {
        html += '<div style="padding:20px;text-align:center;color:var(--text-muted);">未检测到异常，股票运行正常</div>';
    } else {
        html += '<div class="anomaly-alert-list">';
        alerts.forEach(function (a) {
            let levelCls = 'level-info';
            let icon = 'i';
            if (a['级别'] === '警告') { levelCls = 'level-warning'; icon = '!'; }
            else if (a['级别'] === '关注') { levelCls = 'level-attention'; icon = '?'; }

            html += '<div class="anomaly-alert ' + levelCls + '">';
            html += '<span class="alert-icon">' + icon + '</span>';
            html += '<div class="alert-body">';
            html += '<div class="alert-type">[' + a['级别'] + '] ' + (a['类型'] || '') + '</div>';
            html += '<div class="alert-desc">' + (a['描述'] || '') + '</div>';
            if (a['建议']) {
                html += '<div class="alert-advice">建议: ' + a['建议'] + '</div>';
            }
            html += '</div></div>';
        });
        html += '</div>';
    }

    container.innerHTML = html;
}

async function runPnlCalc() {
    const container = document.getElementById('pnlResult');
    container.innerHTML = '<div class="loading-spinner"></div>';

    // 从持仓数据获取
    let positions = [];
    try {
        const portfolioData = await apiGet('/api/portfolio/list');
        if (!portfolioData.error && Array.isArray(portfolioData)) {
            positions = portfolioData.map(function (p) {
                return {
                    symbol: p['股票代码'] || p['symbol'] || '',
                    cost_price: parseFloat(p['成本价'] || p['cost_price'] || 0),
                    quantity: parseInt(p['数量'] || p['quantity'] || 0),
                    buy_date: p['购买日期'] || p['buy_date'] || ''
                };
            });
        }
    } catch (e) {
        // 忽略
    }

    if (positions.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>暂无持仓数据，请先在"仓位管理"中添加持仓</p></div>';
        return;
    }

    const data = await apiPost('/api/monitor/pnl', { positions: positions });

    if (data.error) {
        container.innerHTML = '<div class="error-box">' + data.error + '</div>';
        return;
    }

    renderPnlResult(data);
}

function renderPnlResult(data) {
    const container = document.getElementById('pnlResult');
    const summary = data['汇总'] || {};
    const details = data['持仓明细'] || [];

    let html = '';

    // 汇总
    html += '<div class="pnl-summary">';
    html += buildPnlCard('总成本', summary['总成本'], true);
    html += buildPnlCard('总市值', summary['总市值'], true);
    html += buildPnlCard('总盈亏', summary['总盈亏'], false);
    html += buildPnlCard('总盈亏比例', summary['总盈亏比例'], false, '%');
    html += '</div>';

    html += '<div style="display:flex;gap:16px;margin-bottom:16px;font-size:13px;color:var(--text-muted);">';
    html += '<span>盈利: ' + (summary['盈利股票数'] || 0) + '只</span>';
    html += '<span>亏损: ' + (summary['亏损股票数'] || 0) + '只</span>';
    html += '<span>计算时间: ' + (data['计算时间'] || '') + '</span>';
    html += '</div>';

    // 明细
    html += '<table class="pnl-table"><thead><tr>';
    html += '<th>代码</th><th>名称</th><th>成本价</th><th>现价</th><th>数量</th><th>成本总额</th><th>当前市值</th><th>盈亏金额</th><th>盈亏比例</th><th>今日涨跌</th><th>持有天数</th>';
    html += '</tr></thead><tbody>';
    details.forEach(function (d) {
        html += '<tr>';
        html += '<td>' + (d['代码'] || '') + '</td>';
        html += '<td>' + (d['名称'] || '') + '</td>';
        html += '<td>' + fmtPrice(d['成本价']) + '</td>';
        html += '<td>' + fmtPrice(d['现价']) + '</td>';
        html += '<td>' + (d['数量'] || 0) + '</td>';
        html += '<td>' + fmtMoney(d['成本总额']) + '</td>';
        html += '<td>' + fmtMoney(d['当前市值']) + '</td>';
        html += '<td style="color:' + ((d['盈亏金额'] || 0) >= 0 ? 'var(--red)' : 'var(--green)') + ';font-weight:600;">' + fmtMoney(d['盈亏金额']) + '</td>';
        html += '<td style="color:' + ((d['盈亏比例'] || 0) >= 0 ? 'var(--red)' : 'var(--green)') + ';font-weight:600;">' + (d['盈亏比例'] >= 0 ? '+' : '') + (d['盈亏比例'] || 0).toFixed(2) + '%</td>';
        html += '<td style="color:' + ((d['今日涨跌'] || 0) >= 0 ? 'var(--red)' : 'var(--green)') + ';">' + (d['今日涨跌'] >= 0 ? '+' : '') + (d['今日涨跌'] || 0).toFixed(2) + '%</td>';
        html += '<td>' + (d['持有天数'] || '--') + '天</td>';
        html += '</tr>';
    });
    html += '</tbody></table>';

    container.innerHTML = html;
}

function buildPnlCard(label, value, isMoney, unit) {
    unit = unit || '';
    const numVal = parseFloat(value) || 0;
    let cls = '';
    if (label.indexOf('盈亏') >= 0) {
        cls = numVal >= 0 ? 'positive' : 'negative';
    }
    const display = isMoney ? fmtMoney(value) : (numVal.toFixed(2) + unit);
    return '<div class="pnl-summary-card"><div class="ps-label">' + label + '</div><div class="ps-val ' + cls + '">' + display + '</div></div>';
}

async function runMarketOverview() {
    const container = document.getElementById('marketOverviewResult');
    container.innerHTML = '<div class="loading-spinner"></div>';

    const data = await apiGet('/api/monitor/market');

    if (data.error) {
        container.innerHTML = '<div class="error-box">' + data.error + '</div>';
        return;
    }

    renderMarketOverview(data);
}

function renderMarketOverview(data) {
    const container = document.getElementById('marketOverviewResult');
    const indices = data['主要指数'] || {};
    const stats = data['市场统计'] || {};

    let html = '';

    // 指数
    html += '<div class="market-overview-grid">';
    for (const [name, info] of Object.entries(indices)) {
        const change = info['涨跌幅'] || 0;
        html += '<div class="market-idx-card">';
        html += '<div class="idx-name">' + name + '</div>';
        html += '<div class="idx-price">' + fmtPrice(info['最新']) + '</div>';
        html += '<div class="idx-change ' + (change >= 0 ? 'up' : 'down') + '">' + (change >= 0 ? '+' : '') + change.toFixed(2) + '%</div>';
        html += '</div>';
    }
    html += '</div>';

    // 市场统计
    html += '<div class="market-stats-grid">';
    html += '<div class="market-stat-item"><div class="stat-num" style="color:var(--red);">' + (stats['上涨家数'] || 0) + '</div><div class="stat-lbl">上涨家数</div></div>';
    html += '<div class="market-stat-item"><div class="stat-num" style="color:var(--green);">' + (stats['下跌家数'] || 0) + '</div><div class="stat-lbl">下跌家数</div></div>';
    html += '<div class="market-stat-item"><div class="stat-num">' + (stats['平盘家数'] || 0) + '</div><div class="stat-lbl">平盘家数</div></div>';
    html += '<div class="market-stat-item"><div class="stat-num" style="color:var(--red);">' + (stats['涨停家数'] || 0) + '</div><div class="stat-lbl">涨停家数</div></div>';
    html += '<div class="market-stat-item"><div class="stat-num" style="color:var(--green);">' + (stats['跌停家数'] || 0) + '</div><div class="stat-lbl">跌停家数</div></div>';
    html += '<div class="market-stat-item"><div class="stat-num">' + (stats['上涨比例'] || 0).toFixed(1) + '%</div><div class="stat-lbl">上涨比例</div></div>';
    html += '</div>';

    html += '<div style="margin-top:12px;font-size:12px;color:var(--text-muted);">数据时间: ' + (data['时间'] || '') + '</div>';

    container.innerHTML = html;
}

// ==================== AI 助手 ====================

let aiCurrentMode = 'chat';
let aiLastBacktestResult = null;
let aiLastStrategyId = null;

function switchAiMode(mode) {
    aiCurrentMode = mode;
    document.querySelectorAll('.ai-mode-btn').forEach(function (btn) {
        btn.classList.remove('active');
        if (btn.getAttribute('data-mode') === mode) {
            btn.classList.add('active');
        }
    });

    var input = document.getElementById('aiInput');
    var chatInput = document.getElementById('aiChatInput');
    var chatMessages = document.getElementById('aiChatMessages');
    var recommendPanel = document.getElementById('aiRecommendPanel');
    var recommendAssistPanel = document.getElementById('aiRecommendAssistPanel');

    // 隐藏所有面板
    chatMessages.style.display = 'none';
    chatInput.style.display = 'none';
    recommendPanel.style.display = 'none';
    recommendAssistPanel.style.display = 'none';

    if (mode === 'recommend') {
        recommendPanel.style.display = 'block';
    } else if (mode === 'recommend_assist') {
        recommendAssistPanel.style.display = 'flex';
    } else {
        chatMessages.style.display = '';
        chatInput.style.display = '';

        var placeholders = {
            'chat': '输入你的问题，如：帮我写一个5日均线上穿20日均线且放量的策略...',
            'strategy': '描述你的交易策略，如：5日均线上穿20日均线且放量1.5倍时买入...',
            'interpret': '请先执行回测，然后在此输入"帮我分析回测结果"...',
            'diagnose': '请先执行回测，然后在此输入"我的策略回撤很大，帮我诊断原因"...'
        };
        input.placeholder = placeholders[mode] || placeholders['chat'];
        input.focus();
    }
}

function handleAiInputKey(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendAiMessage();
    }
}

function sendAiSuggestion(text) {
    document.getElementById('aiInput').value = text;
    sendAiMessage();
}

async function sendAiMessage() {
    var input = document.getElementById('aiInput');
    var message = input.value.trim();
    if (!message) return;

    input.value = '';
    input.style.height = 'auto';

    var messagesContainer = document.getElementById('aiChatMessages');

    // 移除欢迎界面
    var welcome = messagesContainer.querySelector('.ai-welcome');
    if (welcome) welcome.remove();

    // 添加用户消息
    addAiMessage('user', message);

    // 添加加载指示器
    var loadingId = addAiLoading();

    // 构建上下文
    var context = null;
    if (aiLastBacktestResult) {
        context = {
            backtest: aiLastBacktestResult,
            strategy_id: aiLastStrategyId || 'unknown'
        };
    }

    // 调用 API
    var data = await apiPost('/api/ai/chat', {
        message: message,
        context: context
    });

    // 移除加载指示器
    removeAiLoading(loadingId);

    if (data.error) {
        addAiMessage('assistant', '抱歉，处理出错：' + data.error);
        return;
    }

    // 添加助手回复
    var reply = data['回复'] || '收到你的消息，但我暂时无法处理。';
    addAiMessage('assistant', reply, data['数据']);

    // 如果有策略代码，显示代码块
    if (data['数据'] && data['数据']['策略代码']) {
        addAiCodeBlock(data['数据']['策略代码'], 'python', '策略代码');
    }
    if (data['数据'] && data['数据']['回测代码']) {
        addAiCodeBlock(data['数据']['回测代码'], 'python', '回测代码');
    }
}

function addAiMessage(role, text, data) {
    var container = document.getElementById('aiChatMessages');
    var div = document.createElement('div');
    div.className = 'ai-message ' + role;

    var avatar = document.createElement('div');
    avatar.className = 'ai-message-avatar';
    avatar.textContent = role === 'user' ? 'U' : 'AI';

    var content = document.createElement('div');
    content.className = 'ai-message-content';
    content.textContent = text;

    div.appendChild(avatar);
    div.appendChild(content);
    container.appendChild(div);

    container.scrollTop = container.scrollHeight;
}

function addAiCodeBlock(code, lang, title) {
    var container = document.getElementById('aiChatMessages');
    var div = document.createElement('div');
    div.className = 'ai-message assistant';

    var avatar = document.createElement('div');
    avatar.className = 'ai-message-avatar';
    avatar.textContent = 'AI';

    var content = document.createElement('div');
    content.className = 'ai-message-content';

    var codeBlock = document.createElement('div');
    codeBlock.className = 'code-block';

    var header = document.createElement('div');
    header.className = 'code-header';

    var langSpan = document.createElement('span');
    langSpan.className = 'code-lang';
    langSpan.textContent = title + ' (' + lang + ')';

    var copyBtn = document.createElement('button');
    copyBtn.className = 'code-copy';
    copyBtn.textContent = '复制代码';
    copyBtn.onclick = function () {
        navigator.clipboard.writeText(code).then(function () {
            copyBtn.textContent = '已复制!';
            setTimeout(function () { copyBtn.textContent = '复制代码'; }, 2000);
        });
    };

    header.appendChild(langSpan);
    header.appendChild(copyBtn);

    var codeContent = document.createElement('pre');
    codeContent.textContent = code;

    codeBlock.appendChild(header);
    codeBlock.appendChild(codeContent);
    content.appendChild(codeBlock);

    div.appendChild(avatar);
    div.appendChild(content);
    container.appendChild(div);

    container.scrollTop = container.scrollHeight;
}

function addAiLoading() {
    var container = document.getElementById('aiChatMessages');
    var id = 'ai-loading-' + Date.now();

    var div = document.createElement('div');
    div.className = 'ai-message assistant';
    div.id = id;

    var avatar = document.createElement('div');
    avatar.className = 'ai-message-avatar';
    avatar.textContent = 'AI';

    var content = document.createElement('div');
    content.className = 'ai-message-content';

    var indicator = document.createElement('div');
    indicator.className = 'ai-typing-indicator';
    indicator.innerHTML = '<span></span><span></span><span></span>';

    content.appendChild(indicator);
    div.appendChild(avatar);
    div.appendChild(content);
    container.appendChild(div);

    container.scrollTop = container.scrollHeight;
    return id;
}

function removeAiLoading(id) {
    var el = document.getElementById(id);
    if (el) el.remove();
}

// ==================== AI 配置管理 ====================

async function loadAiConfig() {
    var data = await apiGet('/api/ai/config');
    if (data.error) return;

    document.getElementById('aiApiBase').value = data.api_base || '';
    document.getElementById('aiApiKey').value = data.api_key || '';
    document.getElementById('aiModel').value = data.model || '';
    document.getElementById('aiEnabled').checked = data.enabled || false;

    updateAiConfigStatus(data);
}

function updateAiConfigStatus(config) {
    var statusEl = document.getElementById('aiConfigStatus');
    if (config.enabled && config.api_key) {
        statusEl.innerHTML = '<span class="status-dot online"></span><span>已启用</span>';
    } else {
        statusEl.innerHTML = '<span class="status-dot offline"></span><span>未启用</span>';
    }
}

function toggleAiConfig() {
    var form = document.getElementById('aiConfigForm');
    if (form.style.display === 'none') {
        form.style.display = 'flex';
        loadAiConfig();
    } else {
        form.style.display = 'none';
    }
}

async function saveAiConfig() {
    var config = {
        api_base: document.getElementById('aiApiBase').value.trim(),
        api_key: document.getElementById('aiApiKey').value.trim(),
        model: document.getElementById('aiModel').value.trim(),
        enabled: document.getElementById('aiEnabled').checked
    };

    var data = await apiPost('/api/ai/config', config);
    if (data.error) {
        alert('保存失败: ' + data.error);
        return;
    }

    updateAiConfigStatus(config);
    alert('配置已保存');
}

async function testAiConnection() {
    var saveBtn = document.querySelector('.ai-config-form .btn-primary');
    var testBtn = document.querySelector('.ai-config-form .btn-secondary');
    var origText = testBtn.textContent;
    testBtn.textContent = '测试中...';
    testBtn.disabled = true;

    var data = await apiPost('/api/ai/test', {});

    testBtn.textContent = origText;
    testBtn.disabled = false;

    if (data.status === 'ok') {
        alert('连接成功！\n' + data.message);
    } else if (data.status === 'disabled') {
        alert('AI 功能未启用，请先勾选"启用 AI"并保存配置');
    } else if (data.status === 'no_key') {
        alert('请先填写 API Key');
    } else {
        alert('连接失败: ' + data.message);
    }
}

// 存储回测结果供 AI 解读
function setAiBacktestContext(result, strategyId) {
    aiLastBacktestResult = result;
    aiLastStrategyId = strategyId;
}

// ==================== K线图表 ====================

var klineData = null;
var klineCanvas = null;
var klineCtx = null;
var klinePadding = { top: 20, right: 60, bottom: 30, left: 60 };
var klineMouseX = -1;
var klineVisibleStart = 0;
var klineVisibleEnd = 1;
var klineIsDragging = false;
var klineDragStartX = 0;
var klineDragStartVisibleStart = 0;

function loadKlineChart() {
    var symbol = document.getElementById('klineSymbol').value.trim();
    var periodVal = document.getElementById('klinePeriod').value;

    if (!symbol || symbol.length !== 6) {
        alert('请输入6位股票代码');
        return;
    }

    var payload = { symbol: symbol };

    if (periodVal === 'custom') {
        var startDate = document.getElementById('klineStartDate').value;
        var endDate = document.getElementById('klineEndDate').value;
        if (!startDate || !endDate) {
            alert('请选择开始日期和结束日期');
            return;
        }
        payload.start_date = startDate;
        payload.end_date = endDate;
    } else {
        payload.days = parseInt(periodVal);
    }

    apiPost('/api/indicator/kline', payload).then(function (data) {
        if (data.error) {
            alert(data.error);
            return;
        }
        klineData = data;
        klineVisibleStart = 0;
        klineVisibleEnd = data.data.length;
        renderKlineChart();
    });
}

function getVisibleData() {
    if (!klineData || !klineData.data) return [];
    var start = Math.max(0, Math.floor(klineVisibleStart));
    var end = Math.min(klineData.data.length, Math.ceil(klineVisibleEnd));
    if (end <= start) end = start + 1;
    return klineData.data.slice(start, end);
}

function klineZoomIn() {
    if (!klineData || !klineData.data) return;
    var center = (klineVisibleStart + klineVisibleEnd) / 2;
    var range = klineVisibleEnd - klineVisibleStart;
    var newRange = Math.max(10, range * 0.6);
    klineVisibleStart = center - newRange / 2;
    klineVisibleEnd = center + newRange / 2;
    clampVisibleRange();
    renderKlineChart();
}

function klineZoomOut() {
    if (!klineData || !klineData.data) return;
    var center = (klineVisibleStart + klineVisibleEnd) / 2;
    var range = klineVisibleEnd - klineVisibleStart;
    var newRange = Math.min(klineData.data.length, range * 1.6);
    klineVisibleStart = center - newRange / 2;
    klineVisibleEnd = center + newRange / 2;
    clampVisibleRange();
    renderKlineChart();
}

function klineZoomReset() {
    if (!klineData || !klineData.data) return;
    klineVisibleStart = 0;
    klineVisibleEnd = klineData.data.length;
    renderKlineChart();
}

function clampVisibleRange() {
    if (!klineData || !klineData.data) return;
    var total = klineData.data.length;
    if (klineVisibleStart < 0) {
        klineVisibleEnd -= klineVisibleStart;
        klineVisibleStart = 0;
    }
    if (klineVisibleEnd > total) {
        klineVisibleStart -= (klineVisibleEnd - total);
        klineVisibleEnd = total;
    }
    if (klineVisibleStart < 0) klineVisibleStart = 0;
    if (klineVisibleEnd - klineVisibleStart < 5) {
        var center = (klineVisibleStart + klineVisibleEnd) / 2;
        klineVisibleStart = Math.max(0, center - 3);
        klineVisibleEnd = Math.min(total, center + 3);
    }
}

function renderKlineChart() {
    if (!klineData || !klineData.data || klineData.data.length === 0) return;

    klineCanvas = document.getElementById('klineCanvas');
    klineCtx = klineCanvas.getContext('2d');

    var container = klineCanvas.parentElement;
    var containerWidth = container.clientWidth;
    var dpr = window.devicePixelRatio || 1;

    var chartHeight = 420;
    var volumeHeight = 100;
    var totalHeight = chartHeight + volumeHeight + 40;

    klineCanvas.width = containerWidth * dpr;
    klineCanvas.height = totalHeight * dpr;
    klineCanvas.style.width = containerWidth + 'px';
    klineCanvas.style.height = totalHeight + 'px';
    klineCtx.scale(dpr, dpr);

    var w = containerWidth;
    var h = totalHeight;

    klineCtx.clearRect(0, 0, w, h);

    var visibleData = getVisibleData();
    if (visibleData.length === 0) return;

    var fullData = klineData.data;
    var showMA = document.getElementById('klineShowMA').checked;
    var showBoll = document.getElementById('klineShowBoll').checked;
    var showVolume = document.getElementById('klineShowVolume').checked;

    var startIdx = Math.max(0, Math.floor(klineVisibleStart));
    var endIdx = Math.min(fullData.length, Math.ceil(klineVisibleEnd));

    // 计算可见范围的价格范围
    var allPrices = [];
    visibleData.forEach(function (d) {
        allPrices.push(d.high, d.low);
    });
    if (showBoll && klineData.bollinger) {
        for (var bi = startIdx; bi < endIdx && bi < klineData.bollinger.length; bi++) {
            var b = klineData.bollinger[bi];
            if (b.upper) allPrices.push(b.upper);
            if (b.lower) allPrices.push(b.lower);
        }
    }
    var priceMin = Math.min.apply(null, allPrices);
    var priceMax = Math.max.apply(null, allPrices);
    var priceRange = priceMax - priceMin;
    priceMin -= priceRange * 0.05;
    priceMax += priceRange * 0.05;

    // 计算成交量范围
    var volumes = visibleData.map(function (d) { return d.amount || d.volume; });
    var volMax = Math.max.apply(null, volumes);

    var visibleCount = visibleData.length;
    var candleWidth = Math.max(1, (w - klinePadding.left - klinePadding.right) / visibleCount * 0.7);
    var candleGap = (w - klinePadding.left - klinePadding.right) / visibleCount;

    function x(i) { return klinePadding.left + i * candleGap + candleGap / 2; }
    function yPrice(p) { return klinePadding.top + (1 - (p - priceMin) / (priceMax - priceMin)) * (chartHeight - klinePadding.top - klinePadding.bottom); }
    function yVol(v) { return chartHeight + 30 + (1 - v / volMax) * (volumeHeight - 10); }

    // 绘制网格
    klineCtx.strokeStyle = '#2a2d3a';
    klineCtx.lineWidth = 0.5;
    var gridLines = 5;
    for (var i = 0; i <= gridLines; i++) {
        var gy = klinePadding.top + (chartHeight - klinePadding.top - klinePadding.bottom) * i / gridLines;
        klineCtx.beginPath();
        klineCtx.moveTo(klinePadding.left, gy);
        klineCtx.lineTo(w - klinePadding.right, gy);
        klineCtx.stroke();

        var priceLabel = priceMax - (priceMax - priceMin) * i / gridLines;
        klineCtx.fillStyle = '#6b7280';
        klineCtx.font = '11px sans-serif';
        klineCtx.textAlign = 'right';
        klineCtx.fillText(priceLabel.toFixed(2), klinePadding.left - 6, gy + 4);
    }

    // 绘制日期标签
    klineCtx.textAlign = 'center';
    var dateStep = Math.max(1, Math.floor(visibleCount / 6));
    for (var i = 0; i < visibleCount; i += dateStep) {
        var dx = x(i);
        klineCtx.fillText(visibleData[i].date.substring(5), dx, chartHeight - klinePadding.bottom + 16);
    }
    if (visibleCount > 0) {
        var lastDx = x(visibleCount - 1);
        klineCtx.fillText(visibleData[visibleCount - 1].date.substring(5), lastDx, chartHeight - klinePadding.bottom + 16);
    }

    // 绘制布林带
    if (showBoll && klineData.bollinger) {
        klineCtx.strokeStyle = 'rgba(156, 39, 176, 0.4)';
        klineCtx.lineWidth = 1;
        klineCtx.setLineDash([4, 4]);
        ['upper', 'lower'].forEach(function (band) {
            klineCtx.beginPath();
            var started = false;
            for (var i = 0; i < visibleCount; i++) {
                var bi = startIdx + i;
                if (bi < klineData.bollinger.length) {
                    var b = klineData.bollinger[bi];
                    if (b[band]) {
                        var bx = x(i);
                        var by = yPrice(b[band]);
                        if (!started) { klineCtx.moveTo(bx, by); started = true; }
                        else { klineCtx.lineTo(bx, by); }
                    }
                }
            }
            klineCtx.stroke();
        });
        klineCtx.setLineDash([]);

        // 布林带中轨
        if (klineData.bollinger.length > 0 && klineData.bollinger[0].mid) {
            klineCtx.strokeStyle = '#9c27b0';
            klineCtx.lineWidth = 1;
            klineCtx.beginPath();
            for (var i = 0; i < visibleCount; i++) {
                var bi = startIdx + i;
                if (bi < klineData.bollinger.length && klineData.bollinger[bi].mid) {
                    var bx = x(i);
                    var by = yPrice(klineData.bollinger[bi].mid);
                    if (i === 0) klineCtx.moveTo(bx, by);
                    else klineCtx.lineTo(bx, by);
                }
            }
            klineCtx.stroke();
        }
    }

    // 绘制均线
    if (showMA && klineData.ma) {
        var maColors = { ma5: '#f59e0b', ma10: '#3b82f6', ma20: '#ef5350', ma60: '#26a69a' };
        Object.keys(klineData.ma).forEach(function (key) {
            var maData = klineData.ma[key];
            if (!maData || maData.length === 0) return;
            klineCtx.strokeStyle = maColors[key] || '#888';
            klineCtx.lineWidth = 1;
            klineCtx.beginPath();
            var started = false;
            for (var i = 0; i < visibleCount; i++) {
                var bi = startIdx + i;
                if (bi < maData.length && maData[bi] != null) {
                    var mx = x(i);
                    var my = yPrice(maData[bi]);
                    if (!started) { klineCtx.moveTo(mx, my); started = true; }
                    else { klineCtx.lineTo(mx, my); }
                }
            }
            klineCtx.stroke();
        });
    }

    // 绘制K线
    visibleData.forEach(function (d, i) {
        var cx = x(i);
        var openY = yPrice(d.open);
        var closeY = yPrice(d.close);
        var highY = yPrice(d.high);
        var lowY = yPrice(d.low);

        var isUp = d.close >= d.open;
        var color = isUp ? '#ef5350' : '#26a69a';
        var bodyColor = isUp ? '#ef5350' : 'transparent';

        // 影线
        klineCtx.strokeStyle = color;
        klineCtx.lineWidth = 1;
        klineCtx.beginPath();
        klineCtx.moveTo(cx, highY);
        klineCtx.lineTo(cx, lowY);
        klineCtx.stroke();

        // 实体
        var bodyTop = isUp ? closeY : openY;
        var bodyBottom = isUp ? openY : closeY;
        var bodyHeight = Math.max(1, bodyBottom - bodyTop);

        if (isUp) {
            klineCtx.fillStyle = bodyColor;
            klineCtx.fillRect(cx - candleWidth / 2, bodyTop, candleWidth, bodyHeight);
        }
        klineCtx.strokeStyle = color;
        klineCtx.lineWidth = 1;
        klineCtx.strokeRect(cx - candleWidth / 2, bodyTop, candleWidth, bodyHeight);
    });

    // 绘制成交量
    if (showVolume) {
        var volLabelY = chartHeight + 18;
        klineCtx.fillStyle = '#6b7280';
        klineCtx.font = '11px sans-serif';
        klineCtx.textAlign = 'right';
        klineCtx.fillText('成交量', klinePadding.left - 6, volLabelY);

        visibleData.forEach(function (d, i) {
            var cx = x(i);
            var vol = d.amount || d.volume;
            var vh = (vol / volMax) * (volumeHeight - 10);
            var vy = chartHeight + 30 + (volumeHeight - 10) - vh;

            var isUp = d.close >= d.open;
            klineCtx.fillStyle = isUp ? 'rgba(239, 83, 80, 0.5)' : 'rgba(38, 166, 154, 0.5)';
            klineCtx.fillRect(cx - candleWidth / 2, vy, candleWidth, vh);
        });
    }

    // 鼠标十字线
    if (klineMouseX >= 0) {
        klineCtx.strokeStyle = 'rgba(255,255,255,0.3)';
        klineCtx.lineWidth = 0.5;
        klineCtx.setLineDash([4, 4]);
        klineCtx.beginPath();
        klineCtx.moveTo(klineMouseX, klinePadding.top);
        klineCtx.lineTo(klineMouseX, totalHeight - 5);
        klineCtx.stroke();
        klineCtx.setLineDash([]);
    }

    // 图例
    updateKlineLegend(showMA, showBoll);
}

function updateKlineLegend(showMA, showBoll) {
    var legend = document.getElementById('klineLegend');
    var items = [
        { color: '#ef5350', label: '阳线(上涨)' },
        { color: '#26a69a', label: '阴线(下跌)' }
    ];
    if (showMA) {
        items.push({ color: '#f59e0b', label: 'MA5' });
        items.push({ color: '#3b82f6', label: 'MA10' });
        items.push({ color: '#ef5350', label: 'MA20' });
        items.push({ color: '#26a69a', label: 'MA60' });
    }
    if (showBoll) {
        items.push({ color: '#9c27b0', label: '布林带' });
    }

    legend.innerHTML = items.map(function (item) {
        return '<div class="kline-legend-item"><span class="kline-legend-dot" style="background:' + item.color + '"></span>' + item.label + '</div>';
    }).join('');
}

// 鼠标交互
document.addEventListener('DOMContentLoaded', function () {
    var canvas = document.getElementById('klineCanvas');
    if (!canvas) return;

    canvas.addEventListener('mousemove', function (e) {
        if (!klineData) return;
        var rect = canvas.getBoundingClientRect();
        var mx = e.clientX - rect.left;

        if (klineIsDragging) {
            var dx = mx - klineDragStartX;
            var w = canvas.parentElement.clientWidth;
            var visibleCount = klineVisibleEnd - klineVisibleStart;
            var candleGap = (w - klinePadding.left - klinePadding.right) / visibleCount;
            var shiftCount = -dx / candleGap;
            klineVisibleStart = klineDragStartVisibleStart + shiftCount;
            klineVisibleEnd = klineVisibleStart + visibleCount;
            clampVisibleRange();
            renderKlineChart();
            return;
        }

        klineMouseX = mx;
        renderKlineChart();
        updateKlineTooltip(mx, e.clientY - rect.top);
    });

    canvas.addEventListener('mousedown', function (e) {
        if (!klineData) return;
        klineIsDragging = true;
        klineDragStartX = e.clientX - canvas.getBoundingClientRect().left;
        klineDragStartVisibleStart = klineVisibleStart;
        canvas.style.cursor = 'grabbing';
    });

    canvas.addEventListener('mouseup', function () {
        klineIsDragging = false;
        if (klineCanvas) klineCanvas.style.cursor = 'crosshair';
    });

    canvas.addEventListener('mouseleave', function () {
        klineIsDragging = false;
        klineMouseX = -1;
        if (klineData) renderKlineChart();
        document.getElementById('klineTooltip').style.display = 'none';
        if (klineCanvas) klineCanvas.style.cursor = 'crosshair';
    });

    canvas.addEventListener('wheel', function (e) {
        if (!klineData || !klineData.data) return;
        e.preventDefault();

        var rect = canvas.getBoundingClientRect();
        var mx = e.clientX - rect.left;
        var w = canvas.parentElement.clientWidth;
        var visibleCount = klineVisibleEnd - klineVisibleStart;
        var candleGap = (w - klinePadding.left - klinePadding.right) / visibleCount;

        // 计算鼠标位置对应的数据索引
        var mouseIdx = klineVisibleStart + (mx - klinePadding.left) / candleGap;

        var zoomFactor = e.deltaY < 0 ? 0.75 : 1.35;
        var newRange = Math.max(5, Math.min(klineData.data.length, visibleCount * zoomFactor));

        // 以鼠标位置为中心缩放
        var ratio = (mouseIdx - klineVisibleStart) / visibleCount;
        klineVisibleStart = mouseIdx - newRange * ratio;
        klineVisibleEnd = klineVisibleStart + newRange;
        clampVisibleRange();
        renderKlineChart();
    }, { passive: false });

    var klinePeriodSel = document.getElementById('klinePeriod');
    if (klinePeriodSel) {
        klinePeriodSel.addEventListener('change', function () {
            var customRange = document.getElementById('klineCustomRange');
            if (customRange) {
                customRange.style.display = this.value === 'custom' ? 'inline' : 'none';
            }
        });
    }
});

function updateKlineTooltip(mx, my) {
    if (!klineData || !klineData.data) return;
    var fullData = klineData.data;
    var w = klineCanvas.parentElement.clientWidth;
    var visibleCount = klineVisibleEnd - klineVisibleStart;
    var candleGap = (w - klinePadding.left - klinePadding.right) / visibleCount;
    var visibleIdx = Math.floor((mx - klinePadding.left) / candleGap);
    var idx = Math.max(0, Math.floor(klineVisibleStart)) + visibleIdx;
    if (visibleIdx < 0 || idx >= fullData.length) {
        document.getElementById('klineTooltip').style.display = 'none';
        return;
    }

    var d = fullData[idx];
    var isUp = d.close >= d.open;
    var changePct = fullData.length > 1 && idx > 0 ? ((d.close - fullData[idx - 1].close) / fullData[idx - 1].close * 100) : 0;
    var changeClass = changePct >= 0 ? 'tt-up' : 'tt-down';
    var changeSign = changePct >= 0 ? '+' : '';

    var html = '<div class="tt-date">' + d.date + '</div>';
    html += '<div class="tt-row"><span class="tt-label">开盘</span><span>' + d.open.toFixed(2) + '</span></div>';
    html += '<div class="tt-row"><span class="tt-label">最高</span><span>' + d.high.toFixed(2) + '</span></div>';
    html += '<div class="tt-row"><span class="tt-label">最低</span><span>' + d.low.toFixed(2) + '</span></div>';
    html += '<div class="tt-row"><span class="tt-label">收盘</span><span class="' + changeClass + '">' + d.close.toFixed(2) + '</span></div>';
    html += '<div class="tt-row"><span class="tt-label">涨跌</span><span class="' + changeClass + '">' + changeSign + changePct.toFixed(2) + '%</span></div>';
    html += '<div class="tt-row"><span class="tt-label">成交额</span><span>' + (d.amount ? (d.amount / 100000000).toFixed(2) + '亿' : '-') + '</span></div>';

    var tooltip = document.getElementById('klineTooltip');
    tooltip.innerHTML = html;
    tooltip.style.display = 'block';

    var container = klineCanvas.parentElement;
    var containerRect = container.getBoundingClientRect();
    var tx = mx + 15;
    var ty = my - 10;
    if (tx + 180 > containerRect.width) tx = mx - 180;
    if (ty + 180 > containerRect.height) ty = my - 190;
    tooltip.style.left = tx + 'px';
    tooltip.style.top = ty + 'px';
}

// ==================== 参数优化器 ====================

function togglePoOptions() {
    var method = document.getElementById('poMethod').value;
    document.getElementById('poGaOptions').style.display = (method === 'ga') ? 'flex' : 'none';
    document.getElementById('poWfOptions').style.display = (method === 'walkforward') ? 'flex' : 'none';
}

async function runParamOptimizer() {
    var symbol = document.getElementById('poSymbol').value.trim();
    var strategy = document.getElementById('poStrategy').value;
    var method = document.getElementById('poMethod').value;
    var objective = document.getElementById('poObjective').value;
    var days = parseInt(document.getElementById('poDays').value);
    var capital = parseFloat(document.getElementById('poCapital').value);

    if (!symbol || symbol.length !== 6) { alert('请输入6位股票代码'); return; }

    document.getElementById('poProgress').style.display = 'flex';
    document.getElementById('poResult').innerHTML = '';

    var url = '';
    var body = { symbol: symbol, strategy: strategy, objective: objective, days: days, capital: capital };

    if (method === 'grid') {
        url = '/api/optimizer/grid';
    } else if (method === 'ga') {
        url = '/api/optimizer/ga';
        body.population_size = parseInt(document.getElementById('poPopSize').value);
        body.generations = parseInt(document.getElementById('poGenerations').value);
    } else if (method === 'walkforward') {
        url = '/api/optimizer/walkforward';
        body.train_ratio = parseFloat(document.getElementById('poTrainRatio').value);
        body.step_size = parseInt(document.getElementById('poStepSize').value);
    }

    var data = await apiPost(url, body);
    document.getElementById('poProgress').style.display = 'none';

    if (data.error) {
        document.getElementById('poResult').innerHTML = '<div class="empty-state"><p style="color:#ef5350;">' + data.error + '</p></div>';
        return;
    }

    var perf = data['最优绩效'] || {};
    var html = '<div class="result-card">';
    html += '<h3>优化结果 - ' + (data['优化方法'] || '') + '</h3>';
    html += '<div class="metric-grid">';
    html += '<div class="metric-item"><span class="metric-label">最优参数</span><span class="metric-value">' + JSON.stringify(data['最优参数']) + '</span></div>';
    html += '<div class="metric-item"><span class="metric-label">最优得分</span><span class="metric-value">' + (data['最优得分'] || 0) + '</span></div>';
    html += '<div class="metric-item"><span class="metric-label">累计收益率</span><span class="metric-value ' + (perf['累计收益率'] >= 0 ? 'up' : 'down') + '">' + (perf['累计收益率'] != null ? (perf['累计收益率']*100).toFixed(2) + '%' : '--') + '</span></div>';
    html += '<div class="metric-item"><span class="metric-label">年化收益率</span><span class="metric-value ' + (perf['年化收益率'] >= 0 ? 'up' : 'down') + '">' + (perf['年化收益率'] != null ? (perf['年化收益率']*100).toFixed(2) + '%' : '--') + '</span></div>';
    html += '<div class="metric-item"><span class="metric-label">夏普比率</span><span class="metric-value">' + (perf['夏普比率'] != null ? perf['夏普比率'].toFixed(2) : '--') + '</span></div>';
    html += '<div class="metric-item"><span class="metric-label">最大回撤</span><span class="metric-value down">' + (perf['最大回撤'] != null ? (perf['最大回撤']*100).toFixed(2) + '%' : '--') + '</span></div>';
    html += '<div class="metric-item"><span class="metric-label">胜率</span><span class="metric-value">' + (perf['胜率'] != null ? (perf['胜率']*100).toFixed(1) + '%' : '--') + '</span></div>';
    html += '<div class="metric-item"><span class="metric-label">交易次数</span><span class="metric-value">' + (perf['交易次数'] || 0) + '</span></div>';
    html += '</div></div>';

    if (data['全部结果'] && data['全部结果'].length > 0) {
        html += '<div class="result-card" style="margin-top:16px;"><h3>Top 10 参数组合</h3>';
        html += '<table class="data-table"><thead><tr><th>排名</th><th>参数</th><th>得分</th><th>收益率</th><th>夏普</th><th>回撤</th></tr></thead><tbody>';
        var top10 = data['全部结果'].slice(0, 10);
        for (var i = 0; i < top10.length; i++) {
            var r = top10[i];
            var rp = r['绩效'] || {};
            html += '<tr>';
            html += '<td>' + (i + 1) + '</td>';
            html += '<td>' + JSON.stringify(r['参数']) + '</td>';
            html += '<td>' + (r['得分'] || 0) + '</td>';
            html += '<td class="' + (rp['累计收益率'] >= 0 ? 'up' : 'down') + '">' + (rp['累计收益率'] != null ? (rp['累计收益率']*100).toFixed(2) + '%' : '--') + '</td>';
            html += '<td>' + (rp['夏普比率'] != null ? rp['夏普比率'].toFixed(2) : '--') + '</td>';
            html += '<td class="down">' + (rp['最大回撤'] != null ? (rp['最大回撤']*100).toFixed(2) + '%' : '--') + '</td>';
            html += '</tr>';
        }
        html += '</tbody></table></div>';
    }

    document.getElementById('poResult').innerHTML = html;
}

// ==================== 行业轮动 ====================

function switchRotationTab(tab) {
    document.querySelectorAll('#page-rotation .monitor-tab').forEach(function(t) { t.classList.remove('active'); });
    document.querySelectorAll('#page-rotation .monitor-tab-content').forEach(function(c) { c.classList.remove('active'); });
    var tabBtn = document.querySelector('#page-rotation .monitor-tab[onclick*="' + tab + '"]');
    if (tabBtn) tabBtn.classList.add('active');
    var tabContent = document.getElementById('rotTab-' + tab);
    if (tabContent) tabContent.classList.add('active');
}

async function runRotationAnalyze() {
    var days = parseInt(document.getElementById('rotDays').value);
    var topN = parseInt(document.getElementById('rotTopN').value);

    var container = document.getElementById('rotAnalyzeResult');
    container.innerHTML = '<div class="loading-spinner"></div><p style="text-align:center;color:var(--text-muted);">正在分析行业轮动，请耐心等待...</p>';

    var data = await apiPost('/api/rotation/analyze', { days: days, top_n: topN });

    if (data.error) {
        container.innerHTML = '<div class="error-box">' + data.error + '</div>';
        return;
    }

    renderRotationAnalyze(data, container);
}

function renderRotationAnalyze(data, container) {
    var recommended = data['推荐行业'] || [];
    var weak = data['弱势行业'] || [];
    var signals = data['轮动信号'] || {};
    var allRanked = data['全部排名'] || [];

    var html = '';

    // 轮动信号
    html += '<div class="rotation-signal-card">';
    html += '<div class="rotation-signal-header">';
    html += '<span class="rotation-signal-label">轮动信号</span>';
    html += '<span class="rotation-signal-value">' + (signals['信号'] || '--') + '</span>';
    html += '</div>';
    html += '<p class="rotation-signal-advice">' + (signals['建议'] || '') + '</p>';
    html += '<div class="rotation-signal-detail">';
    html += '<span>强势行业: ' + (signals['强势行业'] || []).join('、') + '</span>';
    html += '<span>弱势行业: ' + (signals['弱势行业'] || []).join('、') + '</span>';
    html += '<span>强弱差值: ' + (signals['强弱差值'] || 0) + '</span>';
    html += '</div>';
    html += '</div>';

    // 推荐行业
    html += '<div class="rotation-table-wrap"><h3>推荐行业 TOP' + recommended.length + '</h3>';
    html += '<table class="mf-table"><thead><tr><th>排名</th><th>行业</th><th>综合评分</th><th>20日动量</th><th>20日相对强弱</th><th>60日动量</th></tr></thead><tbody>';
    for (var i = 0; i < recommended.length; i++) {
        var r = recommended[i];
        html += '<tr>';
        html += '<td class="mf-rank">' + r['排名'] + '</td>';
        html += '<td class="mf-code">' + r['行业'] + '</td>';
        html += '<td class="mf-score">' + (r['综合评分'] != null ? r['综合评分'].toFixed(2) : '--') + '</td>';
        html += '<td class="' + (r['20日动量'] >= 0 ? 'up' : 'down') + '">' + (r['20日动量'] != null ? r['20日动量'].toFixed(2) + '%' : '--') + '</td>';
        html += '<td class="' + (r['20日相对强弱'] >= 0 ? 'up' : 'down') + '">' + (r['20日相对强弱'] != null ? r['20日相对强弱'].toFixed(2) + '%' : '--') + '</td>';
        html += '<td class="' + (r['60日动量'] >= 0 ? 'up' : 'down') + '">' + (r['60日动量'] != null ? r['60日动量'].toFixed(2) + '%' : '--') + '</td>';
        html += '</tr>';
    }
    html += '</tbody></table></div>';

    // 弱势行业
    if (weak.length > 0) {
        html += '<div class="rotation-table-wrap"><h3>弱势行业</h3>';
        html += '<table class="mf-table"><thead><tr><th>排名</th><th>行业</th><th>综合评分</th></tr></thead><tbody>';
        for (var j = 0; j < weak.length; j++) {
            var w = weak[j];
            html += '<tr><td class="mf-rank">' + w['排名'] + '</td><td>' + w['行业'] + '</td><td class="down">' + w['综合评分'].toFixed(2) + '</td></tr>';
        }
        html += '</tbody></table></div>';
    }

    // 全部排名
    if (allRanked.length > 0) {
        html += '<details class="mf-all-ranked"><summary>查看全部行业排名（共' + allRanked.length + '个）</summary>';
        html += '<table class="mf-table"><thead><tr><th>排名</th><th>行业</th><th>综合评分</th></tr></thead><tbody>';
        for (var k = 0; k < allRanked.length; k++) {
            var ar = allRanked[k];
            html += '<tr><td>' + ar['排名'] + '</td><td>' + ar['行业'] + '</td><td>' + ar['综合评分'].toFixed(2) + '</td></tr>';
        }
        html += '</tbody></table></details>';
    }

    container.innerHTML = html;
}

async function runRotationBacktest() {
    var days = parseInt(document.getElementById('rotBtDays').value);
    var topN = parseInt(document.getElementById('rotBtTopN').value);
    var rebalance = parseInt(document.getElementById('rotBtRebalance').value);
    var capital = parseFloat(document.getElementById('rotBtCapital').value);

    var container = document.getElementById('rotBacktestResult');
    container.innerHTML = '<div class="loading-spinner"></div><p style="text-align:center;color:var(--text-muted);">正在回测行业轮动策略，请耐心等待...</p>';

    var data = await apiPost('/api/rotation/backtest', {
        days: days, top_n: topN, rebalance: rebalance, capital: capital
    });

    if (data.error) {
        container.innerHTML = '<div class="error-box">' + data.error + '</div>';
        return;
    }

    var html = '<div class="result-card"><h3>行业轮动策略回测结果</h3>';
    html += '<div class="metric-grid">';
    html += '<div class="metric-item"><span class="metric-label">策略名称</span><span class="metric-value">' + (data['策略名称'] || '--') + '</span></div>';
    html += '<div class="metric-item"><span class="metric-label">初始资金</span><span class="metric-value">' + (data['初始资金'] || 0).toLocaleString() + '</span></div>';
    html += '<div class="metric-item"><span class="metric-label">最终价值</span><span class="metric-value">' + (data['最终价值'] || 0).toLocaleString() + '</span></div>';
    html += '<div class="metric-item"><span class="metric-label">总收益率</span><span class="metric-value ' + (data['总收益率'] >= 0 ? 'up' : 'down') + '">' + (data['总收益率'] != null ? data['总收益率'].toFixed(2) + '%' : '--') + '</span></div>';
    html += '<div class="metric-item"><span class="metric-label">年化收益率</span><span class="metric-value ' + (data['年化收益率'] >= 0 ? 'up' : 'down') + '">' + (data['年化收益率'] != null ? data['年化收益率'].toFixed(2) + '%' : '--') + '</span></div>';
    html += '<div class="metric-item"><span class="metric-label">年化波动率</span><span class="metric-value">' + (data['年化波动率'] != null ? data['年化波动率'].toFixed(2) + '%' : '--') + '</span></div>';
    html += '<div class="metric-item"><span class="metric-label">夏普比率</span><span class="metric-value">' + (data['夏普比率'] != null ? data['夏普比率'].toFixed(2) : '--') + '</span></div>';
    html += '<div class="metric-item"><span class="metric-label">最大回撤</span><span class="metric-value down">' + (data['最大回撤'] != null ? data['最大回撤'].toFixed(2) + '%' : '--') + '</span></div>';
    html += '<div class="metric-item"><span class="metric-label">调仓频率</span><span class="metric-value">' + (data['调仓频率'] || '--') + '</span></div>';
    html += '<div class="metric-item"><span class="metric-label">持仓行业数</span><span class="metric-value">' + (data['持仓行业数'] || '--') + '</span></div>';
    html += '<div class="metric-item"><span class="metric-label">回测天数</span><span class="metric-value">' + (data['回测天数'] || 0) + '天</span></div>';
    html += '</div></div>';

    container.innerHTML = html;
}

// ==================== 蒙特卡洛模拟 ====================

function switchMcTab(tab) {
    document.querySelectorAll('#page-monte-carlo .monitor-tab').forEach(function(t) { t.classList.remove('active'); });
    document.querySelectorAll('#page-monte-carlo .monitor-tab-content').forEach(function(c) { c.classList.remove('active'); });
    var tabBtn = document.querySelector('#page-monte-carlo .monitor-tab[onclick*="' + tab + '"]');
    if (tabBtn) tabBtn.classList.add('active');
    var tabContent = document.getElementById('mcTab-' + tab);
    if (tabContent) tabContent.classList.add('active');
}

async function runMonteCarlo() {
    var symbol = document.getElementById('mcSymbol').value.trim();
    var simulations = parseInt(document.getElementById('mcSimulations').value);
    var horizon = parseInt(document.getElementById('mcHorizon').value);
    var capital = parseFloat(document.getElementById('mcCapital').value);

    if (!symbol || symbol.length !== 6) { alert('请输入6位股票代码'); return; }

    document.getElementById('mcProgress').style.display = 'flex';
    document.getElementById('mcResult').innerHTML = '';

    var data = await apiPost('/api/monte-carlo/simulate', {
        symbol: symbol, simulations: simulations, horizon: horizon, capital: capital
    });

    document.getElementById('mcProgress').style.display = 'none';

    if (data.error) {
        document.getElementById('mcResult').innerHTML = '<div class="empty-state"><p style="color:#ef5350;">' + data.error + '</p></div>';
        return;
    }

    var p = data['分位数收益'] || {};
    var html = '<div class="result-card"><h3>蒙特卡洛模拟结果</h3>';
    html += '<div class="metric-grid">';
    html += '<div class="metric-item"><span class="metric-label">模拟次数</span><span class="metric-value">' + (data['模拟次数'] || 0) + '</span></div>';
    html += '<div class="metric-item"><span class="metric-label">预测周期</span><span class="metric-value">' + (data['预测周期'] || '') + '</span></div>';
    html += '<div class="metric-item"><span class="metric-label">预期年化收益</span><span class="metric-value ' + (data['预期年化收益'] >= 0 ? 'up' : 'down') + '">' + (data['预期年化收益'] || 0) + '%</span></div>';
    html += '<div class="metric-item"><span class="metric-label">预期年化波动</span><span class="metric-value">' + (data['预期年化波动'] || 0) + '%</span></div>';
    html += '<div class="metric-item"><span class="metric-label">盈利概率</span><span class="metric-value up">' + (data['盈利概率'] || 0) + '%</span></div>';
    html += '<div class="metric-item"><span class="metric-label">VaR(95%)</span><span class="metric-value down">' + (data['VaR(95%)'] || 0) + '%</span></div>';
    html += '<div class="metric-item"><span class="metric-label">CVaR(95%)</span><span class="metric-value down">' + (data['CVaR(95%)'] || 0) + '%</span></div>';
    html += '<div class="metric-item"><span class="metric-label">亏损超10%概率</span><span class="metric-value down">' + (data['亏损超10%概率'] || 0) + '%</span></div>';
    html += '</div>';

    html += '<div style="margin-top:16px;"><h4>收益分位数分布</h4>';
    html += '<table class="data-table"><thead><tr><th>分位</th><th>P5</th><th>P10</th><th>P25</th><th>P50</th><th>P75</th><th>P90</th><th>P95</th></tr></thead><tbody><tr>';
    html += '<td>收益(%)</td>';
    ['P5','P10','P25','P50','P75','P90','P95'].forEach(function(k) {
        var v = p[k] || 0;
        html += '<td class="' + (v >= 0 ? 'up' : 'down') + '">' + v + '%</td>';
    });
    html += '</tr></tbody></table></div>';
    html += '</div>';

    document.getElementById('mcResult').innerHTML = html;
}

async function runOverfittingCheck() {
    var metricsStr = document.getElementById('mcMetrics').value.trim();
    if (!metricsStr) { alert('请输入回测绩效指标'); return; }

    var metrics;
    try { metrics = JSON.parse(metricsStr); } catch(e) { alert('JSON格式错误'); return; }

    var data = await apiPost('/api/monte-carlo/overfitting', { metrics: metrics });
    if (data.error) {
        document.getElementById('mcOverfittingResult').innerHTML = '<div class="empty-state"><p style="color:#ef5350;">' + data.error + '</p></div>';
        return;
    }

    var riskLevel = data['过拟合风险等级'] || '未知';
    var riskColor = riskLevel === '低' ? '#26a69a' : (riskLevel === '中' ? '#ff9800' : '#ef5350');
    var html = '<div class="result-card"><h3>过拟合检测结果</h3>';
    html += '<div class="metric-grid">';
    html += '<div class="metric-item"><span class="metric-label">风险等级</span><span class="metric-value" style="color:' + riskColor + ';font-weight:bold;">' + riskLevel + '</span></div>';
    html += '<div class="metric-item"><span class="metric-label">风险评分</span><span class="metric-value">' + (data['过拟合风险评分'] || 0) + ' / 100</span></div>';
    html += '</div>';

    if (data['检测详情'] && data['检测详情'].length > 0) {
        html += '<div style="margin-top:12px;"><h4>检测详情</h4><ul style="list-style:disc;padding-left:20px;">';
        data['检测详情'].forEach(function(d) { html += '<li style="margin:4px 0;">' + d + '</li>'; });
        html += '</ul></div>';
    }
    html += '</div>';
    document.getElementById('mcOverfittingResult').innerHTML = html;
}

// ==================== 批量回测 ====================

async function runBatchBacktest() {
    var symbolsStr = document.getElementById('bbSymbols').value.trim();
    var strategy = document.getElementById('bbStrategy').value;
    var days = parseInt(document.getElementById('bbDays').value);

    if (!symbolsStr) { alert('请输入股票代码'); return; }
    var symbols = symbolsStr.split(',').map(function(s) { return s.trim(); }).filter(function(s) { return s.length === 6; });
    if (symbols.length === 0) { alert('请输入有效的6位股票代码'); return; }

    document.getElementById('bbProgress').style.display = 'flex';
    document.getElementById('bbResult').innerHTML = '';

    var data = await apiPost('/api/backtest/batch', { symbols: symbols, strategy: strategy, days: days });
    document.getElementById('bbProgress').style.display = 'none';

    if (data.error) {
        document.getElementById('bbResult').innerHTML = '<div class="empty-state"><p style="color:#ef5350;">' + data.error + '</p></div>';
        return;
    }

    var results = data.results || [];
    if (results.length === 0) {
        document.getElementById('bbResult').innerHTML = '<div class="empty-state"><p>无回测结果</p></div>';
        return;
    }

    var html = '<div class="result-card"><h3>批量回测结果 - ' + (data['策略'] || strategy) + '</h3>';
    html += '<table class="data-table"><thead><tr><th>股票</th><th>累计收益</th><th>年化收益</th><th>夏普比率</th><th>最大回撤</th><th>胜率</th><th>交易次数</th></tr></thead><tbody>';
    for (var i = 0; i < results.length; i++) {
        var r = results[i];
        html += '<tr>';
        html += '<td><strong>' + (r['股票'] || '') + '</strong></td>';
        html += '<td class="' + (r['累计收益率'] >= 0 ? 'up' : 'down') + '">' + (r['累计收益率'] != null ? (r['累计收益率']*100).toFixed(2) + '%' : '--') + '</td>';
        html += '<td class="' + (r['年化收益率'] >= 0 ? 'up' : 'down') + '">' + (r['年化收益率'] != null ? (r['年化收益率']*100).toFixed(2) + '%' : '--') + '</td>';
        html += '<td>' + (r['夏普比率'] != null ? r['夏普比率'].toFixed(2) : '--') + '</td>';
        html += '<td class="down">' + (r['最大回撤'] != null ? (r['最大回撤']*100).toFixed(2) + '%' : '--') + '</td>';
        html += '<td>' + (r['胜率'] != null ? (r['胜率']*100).toFixed(1) + '%' : '--') + '</td>';
        html += '<td>' + (r['交易次数'] || 0) + '</td>';
        html += '</tr>';
    }
    html += '</tbody></table></div>';
    document.getElementById('bbResult').innerHTML = html;
}

// ==================== 回测记录 ====================

async function loadBacktestRecords() {
    var data = await apiGet('/api/backtest/records');
    if (data.error) {
        document.getElementById('recordsResult').innerHTML = '<div class="empty-state"><p style="color:#ef5350;">' + data.error + '</p></div>';
        return;
    }

    var records = data.records || [];
    if (records.length === 0) {
        document.getElementById('recordsResult').innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48" style="color:var(--text-muted);margin-bottom:16px;"><rect x="2" y="2" width="20" height="20" rx="2"/><line x1="7" y1="8" x2="17" y2="8"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="7" y1="16" x2="12" y2="16"/></svg><p>暂无回测记录</p></div>';
        return;
    }

    var html = '<div class="result-card"><h3>回测记录 (' + records.length + '条)</h3>';
    html += '<table class="data-table"><thead><tr><th>时间</th><th>股票</th><th>策略</th><th>累计收益</th><th>夏普</th><th>回撤</th><th>胜率</th><th>操作</th></tr></thead><tbody>';
    for (var i = 0; i < records.length; i++) {
        var r = records[i];
        html += '<tr>';
        html += '<td>' + (r['回测时间'] || '') + '</td>';
        html += '<td>' + (r['股票代码'] || '') + '</td>';
        html += '<td>' + (r['策略'] || '') + '</td>';
        html += '<td class="' + (r['累计收益率'] >= 0 ? 'up' : 'down') + '">' + (r['累计收益率'] != null ? (r['累计收益率']*100).toFixed(2) + '%' : '--') + '</td>';
        html += '<td>' + (r['夏普比率'] != null ? r['夏普比率'].toFixed(2) : '--') + '</td>';
        html += '<td class="down">' + (r['最大回撤'] != null ? (r['最大回撤']*100).toFixed(2) + '%' : '--') + '</td>';
        html += '<td>' + (r['胜率'] != null ? (r['胜率']*100).toFixed(1) + '%' : '--') + '</td>';
        html += '<td><button class="btn-sm" onclick="deleteBacktestRecord(' + r['id'] + ')">删除</button></td>';
        html += '</tr>';
    }
    html += '</tbody></table></div>';
    document.getElementById('recordsResult').innerHTML = html;
}

async function clearBacktestRecords() {
    if (!confirm('确定要清空所有回测记录吗？此操作不可恢复。')) return;
    var data = await apiDelete('/api/backtest/records');
    if (data.error) { alert(data.error); return; }
    loadBacktestRecords();
}

async function deleteBacktestRecord(id) {
    if (!confirm('确定要删除这条回测记录吗？')) return;
    var data = await apiDelete('/api/backtest/records/' + id);
    if (data.error) { alert(data.error); return; }
    loadBacktestRecords();
}

// ==================== 定时任务调度 ====================

var schedulerRunning = false;

async function loadSchedulerTasks() {
    var data = await apiGet('/api/scheduler/tasks');
    var container = document.getElementById('schedulerTaskList');

    if (data.error) {
        container.innerHTML = '<div class="error-box">' + data.error + '</div>';
        return;
    }

    if (!data || data.length === 0) {
        container.innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48" style="color:var(--text-muted);margin-bottom:16px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><p>暂无定时任务，点击"新建任务"创建</p></div>';
        return;
    }

    var typeNames = {
        'market_overview': '市场概览',
        'stock_ranking': '股票排名',
        'risk_check': '风险检查',
        'factor_analysis': '因子分析',
        'industry_rotation': '行业轮动'
    };

    var scheduleNames = {
        'daily': '每日',
        'weekly': '每周一',
        'monthly': '每月1号'
    };

    var html = '<table class="data-table"><thead><tr>';
    html += '<th>ID</th><th>任务名称</th><th>类型</th><th>调度</th><th>执行时间</th><th>状态</th><th>操作</th>';
    html += '</tr></thead><tbody>';

    data.forEach(function(task) {
        var enabled = task.enabled === 1;
        html += '<tr>';
        html += '<td>' + task.id + '</td>';
        html += '<td>' + task.name + '</td>';
        html += '<td>' + (typeNames[task.task_type] || task.task_type) + '</td>';
        html += '<td>' + (scheduleNames[task.schedule_type] || task.schedule_type) + '</td>';
        html += '<td>' + task.schedule_time + '</td>';
        html += '<td><span class="status-badge ' + (enabled ? 'status-active' : 'status-inactive') + '">' + (enabled ? '启用' : '禁用') + '</span></td>';
        html += '<td>';
        html += '<button class="btn-sm btn-secondary" onclick="toggleSchedulerTask(' + task.id + ')">' + (enabled ? '禁用' : '启用') + '</button>';
        html += '<button class="btn-sm btn-primary" onclick="executeSchedulerTask(' + task.id + ')" style="margin-left:4px;">执行</button>';
        html += '<button class="btn-sm btn-secondary" onclick="viewSchedulerLogs(' + task.id + ')" style="margin-left:4px;">日志</button>';
        html += '<button class="btn-sm btn-danger" onclick="deleteSchedulerTask(' + task.id + ')" style="margin-left:4px;">删除</button>';
        html += '</td>';
        html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

function showAddTaskModal() {
    document.getElementById('addTaskModal').style.display = 'flex';
}

function closeAddTaskModal() {
    document.getElementById('addTaskModal').style.display = 'none';
}

async function addSchedulerTask() {
    var name = document.getElementById('taskName').value.trim();
    var taskType = document.getElementById('taskType').value;
    var schedule = document.getElementById('taskSchedule').value;
    var time = document.getElementById('taskTime').value;
    var symbolsStr = document.getElementById('taskSymbols').value.trim();

    if (!name) {
        alert('请输入任务名称');
        return;
    }

    var symbols = symbolsStr ? symbolsStr.split(',').map(function(s) { return s.trim(); }).filter(function(s) { return s; }) : [];
    var config = { symbols: symbols, days: 250 };

    var data = await apiPost('/api/scheduler/tasks', {
        name: name,
        task_type: taskType,
        config: config,
        schedule_type: schedule,
        schedule_time: time
    });

    if (data.error) {
        alert(data.error);
        return;
    }

    closeAddTaskModal();
    loadSchedulerTasks();
    document.getElementById('taskName').value = '';
    document.getElementById('taskSymbols').value = '';
}

async function toggleSchedulerTask(taskId) {
    var data = await apiPost('/api/scheduler/tasks/' + taskId + '/toggle');
    if (data.error) {
        alert(data.error);
        return;
    }
    loadSchedulerTasks();
}

async function executeSchedulerTask(taskId) {
    var data = await apiPost('/api/scheduler/execute/' + taskId);
    if (data.error) {
        alert(data.error);
        return;
    }
    alert('任务执行完成，状态: ' + data.status);
    loadSchedulerTasks();
}

async function deleteSchedulerTask(taskId) {
    if (!confirm('确定要删除任务 #' + taskId + ' 吗？')) return;
    var data = await apiDelete('/api/scheduler/tasks/' + taskId);
    if (data.error) {
        alert(data.error);
        return;
    }
    loadSchedulerTasks();
}

async function viewSchedulerLogs(taskId) {
    var data = await apiGet('/api/scheduler/logs?task_id=' + taskId + '&limit=20');
    var container = document.getElementById('schedulerLogs');

    if (data.error) {
        container.innerHTML = '<h3 style="margin-bottom:12px;">执行日志</h3><div class="error-box">' + data.error + '</div>';
        return;
    }

    if (!data || data.length === 0) {
        container.innerHTML = '<h3 style="margin-bottom:12px;">执行日志</h3><div class="empty-state"><p>暂无执行日志</p></div>';
        return;
    }

    var html = '<h3 style="margin-bottom:12px;">执行日志（任务 #' + taskId + '）</h3>';
    html += '<table class="data-table"><thead><tr>';
    html += '<th>ID</th><th>状态</th><th>开始时间</th><th>结束时间</th><th>结果/错误</th>';
    html += '</tr></thead><tbody>';

    data.forEach(function(log) {
        var statusCls = log.status === 'success' ? 'status-active' : (log.status === 'failed' ? 'status-inactive' : '');
        html += '<tr>';
        html += '<td>' + log.id + '</td>';
        html += '<td><span class="status-badge ' + statusCls + '">' + log.status + '</span></td>';
        html += '<td>' + (log.started_at || '--') + '</td>';
        html += '<td>' + (log.finished_at || '--') + '</td>';
        html += '<td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + (log.result || log.error || '--') + '</td>';
        html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

async function toggleScheduler() {
    var url = schedulerRunning ? '/api/scheduler/stop' : '/api/scheduler/start';
    var data = await apiPost(url);

    if (data.error) {
        alert(data.error);
        return;
    }

    schedulerRunning = !schedulerRunning;
    updateSchedulerStatus();
}

function updateSchedulerStatus() {
    var statusEl = document.getElementById('schedulerStatus');
    var btnEl = document.getElementById('schedulerToggleBtn');
    if (schedulerRunning) {
        statusEl.textContent = '运行中';
        statusEl.style.color = 'var(--green)';
        btnEl.textContent = '停止调度器';
    } else {
        statusEl.textContent = '未启动';
        statusEl.style.color = 'var(--text-muted)';
        btnEl.textContent = '启动调度器';
    }
}

// ==================== 用户认证 ====================

var authToken = localStorage.getItem('auth_token') || '';
var isLoginMode = true;
var isAuthLoginMode = true;

// ==================== 全屏登录页面 ====================

function showAuthFullscreen() {
    document.getElementById('authFullscreen').style.display = 'flex';
    document.getElementById('appContainer').style.display = 'none';
    document.getElementById('authError').style.display = 'none';
    resetAuthForm();
}

function hideAuthFullscreen() {
    document.getElementById('authFullscreen').style.display = 'none';
    document.getElementById('appContainer').style.display = 'flex';
}

function resetAuthForm() {
    document.getElementById('authUsername').value = '';
    document.getElementById('authPassword').value = '';
    document.getElementById('authEmail').value = '';
    document.getElementById('authError').style.display = 'none';
    isAuthLoginMode = true;
    document.getElementById('authCardTitle').textContent = '登录';
    document.getElementById('authSubmitBtn').textContent = '登录';
    document.getElementById('authSwitchText').textContent = '还没有账号？';
    document.getElementById('authSwitchLink').textContent = '立即注册';
    document.getElementById('authEmailGroup').style.display = 'none';
}

function toggleAuthMode() {
    isAuthLoginMode = !isAuthLoginMode;
    if (isAuthLoginMode) {
        document.getElementById('authCardTitle').textContent = '登录';
        document.getElementById('authSubmitBtn').textContent = '登录';
        document.getElementById('authSwitchText').textContent = '还没有账号？';
        document.getElementById('authSwitchLink').textContent = '立即注册';
        document.getElementById('authEmailGroup').style.display = 'none';
    } else {
        document.getElementById('authCardTitle').textContent = '注册';
        document.getElementById('authSubmitBtn').textContent = '注册';
        document.getElementById('authSwitchText').textContent = '已有账号？';
        document.getElementById('authSwitchLink').textContent = '去登录';
        document.getElementById('authEmailGroup').style.display = 'block';
    }
    document.getElementById('authError').style.display = 'none';
    document.getElementById('authError').style.color = '';
}

async function doAuthLogin() {
    var username = document.getElementById('authUsername').value.trim();
    var password = document.getElementById('authPassword').value.trim();
    var email = document.getElementById('authEmail').value.trim();
    var errorEl = document.getElementById('authError');

    if (!username || !password) {
        errorEl.textContent = '请输入用户名和密码';
        errorEl.style.display = 'block';
        return;
    }

    if (password.length < 6) {
        errorEl.textContent = '密码长度不能少于6位';
        errorEl.style.display = 'block';
        return;
    }

    var url = isAuthLoginMode ? '/api/auth/login' : '/api/auth/register';
    var body = { username: username, password: password };
    if (!isAuthLoginMode && email) {
        body.email = email;
    }

    try {
        var data = await apiPost(url, body);
        if (data.success) {
            if (isAuthLoginMode) {
                // 登录成功，进入主页面
                authToken = data.token;
                localStorage.setItem('auth_token', authToken);
                updateUserUI(data.username);
                hideAuthFullscreen();
                switchPage('dashboard');
            } else {
                // 注册成功，切换到登录页面
                errorEl.textContent = '注册成功，请登录';
                errorEl.style.display = 'block';
                errorEl.style.color = 'var(--green)';
                toggleAuthMode();
            }
        } else {
            errorEl.textContent = data.error || '操作失败';
            errorEl.style.display = 'block';
        }
    } catch (e) {
        errorEl.textContent = '网络错误，请稍后重试';
        errorEl.style.display = 'block';
    }
}

// 回车键提交登录
document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        var authFs = document.getElementById('authFullscreen');
        if (authFs && authFs.style.display !== 'none') {
            doAuthLogin();
        }
    }
});

// ==================== 原有登录弹窗（保留兼容） ====================

function showLoginModal() {
    document.getElementById('loginModal').style.display = 'flex';
    document.getElementById('loginError').style.display = 'none';
    resetLoginForm();
}

function closeLoginModal() {
    document.getElementById('loginModal').style.display = 'none';
}

function resetLoginForm() {
    document.getElementById('loginUsername').value = '';
    document.getElementById('loginPassword').value = '';
    document.getElementById('registerEmail').value = '';
    document.getElementById('loginError').style.display = 'none';
    isLoginMode = true;
    document.getElementById('loginModalTitle').textContent = '登录';
    document.getElementById('loginSubmitBtn').textContent = '登录';
    document.getElementById('toggleRegBtn').textContent = '没有账号？去注册';
    document.getElementById('registerEmailGroup').style.display = 'none';
}

function toggleLoginRegister() {
    isLoginMode = !isLoginMode;
    if (isLoginMode) {
        document.getElementById('loginModalTitle').textContent = '登录';
        document.getElementById('loginSubmitBtn').textContent = '登录';
        document.getElementById('toggleRegBtn').textContent = '没有账号？去注册';
        document.getElementById('registerEmailGroup').style.display = 'none';
    } else {
        document.getElementById('loginModalTitle').textContent = '注册';
        document.getElementById('loginSubmitBtn').textContent = '注册';
        document.getElementById('toggleRegBtn').textContent = '已有账号？去登录';
        document.getElementById('registerEmailGroup').style.display = 'block';
    }
    document.getElementById('loginError').style.display = 'none';
}

async function doLogin() {
    var username = document.getElementById('loginUsername').value.trim();
    var password = document.getElementById('loginPassword').value.trim();
    var email = document.getElementById('registerEmail').value.trim();
    var errorEl = document.getElementById('loginError');

    if (!username || !password) {
        errorEl.textContent = '请输入用户名和密码';
        errorEl.style.display = 'block';
        return;
    }

    var url = isLoginMode ? '/api/auth/login' : '/api/auth/register';
    var body = { username: username, password: password };
    if (!isLoginMode && email) {
        body.email = email;
    }

    try {
        var data = await apiPost(url, body);
        if (data.success) {
            authToken = data.token;
            localStorage.setItem('auth_token', authToken);
            updateUserUI(data.username);
            closeLoginModal();
        } else {
            errorEl.textContent = data.error || '操作失败';
            errorEl.style.display = 'block';
        }
    } catch (e) {
        errorEl.textContent = '网络错误，请稍后重试';
        errorEl.style.display = 'block';
    }
}

function doLogout() {
    apiPost('/api/auth/logout', { token: authToken });
    authToken = '';
    localStorage.removeItem('auth_token');
    updateUserUI(null);
    showAuthFullscreen();
}

function updateUserUI(username) {
    var userEl = document.getElementById('sidebarUser');
    if (username) {
        userEl.innerHTML = '<div style="display:flex;align-items:center;gap:8px;">' +
            '<div style="width:28px;height:28px;border-radius:50%;background:var(--primary);display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:600;">' + username.charAt(0).toUpperCase() + '</div>' +
            '<span style="font-size:13px;font-weight:500;">' + username + '</span>' +
            '<button class="btn-secondary btn-sm" onclick="doLogout()" style="margin-left:auto;font-size:11px;">退出</button>' +
            '</div>';
    } else {
        userEl.innerHTML = '<button class="btn-secondary btn-sm" onclick="showLoginModal()" style="width:100%;">登录 / 注册</button>';
    }
}

function checkAuth() {
    if (authToken) {
        fetch('/api/auth/check', {
            headers: { 'Authorization': 'Bearer ' + authToken }
        }).then(function(r) { return r.json(); }).then(function(data) {
            if (data.logged_in && data.user) {
                updateUserUI(data.user.username);
                hideAuthFullscreen();
                switchPage('dashboard');
            } else {
                authToken = '';
                localStorage.removeItem('auth_token');
                updateUserUI(null);
                showAuthFullscreen();
            }
        }).catch(function() {
            updateUserUI(null);
            showAuthFullscreen();
        });
    } else {
        showAuthFullscreen();
    }
}

function markAuthRequiredPages() {
    AUTH_REQUIRED_PAGES.forEach(function(pageName) {
        var nav = document.querySelector('[data-page="' + pageName + '"]');
        if (nav && nav.querySelector('.auth-lock') === null) {
            var lock = document.createElement('span');
            lock.className = 'auth-lock';
            lock.textContent = ' *';
            lock.title = '需要登录';
            nav.appendChild(lock);
        }
    });
}

// ==================== AI智能推荐 ====================

async function runAiRecommend() {
    var preference = document.getElementById('aiRecommendPreference').value;
    var priceRange = document.getElementById('aiRecommendPriceRange').value;
    var riskLevel = document.getElementById('aiRecommendRisk').value;
    var topN = parseInt(document.getElementById('aiRecommendTopN').value);
    var market = document.getElementById('aiRecommendMarket').value;

    var resultEl = document.getElementById('aiRecommendResult');
    resultEl.innerHTML = '<div class="loading-spinner">正在分析市场数据，为您推荐最佳股票...</div>';

    try {
        var data = await apiPost('/api/ai/recommend', {
            preference: preference,
            price_range: priceRange,
            risk_level: riskLevel,
            top_n: topN,
            market: market
        });

        if (data.error) {
            resultEl.innerHTML = '<div class="empty-state"><p style="color:#ef5350;">' + data.error + '</p></div>';
            return;
        }

        var html = '<div class="result-card">';
        html += '<h3>推荐结果 <span style="font-size:12px;color:var(--text-muted);font-weight:400;">（' + (data['推荐方法'] || '') + '）</span></h3>';
        html += '<p style="color:var(--text-muted);font-size:13px;margin-bottom:12px;">' + (data['分析说明'] || '') + '</p>';

        if (data['风险提示']) {
            html += '<div class="alert alert-warning" style="margin-bottom:12px;">' + data['风险提示'] + '</div>';
        }

        var stocks = data['推荐股票'] || [];
        if (stocks.length > 0) {
            var rankColors = ['#e74c3c', '#e67e22', '#f39c12', '#3498db', '#2ecc71', '#9b59b6', '#1abc9c', '#34495e'];
            html += '<table class="data-table recommend-table"><thead><tr><th>排名</th><th>股票信息</th><th>最新价</th><th>涨跌幅</th><th>换手率</th><th>市盈率</th><th>市净率</th><th>综合评分</th><th>评级</th><th>推荐理由</th></tr></thead><tbody>';
            for (var i = 0; i < stocks.length; i++) {
                var s = stocks[i];
                var bgColor = rankColors[i] || '#95a5a6';
                var chgPct = s['涨跌幅'] || 0;
                var chgColor = chgPct > 0 ? 'var(--red)' : chgPct < 0 ? 'var(--green)' : 'var(--text-secondary)';
                var chgSign = chgPct > 0 ? '+' : '';
                var score = s['综合评分'] || 0;
                var scoreColor = score >= 70 ? '#27ae60' : score >= 55 ? '#2ecc71' : score >= 40 ? '#f39c12' : '#e74c3c';
                var turnover = s['换手率'];
                var pe = s['市盈率'];
                var pb = s['市净率'];

                html += '<tr>';
                html += '<td><span class="rank-badge" style="background:' + bgColor + ';">' + (i + 1) + '</span></td>';
                html += '<td>';
                html += '<a href="javascript:void(0)" onclick="quickAnalyze(\'' + s['代码'] + '\')" class="stock-link">' + (s['名称'] || s['代码']) + '</a>';
                html += '<span class="stock-code-sub">' + s['代码'] + '</span>';
                html += '</td>';
                html += '<td class="num-cell">' + (s['最新价'] ? s['最新价'].toFixed(2) : '--') + '</td>';
                html += '<td class="num-cell" style="color:' + chgColor + ';font-weight:600;">' + chgSign + (chgPct ? chgPct.toFixed(2) : '0.00') + '%</td>';
                html += '<td class="num-cell">' + (turnover != null ? turnover.toFixed(2) + '%' : '--') + '</td>';
                html += '<td class="num-cell">' + (pe != null && pe > 0 ? pe.toFixed(1) : '--') + '</td>';
                html += '<td class="num-cell">' + (pb != null && pb > 0 ? pb.toFixed(2) : '--') + '</td>';
                html += '<td><span class="score-badge" style="background:' + scoreColor + ';">' + score + '</span></td>';
                html += '<td><span class="rating-tag">' + (s['评级'] || '--') + '</span></td>';
                html += '<td class="reason-cell">' + (s['推荐理由'] || s['理由'] || '暂无详细分析') + '</td>';
                html += '</tr>';
            }
            html += '</tbody></table>';
        } else {
            html += '<div class="empty-state"><p>暂无推荐结果</p></div>';
        }
        html += '</div>';

        resultEl.innerHTML = html;
    } catch (e) {
        resultEl.innerHTML = '<div class="empty-state"><p style="color:#ef5350;">请求失败，请稍后重试</p></div>';
    }
}

function quickAnalyze(symbol) {
    document.getElementById('stockSearch').value = symbol;
    switchPage('analysis');
    analyzeStock();
}

// ==================== 模拟交易 ====================

var ptAccountId = null;

async function initPaperTrading() {
    var capital = parseFloat(document.getElementById('ptCapital').value);
    var name = document.getElementById('ptAccountName').value.trim() || '默认账户';

    var data = await apiPost('/api/paper/account', { capital: capital, name: name });

    if (data.error) {
        alert(data.error);
        return;
    }

    ptAccountId = data['账户ID'];
    renderPaperAccountSummary(data);
    refreshPaperPositions();
    refreshPaperOrders();
    refreshPaperTrades();
}

function renderPaperAccountSummary(data) {
    var container = document.getElementById('ptAccountSummary');
    container.style.display = 'flex';

    var totalReturn = data['总收益率'] || 0;
    var returnCls = totalReturn >= 0 ? 'up' : 'down';

    container.innerHTML =
        '<div class="paper-summary-card">' +
            '<div class="paper-summary-label">总资产</div>' +
            '<div class="paper-summary-value">' + (data['总资产'] || 0).toLocaleString('zh-CN', {minimumFractionDigits: 2}) + '</div>' +
        '</div>' +
        '<div class="paper-summary-card">' +
            '<div class="paper-summary-label">可用资金</div>' +
            '<div class="paper-summary-value">' + (data['可用资金'] || 0).toLocaleString('zh-CN', {minimumFractionDigits: 2}) + '</div>' +
        '</div>' +
        '<div class="paper-summary-card">' +
            '<div class="paper-summary-label">持仓市值</div>' +
            '<div class="paper-summary-value">' + (data['持仓市值'] || 0).toLocaleString('zh-CN', {minimumFractionDigits: 2}) + '</div>' +
        '</div>' +
        '<div class="paper-summary-card">' +
            '<div class="paper-summary-label">总收益率</div>' +
            '<div class="paper-summary-value ' + returnCls + '">' + totalReturn.toFixed(2) + '%</div>' +
        '</div>';
}

function switchPaperTab(tab) {
    document.querySelectorAll('#page-paper-trading .monitor-tab').forEach(function(t) { t.classList.remove('active'); });
    document.querySelectorAll('#page-paper-trading .monitor-tab-content').forEach(function(c) { c.classList.remove('active'); });
    var tabBtn = document.querySelector('#page-paper-trading .monitor-tab[onclick*="' + tab + '"]');
    if (tabBtn) tabBtn.classList.add('active');
    var tabContent = document.getElementById('ptTab-' + tab);
    if (tabContent) tabContent.classList.add('active');

    if (tab === 'positions') refreshPaperPositions();
    if (tab === 'orders') refreshPaperOrders();
    if (tab === 'trades') refreshPaperTrades();
}

async function placePaperOrder() {
    if (!ptAccountId) {
        alert('请先创建或加载账户');
        return;
    }

    var symbol = document.getElementById('ptSymbol').value.trim();
    var direction = document.getElementById('ptDirection').value;
    var quantity = parseInt(document.getElementById('ptQuantity').value);
    var orderType = document.getElementById('ptOrderType').value;
    var price = orderType === 'limit' ? parseFloat(document.getElementById('ptLimitPrice').value) : null;

    if (!symbol) { alert('请输入股票代码'); return; }
    if (isNaN(quantity) || quantity < 100 || quantity % 100 !== 0) { alert('数量必须为100的整数倍'); return; }
    if (orderType === 'limit' && (!price || price <= 0)) { alert('请输入有效的限价'); return; }

    var resultEl = document.getElementById('ptOrderResult');
    resultEl.innerHTML = '<div class="loading-spinner">正在下单...</div>';

    var data = await apiPost('/api/paper/order', {
        account_id: ptAccountId,
        symbol: symbol,
        direction: direction,
        quantity: quantity,
        order_type: orderType,
        price: price
    });

    if (data.error) {
        resultEl.innerHTML = '<div class="error-box">' + data.error + '</div>';
        return;
    }

    if (data.success) {
        var order = data.order;
        var statusText = order.status === 'filled' ? '已成交' : (order.status === 'rejected' ? '已拒绝' : '待成交');
        var statusCls = order.status === 'filled' ? 'color:var(--green);' : (order.status === 'rejected' ? 'color:#ef5350;' : 'color:var(--text-muted);');

        var html = '<div class="result-card">';
        html += '<h4>订单结果</h4>';
        html += '<div style="display:flex;gap:24px;flex-wrap:wrap;margin-top:8px;">';
        html += '<div><span style="color:var(--text-muted);">订单ID: </span>' + order.order_id + '</div>';
        html += '<div><span style="color:var(--text-muted);">股票: </span>' + order.symbol + '</div>';
        html += '<div><span style="color:var(--text-muted);">方向: </span>' + (order.direction === 'buy' ? '买入' : '卖出') + '</div>';
        html += '<div><span style="color:var(--text-muted);">数量: </span>' + order.quantity + '股</div>';
        html += '<div><span style="color:var(--text-muted);">状态: </span><span style="' + statusCls + 'font-weight:600;">' + statusText + '</span></div>';
        if (order.filled_price) {
            html += '<div><span style="color:var(--text-muted);">成交价: </span>' + order.filled_price.toFixed(2) + '</div>';
        }
        if (order.fee_detail) {
            html += '<div><span style="color:var(--text-muted);">费用: </span>' + order.fee_detail['合计'] + '</div>';
        }
        if (order.message) {
            html += '<div style="width:100%;"><span style="color:#ef5350;">' + order.message + '</span></div>';
        }
        html += '</div></div>';
        resultEl.innerHTML = html;

        if (order.status === 'filled') {
            refreshPaperPositions();
            refreshPaperTrades();
            var summaryData = await apiGet('/api/paper/account?account_id=' + ptAccountId);
            if (!summaryData.error) renderPaperAccountSummary(summaryData);
        }
    }
}

async function refreshPaperPositions() {
    if (!ptAccountId) return;
    var data = await apiGet('/api/paper/positions?account_id=' + ptAccountId);
    var container = document.getElementById('ptPositionsResult');

    if (data.error) {
        container.innerHTML = '<div class="error-box">' + data.error + '</div>';
        return;
    }

    var positions = data.positions || [];
    if (positions.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>暂无持仓</p></div>';
        return;
    }

    var html = '<table class="data-table"><thead><tr>';
    html += '<th>股票代码</th><th>持仓数量</th><th>成本价</th><th>当前价</th><th>市值</th><th>盈亏</th><th>盈亏比例</th>';
    html += '</tr></thead><tbody>';

    positions.forEach(function(p) {
        var pnlCls = p['盈亏'] >= 0 ? 'up' : 'down';
        html += '<tr>';
        html += '<td><a href="javascript:void(0)" onclick="quickAnalyze(\'' + p['股票代码'] + '\')" style="color:var(--primary);font-weight:600;">' + p['股票代码'] + '</a></td>';
        html += '<td>' + p['持仓数量'] + '</td>';
        html += '<td>' + p['成本价'] + '</td>';
        html += '<td>' + p['当前价'] + '</td>';
        html += '<td>' + (p['市值'] || 0).toLocaleString() + '</td>';
        html += '<td class="' + pnlCls + '">' + (p['盈亏'] >= 0 ? '+' : '') + (p['盈亏'] || 0).toLocaleString() + '</td>';
        html += '<td class="' + pnlCls + '">' + (p['盈亏比例'] >= 0 ? '+' : '') + (p['盈亏比例'] || 0).toFixed(2) + '%</td>';
        html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

async function refreshPaperOrders() {
    if (!ptAccountId) return;
    var data = await apiGet('/api/paper/orders?account_id=' + ptAccountId);
    var container = document.getElementById('ptOrdersResult');

    if (data.error) {
        container.innerHTML = '<div class="error-box">' + data.error + '</div>';
        return;
    }

    var orders = data.orders || [];
    if (orders.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>暂无订单</p></div>';
        return;
    }

    var html = '<table class="data-table"><thead><tr>';
    html += '<th>订单ID</th><th>股票</th><th>方向</th><th>类型</th><th>价格</th><th>数量</th><th>已成交</th><th>状态</th><th>时间</th><th>操作</th>';
    html += '</tr></thead><tbody>';

    orders.forEach(function(o) {
        var statusCls = o.status === 'filled' ? 'status-active' : (o.status === 'rejected' ? 'status-inactive' : '');
        var statusText = o.status === 'filled' ? '已成交' : (o.status === 'rejected' ? '已拒绝' : (o.status === 'cancelled' ? '已撤销' : '待成交'));
        html += '<tr>';
        html += '<td style="font-size:11px;">' + o.order_id + '</td>';
        html += '<td>' + o.symbol + '</td>';
        html += '<td>' + (o.direction === 'buy' ? '买入' : '卖出') + '</td>';
        html += '<td>' + (o.order_type === 'market' ? '市价' : '限价') + '</td>';
        html += '<td>' + (o.price || '--') + '</td>';
        html += '<td>' + o.quantity + '</td>';
        html += '<td>' + o.filled_quantity + '</td>';
        html += '<td><span class="status-badge ' + statusCls + '">' + statusText + '</span></td>';
        html += '<td style="font-size:11px;">' + (o.created_at || '') + '</td>';
        html += '<td>' + (o.status === 'pending' ? '<button class="btn-secondary btn-sm" onclick="cancelPaperOrder(\'' + o.order_id + '\')">撤销</button>' : '--') + '</td>';
        html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

async function refreshPaperTrades() {
    if (!ptAccountId) return;
    var data = await apiGet('/api/paper/trades?account_id=' + ptAccountId);
    var container = document.getElementById('ptTradesResult');

    if (data.error) {
        container.innerHTML = '<div class="error-box">' + data.error + '</div>';
        return;
    }

    var trades = data.trades || [];
    if (trades.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>暂无成交记录</p></div>';
        return;
    }

    var html = '<table class="data-table"><thead><tr>';
    html += '<th>成交ID</th><th>股票</th><th>方向</th><th>价格</th><th>数量</th><th>金额</th><th>费用</th><th>时间</th>';
    html += '</tr></thead><tbody>';

    trades.forEach(function(t) {
        var feeDetail = t.fee_detail;
        var feeTotal = '--';
        if (typeof feeDetail === 'string') {
            try { feeDetail = JSON.parse(feeDetail); } catch(e) { feeDetail = {}; }
        }
        if (feeDetail && feeDetail['合计']) {
            feeTotal = feeDetail['合计'];
        }

        html += '<tr>';
        html += '<td style="font-size:11px;">' + t.trade_id + '</td>';
        html += '<td>' + t.symbol + '</td>';
        html += '<td style="color:' + (t.direction === 'buy' ? '#ef5350' : '#26a69a') + ';font-weight:600;">' + (t.direction === 'buy' ? '买入' : '卖出') + '</td>';
        html += '<td>' + (t.price || 0).toFixed(2) + '</td>';
        html += '<td>' + t.quantity + '</td>';
        html += '<td>' + (t.amount || 0).toLocaleString() + '</td>';
        html += '<td>' + feeTotal + '</td>';
        html += '<td style="font-size:11px;">' + (t.traded_at || '') + '</td>';
        html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

async function cancelPaperOrder(orderId) {
    if (!confirm('确定要撤销订单 ' + orderId + ' 吗？')) return;

    var data = await apiPost('/api/paper/order/cancel', {
        account_id: ptAccountId,
        order_id: orderId
    });

    if (data.error) {
        alert(data.error);
        return;
    }

    refreshPaperOrders();
}

// 订单类型切换时显示/隐藏限价输入
document.addEventListener('DOMContentLoaded', function() {
    var orderTypeSelect = document.getElementById('ptOrderType');
    if (orderTypeSelect) {
        orderTypeSelect.addEventListener('change', function() {
            var limitGroup = document.getElementById('ptLimitPriceGroup');
            if (limitGroup) {
                limitGroup.style.display = this.value === 'limit' ? 'block' : 'none';
            }
        });
    }
});

// ==================== 通知设置 ====================

var notifyConfigLoaded = false;

async function loadNotifyConfig() {
    if (notifyConfigLoaded) return;
    var data = await apiGet('/api/notify/config');
    if (data.error) return;

    notifyConfigLoaded = true;

    // 邮件配置
    var email = data.email || {};
    document.getElementById('nfEmailEnabled').checked = email.enabled || false;
    document.getElementById('nfSmtpHost').value = email.smtp_host || '';
    document.getElementById('nfSmtpPort').value = email.smtp_port || 465;
    document.getElementById('nfSender').value = email.sender || '';
    document.getElementById('nfPassword').value = email.password || '';
    document.getElementById('nfReceivers').value = (email.receivers || []).join(', ');

    // 钉钉配置
    var dingtalk = data.dingtalk || {};
    document.getElementById('nfDtEnabled').checked = dingtalk.enabled || false;
    document.getElementById('nfWebhookUrl').value = dingtalk.webhook_url || '';
    document.getElementById('nfDtSecret').value = dingtalk.secret || '';

    // 通知规则
    var rules = data.rules || {};
    document.getElementById('nfRuleSignal').checked = rules.signal_change !== false;
    document.getElementById('nfRuleSummary').checked = rules.daily_summary !== false;
    document.getElementById('nfRuleRisk').checked = rules.risk_alert !== false;
    document.getElementById('nfRuleTrade').checked = rules.trade_notify !== false;
}

function switchNotifyTab(tab) {
    document.querySelectorAll('#page-notify .monitor-tab').forEach(function(t) { t.classList.remove('active'); });
    document.querySelectorAll('#page-notify .monitor-tab-content').forEach(function(c) { c.classList.remove('active'); });
    var tabBtn = document.querySelector('#page-notify .monitor-tab[onclick*="' + tab + '"]');
    if (tabBtn) tabBtn.classList.add('active');
    var tabContent = document.getElementById('notifyTab-' + tab);
    if (tabContent) tabContent.classList.add('active');

    if (!notifyConfigLoaded) loadNotifyConfig();
}

async function saveNotifyConfig(section, key, value) {
    var data = await apiPost('/api/notify/config', {
        section: section,
        key: key,
        value: value
    });
    if (data.error) {
        console.error('保存配置失败:', data.error);
    }
}

async function testNotify(channel) {
    var data = await apiPost('/api/notify/test', { channel: channel });
    if (data.error) {
        alert('测试失败: ' + data.error);
        return;
    }
    var results = data.results || {};
    var msgs = [];
    if (results.email) {
        msgs.push('邮件: ' + (results.email.success ? '发送成功' : '发送失败 - ' + results.email.error));
    }
    if (results.dingtalk) {
        msgs.push('钉钉: ' + (results.dingtalk.success ? '发送成功' : '发送失败 - ' + results.dingtalk.error));
    }
    alert(msgs.join('\n') || '测试完成');
}

// ==================== 策略组合管理 ====================

function switchPfTab(tab) {
    document.querySelectorAll('#page-strategy-portfolio .monitor-tab').forEach(function(t) { t.classList.remove('active'); });
    document.querySelectorAll('#page-strategy-portfolio .monitor-tab-content').forEach(function(c) { c.classList.remove('active'); });
    var tabBtn = document.querySelector('#page-strategy-portfolio .monitor-tab[onclick*="' + tab + '"]');
    if (tabBtn) tabBtn.classList.add('active');
    var tabContent = document.getElementById('pfTab-' + tab);
    if (tabContent) tabContent.classList.add('active');
}

function addPfStrategy() {
    var div = document.createElement('div');
    div.className = 'pf-strategy-row';
    div.style.cssText = 'display:flex;gap:8px;align-items:flex-end;margin-bottom:8px;';
    div.innerHTML = '<div class="form-group" style="margin-bottom:0;"><label>策略名称</label><input type="text" class="pf-sname" placeholder="如 均线交叉" style="width:140px;"></div>' +
        '<div class="form-group" style="margin-bottom:0;"><label>股票代码</label><input type="text" class="pf-ssymbol" placeholder="如 600519" style="width:100px;"></div>' +
        '<div class="form-group" style="margin-bottom:0;"><label>权重</label><input type="number" class="pf-sweight" placeholder="0.5" step="0.01" style="width:80px;"></div>' +
        '<button class="btn-secondary btn-sm" onclick="removePfStrategy(this)" style="margin-bottom:0;">删除</button>';
    document.getElementById('pfStrategies').appendChild(div);
}

function removePfStrategy(btn) { btn.parentElement.remove(); }

async function createPortfolio() {
    var name = document.getElementById('pfName').value.trim();
    if (!name) { alert('请输入组合名称'); return; }
    var capital = parseFloat(document.getElementById('pfCapital').value) || 1000000;

    var strategies = [];
    var rows = document.querySelectorAll('#pfStrategies .pf-strategy-row');
    rows.forEach(function(row) {
        var sname = row.querySelector('.pf-sname').value.trim();
        var ssymbol = row.querySelector('.pf-ssymbol').value.trim();
        var sweight = parseFloat(row.querySelector('.pf-sweight').value) || 0;
        if (sname && ssymbol) {
            strategies.push({ name: sname, symbol: ssymbol, weight: sweight });
        }
    });

    if (strategies.length === 0) { alert('请至少添加一个策略'); return; }

    var data = await apiPost('/api/portfolio/create', { name: name, strategies: strategies, capital: capital });
    var container = document.getElementById('pfCreateResult');

    if (data.error) { container.innerHTML = '<div class="error-box">' + data.error + '</div>'; return; }

    var html = '<div class="result-card" style="margin-top:16px;"><h4>' + data['组合名称'] + '</h4>';
    html += '<div style="margin:8px 0;font-size:13px;color:var(--text-muted);">初始资金: ' + data['初始资金'].toLocaleString() + ' | 创建时间: ' + data['创建时间'] + '</div>';
    html += '<table class="data-table"><thead><tr><th>策略名称</th><th>股票代码</th><th>权重</th><th>分配资金</th></tr></thead><tbody>';
    (data['策略列表'] || []).forEach(function(s) {
        html += '<tr><td>' + s['策略名称'] + '</td><td>' + s['股票代码'] + '</td><td>' + (s['权重'] * 100).toFixed(1) + '%</td><td>' + s['分配资金'].toLocaleString() + '</td></tr>';
    });
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

function addPfAllocStrategy() {
    var div = document.createElement('div');
    div.className = 'pf-alloc-row';
    div.style.cssText = 'display:flex;gap:8px;align-items:flex-end;margin-bottom:8px;';
    div.innerHTML = '<div class="form-group" style="margin-bottom:0;"><label>策略名称</label><input type="text" class="pf-aname" placeholder="策略名称" style="width:120px;"></div>' +
        '<div class="form-group" style="margin-bottom:0;flex:1;"><label>日收益率序列</label><input type="text" class="pf-areturns" placeholder="0.01,-0.005,0.02,..." style="width:100%;"></div>' +
        '<button class="btn-secondary btn-sm" onclick="removePfAllocStrategy(this)" style="margin-bottom:0;">删除</button>';
    document.getElementById('pfAllocStrategies').appendChild(div);
}

function removePfAllocStrategy(btn) { btn.parentElement.remove(); }

async function allocatePortfolio() {
    var method = document.getElementById('pfAllocMethod').value;
    var capital = parseFloat(document.getElementById('pfAllocCapital').value) || 1000000;

    var data_input = [];
    var rows = document.querySelectorAll('#pfAllocStrategies .pf-alloc-row');
    rows.forEach(function(row) {
        var aname = row.querySelector('.pf-aname').value.trim();
        var areturns = row.querySelector('.pf-areturns').value.trim();
        if (aname && areturns) {
            var returns = areturns.split(',').map(function(r) { return parseFloat(r) || 0; });
            data_input.push({ name: aname, returns: returns });
        }
    });

    if (data_input.length === 0) { alert('请至少添加一个策略'); return; }

    var data = await apiPost('/api/portfolio/allocate', { method: method, data: data_input, capital: capital });
    var container = document.getElementById('pfAllocResult');

    if (data.error) { container.innerHTML = '<div class="error-box">' + data.error + '</div>'; return; }

    var html = '<div class="result-card" style="margin-top:16px;"><h4>分配结果 (' + data['分配方法'] + ')</h4>';
    html += '<table class="data-table"><thead><tr><th>策略名称</th><th>权重</th><th>分配资金</th></tr></thead><tbody>';
    (data['分配结果'] || []).forEach(function(s) {
        html += '<tr><td>' + s['策略名称'] + '</td><td>' + s['权重百分比'] + '%</td><td>' + s['分配资金'].toLocaleString() + '</td></tr>';
    });
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

function addPfBtStrategy() {
    var div = document.createElement('div');
    div.className = 'pf-bt-row';
    div.style.cssText = 'display:flex;gap:8px;align-items:flex-end;margin-bottom:8px;';
    div.innerHTML = '<div class="form-group" style="margin-bottom:0;"><label>策略名称</label><input type="text" class="pf-bname" placeholder="策略名称" style="width:120px;"></div>' +
        '<div class="form-group" style="margin-bottom:0;flex:1;"><label>日收益率序列</label><input type="text" class="pf-breturns" placeholder="0.01,-0.005,0.02,..." style="width:100%;"></div>' +
        '<div class="form-group" style="margin-bottom:0;"><label>权重</label><input type="number" class="pf-bweight" placeholder="0.5" step="0.01" style="width:80px;"></div>' +
        '<button class="btn-secondary btn-sm" onclick="removePfBtStrategy(this)" style="margin-bottom:0;">删除</button>';
    document.getElementById('pfBtStrategies').appendChild(div);
}

function removePfBtStrategy(btn) { btn.parentElement.remove(); }

async function backtestPortfolio() {
    var capital = parseFloat(document.getElementById('pfBtCapital').value) || 1000000;

    var data_input = [];
    var rows = document.querySelectorAll('#pfBtStrategies .pf-bt-row');
    rows.forEach(function(row) {
        var bname = row.querySelector('.pf-bname').value.trim();
        var breturns = row.querySelector('.pf-breturns').value.trim();
        var bweight = parseFloat(row.querySelector('.pf-bweight').value) || 0;
        if (bname && breturns) {
            var returns = breturns.split(',').map(function(r) { return parseFloat(r) || 0; });
            data_input.push({ name: bname, returns: returns, weight: bweight });
        }
    });

    if (data_input.length === 0) { alert('请至少添加一个策略'); return; }

    var data = await apiPost('/api/portfolio/backtest', { data: data_input, capital: capital });
    var container = document.getElementById('pfBtResult');

    if (data.error) { container.innerHTML = '<div class="error-box">' + data.error + '</div>'; return; }

    var html = '<div class="result-card" style="margin-top:16px;"><h4>组合回测结果</h4>';
    html += '<div class="bt-summary" style="margin-top:12px;">';
    html += buildSummaryCard('总收益率', (data['总收益率'] >= 0 ? '+' : '') + data['总收益率'].toFixed(2) + '%', data['总收益率'] >= 0 ? 'up' : 'down');
    html += buildSummaryCard('年化收益率', data['年化收益率'].toFixed(2) + '%', data['年化收益率'] >= 0 ? 'up' : 'down');
    html += buildSummaryCard('夏普比率', data['夏普比率'].toFixed(2), '');
    html += buildSummaryCard('最大回撤', data['最大回撤'].toFixed(2) + '%', 'down');
    html += buildSummaryCard('年化波动率', data['年化波动率'].toFixed(2) + '%', '');
    html += buildSummaryCard('回测天数', data['回测天数'], '');
    html += '</div>';

    html += '<h4 style="margin-top:16px;">策略贡献</h4>';
    html += '<table class="data-table"><thead><tr><th>策略名称</th><th>权重</th><th>收益率</th><th>波动率</th><th>贡献收益</th></tr></thead><tbody>';
    (data['策略贡献'] || []).forEach(function(s) {
        html += '<tr><td>' + s['策略名称'] + '</td><td>' + s['权重'] + '%</td><td class="' + (s['收益率'] >= 0 ? 'up' : 'down') + '">' + (s['收益率'] >= 0 ? '+' : '') + s['收益率'].toFixed(2) + '%</td><td>' + s['波动率'].toFixed(2) + '%</td><td class="' + (s['贡献收益'] >= 0 ? 'up' : 'down') + '">' + (s['贡献收益'] >= 0 ? '+' : '') + s['贡献收益'].toFixed(2) + '%</td></tr>';
    });
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

function addPfOptStrategy() {
    var div = document.createElement('div');
    div.className = 'pf-opt-row';
    div.style.cssText = 'display:flex;gap:8px;align-items:flex-end;margin-bottom:8px;';
    div.innerHTML = '<div class="form-group" style="margin-bottom:0;"><label>策略名称</label><input type="text" class="pf-oname" placeholder="策略名称" style="width:120px;"></div>' +
        '<div class="form-group" style="margin-bottom:0;flex:1;"><label>日收益率序列</label><input type="text" class="pf-oreturns" placeholder="0.01,-0.005,0.02,..." style="width:100%;"></div>' +
        '<button class="btn-secondary btn-sm" onclick="removePfOptStrategy(this)" style="margin-bottom:0;">删除</button>';
    document.getElementById('pfOptStrategies').appendChild(div);
}

function removePfOptStrategy(btn) { btn.parentElement.remove(); }

async function optimizePortfolio() {
    var objective = document.getElementById('pfOptObjective').value;

    var data_input = [];
    var rows = document.querySelectorAll('#pfOptStrategies .pf-opt-row');
    rows.forEach(function(row) {
        var oname = row.querySelector('.pf-oname').value.trim();
        var oreturns = row.querySelector('.pf-oreturns').value.trim();
        if (oname && oreturns) {
            var returns = oreturns.split(',').map(function(r) { return parseFloat(r) || 0; });
            data_input.push({ name: oname, returns: returns });
        }
    });

    if (data_input.length < 2) { alert('至少需要2个策略进行优化'); return; }

    var data = await apiPost('/api/portfolio/optimize', { data: data_input, objective: objective });
    var container = document.getElementById('pfOptResult');

    if (data.error) { container.innerHTML = '<div class="error-box">' + data.error + '</div>'; return; }

    var html = '<div class="result-card" style="margin-top:16px;"><h4>优化结果 (' + data['优化目标'] + ')</h4>';
    html += '<div style="margin:8px 0;font-size:13px;">预期年化收益: <b>' + data['预期年化收益'] + '%</b> | 预期年化波动: <b>' + data['预期年化波动'] + '%</b> | 预期夏普: <b>' + data['预期夏普比率'] + '</b></div>';
    html += '<table class="data-table"><thead><tr><th>策略名称</th><th>最优权重</th><th>分配资金</th></tr></thead><tbody>';
    (data['优化结果'] || []).forEach(function(s) {
        html += '<tr><td>' + s['策略名称'] + '</td><td>' + s['最优权重'] + '%</td><td>' + s['分配资金'].toLocaleString() + '</td></tr>';
    });
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

// ==================== 绩效归因分析 ====================

function switchAttrTab(tab) {
    document.querySelectorAll('#page-attribution .monitor-tab').forEach(function(t) { t.classList.remove('active'); });
    document.querySelectorAll('#page-attribution .monitor-tab-content').forEach(function(c) { c.classList.remove('active'); });
    var tabBtn = document.querySelector('#page-attribution .monitor-tab[onclick*="' + tab + '"]');
    if (tabBtn) tabBtn.classList.add('active');
    var tabContent = document.getElementById('attrTab-' + tab);
    if (tabContent) tabContent.classList.add('active');
}

function addBrinsonRow(containerId) {
    var div = document.createElement('div');
    div.className = 'brinson-row';
    div.style.cssText = 'display:flex;gap:8px;align-items:flex-end;margin-bottom:6px;';
    if (containerId === 'brinsonPortfolio') {
        div.innerHTML = '<div class="form-group" style="margin-bottom:0;"><label>行业</label><input type="text" class="br-sector" placeholder="如 消费" style="width:100px;"></div>' +
            '<div class="form-group" style="margin-bottom:0;"><label>权重%</label><input type="number" class="br-pw" placeholder="30" style="width:70px;"></div>' +
            '<div class="form-group" style="margin-bottom:0;"><label>收益%</label><input type="number" class="br-pr" placeholder="5" step="0.1" style="width:70px;"></div>' +
            '<button class="btn-secondary btn-sm" onclick="this.parentElement.remove()" style="margin-bottom:0;">删除</button>';
    } else {
        div.innerHTML = '<div class="form-group" style="margin-bottom:0;"><label>行业</label><input type="text" class="br-sector" placeholder="如 消费" style="width:100px;"></div>' +
            '<div class="form-group" style="margin-bottom:0;"><label>权重%</label><input type="number" class="br-bw" placeholder="25" style="width:70px;"></div>' +
            '<div class="form-group" style="margin-bottom:0;"><label>收益%</label><input type="number" class="br-br" placeholder="4" step="0.1" style="width:70px;"></div>' +
            '<button class="btn-secondary btn-sm" onclick="this.parentElement.remove()" style="margin-bottom:0;">删除</button>';
    }
    document.getElementById(containerId).appendChild(div);
}

async function runBrinson() {
    var pw = {}, pr = {}, bw = {}, br = {};

    var pRows = document.querySelectorAll('#brinsonPortfolio .brinson-row');
    pRows.forEach(function(row) {
        var sector = row.querySelector('.br-sector').value.trim();
        var weight = parseFloat(row.querySelector('.br-pw').value) || 0;
        var ret = parseFloat(row.querySelector('.br-pr').value) || 0;
        if (sector) { pw[sector] = weight / 100; pr[sector] = ret / 100; }
    });

    var bRows = document.querySelectorAll('#brinsonBenchmark .brinson-row');
    bRows.forEach(function(row) {
        var sector = row.querySelector('.br-sector').value.trim();
        var weight = parseFloat(row.querySelector('.br-bw').value) || 0;
        var ret = parseFloat(row.querySelector('.br-br').value) || 0;
        if (sector) { bw[sector] = weight / 100; br[sector] = ret / 100; }
    });

    if (Object.keys(pw).length === 0) { alert('请填写组合配置'); return; }
    if (Object.keys(bw).length === 0) { alert('请填写基准配置'); return; }

    var data = await apiPost('/api/attribution/brinson', { pw: pw, pr: pr, bw: bw, br: br });
    var container = document.getElementById('brinsonResult');

    if (data.error) { container.innerHTML = '<div class="error-box">' + data.error + '</div>'; return; }

    var html = '<div class="result-card" style="margin-top:16px;"><h4>Brinson归因结果</h4>';
    html += '<div class="bt-summary" style="margin-top:12px;">';
    html += buildSummaryCard('组合收益', data['组合总收益'] + '%', data['组合总收益'] >= 0 ? 'up' : 'down');
    html += buildSummaryCard('基准收益', data['基准总收益'] + '%', data['基准总收益'] >= 0 ? 'up' : 'down');
    html += buildSummaryCard('超额收益', data['超额收益'] + '%', data['超额收益'] >= 0 ? 'up' : 'down');
    html += buildSummaryCard('配置效应', data['配置效应'] + '%', data['配置效应'] >= 0 ? 'up' : 'down');
    html += buildSummaryCard('选择效应', data['选择效应'] + '%', data['选择效应'] >= 0 ? 'up' : 'down');
    html += buildSummaryCard('交互效应', data['交互效应'] + '%', data['交互效应'] >= 0 ? 'up' : 'down');
    html += '</div>';

    html += '<h4 style="margin-top:16px;">行业明细</h4>';
    html += '<table class="data-table"><thead><tr><th>行业</th><th>组合权重</th><th>基准权重</th><th>组合收益</th><th>基准收益</th><th>配置效应</th><th>选择效应</th><th>交互效应</th></tr></thead><tbody>';
    (data['行业明细'] || []).forEach(function(s) {
        html += '<tr><td>' + s['行业'] + '</td><td>' + s['组合权重'] + '%</td><td>' + s['基准权重'] + '%</td><td class="' + (s['组合收益'] >= 0 ? 'up' : 'down') + '">' + s['组合收益'] + '%</td><td class="' + (s['基准收益'] >= 0 ? 'up' : 'down') + '">' + s['基准收益'] + '%</td><td class="' + (s['配置效应'] >= 0 ? 'up' : 'down') + '">' + s['配置效应'] + '%</td><td class="' + (s['选择效应'] >= 0 ? 'up' : 'down') + '">' + s['选择效应'] + '%</td><td class="' + (s['交互效应'] >= 0 ? 'up' : 'down') + '">' + s['交互效应'] + '%</td></tr>';
    });
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

function addFactorRow() {
    var div = document.createElement('div');
    div.className = 'fa-row';
    div.style.cssText = 'display:flex;gap:8px;align-items:flex-end;margin-bottom:6px;';
    div.innerHTML = '<div class="form-group" style="margin-bottom:0;"><label>因子名称</label><input type="text" class="fa-fname" placeholder="如 市场因子" style="width:120px;"></div>' +
        '<div class="form-group" style="margin-bottom:0;"><label>暴露值</label><input type="number" class="fa-exp" placeholder="1.0" step="0.1" style="width:80px;"></div>' +
        '<div class="form-group" style="margin-bottom:0;flex:1;"><label>因子日收益率</label><input type="text" class="fa-freturns" placeholder="0.008,0.005,-0.002,..." style="width:100%;"></div>' +
        '<button class="btn-secondary btn-sm" onclick="this.parentElement.remove()" style="margin-bottom:0;">删除</button>';
    document.getElementById('factorExposures').appendChild(div);
}

async function runFactorAttr() {
    var returnsStr = document.getElementById('faReturns').value.trim();
    if (!returnsStr) { alert('请输入组合日收益率'); return; }
    var returns = returnsStr.split(',').map(function(r) { return parseFloat(r) || 0; });

    var factor_returns = {};
    var exposures = {};
    var rows = document.querySelectorAll('#factorExposures .fa-row');
    rows.forEach(function(row) {
        var fname = row.querySelector('.fa-fname').value.trim();
        var exp = parseFloat(row.querySelector('.fa-exp').value) || 0;
        var freturnsStr = row.querySelector('.fa-freturns').value.trim();
        if (fname && freturnsStr) {
            exposures[fname] = exp;
            factor_returns[fname] = freturnsStr.split(',').map(function(r) { return parseFloat(r) || 0; });
        }
    });

    if (Object.keys(factor_returns).length === 0) { alert('请至少添加一个因子'); return; }

    var data = await apiPost('/api/attribution/factor', { returns: returns, factor_returns: factor_returns, exposures: exposures });
    var container = document.getElementById('factorAttrResult');

    if (data.error) { container.innerHTML = '<div class="error-box">' + data.error + '</div>'; return; }

    var html = '<div class="result-card" style="margin-top:16px;"><h4>因子归因结果</h4>';
    html += '<div class="bt-summary" style="margin-top:12px;">';
    html += buildSummaryCard('组合总收益', data['组合总收益'] + '%', data['组合总收益'] >= 0 ? 'up' : 'down');
    html += buildSummaryCard('因子解释收益', data['因子解释收益'] + '%', data['因子解释收益'] >= 0 ? 'up' : 'down');
    html += buildSummaryCard('残差收益', data['残差收益'] + '%', data['残差收益'] >= 0 ? 'up' : 'down');
    html += buildSummaryCard('解释比例', data['解释比例'] + '%', '');
    html += '</div>';

    html += '<h4 style="margin-top:16px;">因子贡献</h4>';
    html += '<table class="data-table"><thead><tr><th>因子名称</th><th>暴露值</th><th>贡献收益</th></tr></thead><tbody>';
    var factorContrib = data['因子贡献'] || {};
    var factorExp = data['因子暴露'] || {};
    Object.keys(factorContrib).forEach(function(name) {
        html += '<tr><td>' + name + '</td><td>' + (factorExp[name] || 0) + '</td><td class="' + (factorContrib[name] >= 0 ? 'up' : 'down') + '">' + factorContrib[name] + '%</td></tr>';
    });
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

async function runTimeSeriesAttr() {
    var equityStr = document.getElementById('tsEquity').value.trim();
    if (!equityStr) { alert('请输入权益曲线数据'); return; }
    var equity = equityStr.split(',').map(function(r) { return parseFloat(r) || 0; });

    var data = await apiPost('/api/attribution/timeseries', { equity: equity });
    var container = document.getElementById('tsAttrResult');

    if (data.error) { container.innerHTML = '<div class="error-box">' + data.error + '</div>'; return; }

    var html = '<div class="result-card" style="margin-top:16px;"><h4>时间序列归因结果</h4>';
    html += '<div style="margin:8px 0;font-size:13px;">总天数: <b>' + data['总天数'] + '</b> | 总收益: <b class="' + (data['总收益'] >= 0 ? 'up' : 'down') + '">' + data['总收益'] + '%</b></div>';

    html += '<h4 style="margin-top:16px;">分段分析</h4>';
    html += '<table class="data-table"><thead><tr><th>区间</th><th>天数</th><th>区间收益</th><th>年化波动</th><th>夏普比率</th><th>胜率</th></tr></thead><tbody>';
    (data['分段分析'] || []).forEach(function(s) {
        html += '<tr><td>' + s['区间'] + '</td><td>' + s['天数'] + '</td><td class="' + (s['区间收益'] >= 0 ? 'up' : 'down') + '">' + s['区间收益'] + '%</td><td>' + s['年化波动'] + '%</td><td>' + s['夏普比率'] + '</td><td>' + s['胜率'] + '%</td></tr>';
    });
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

function addTradeRow() {
    var div = document.createElement('div');
    div.className = 'trade-row';
    div.style.cssText = 'display:flex;gap:8px;align-items:flex-end;margin-bottom:6px;';
    div.innerHTML = '<div class="form-group" style="margin-bottom:0;"><label>类型</label><select class="tr-type" style="width:80px;"><option value="买入">买入</option><option value="卖出">卖出</option></select></div>' +
        '<div class="form-group" style="margin-bottom:0;"><label>盈亏</label><input type="number" class="tr-pnl" placeholder="1000" style="width:80px;"></div>' +
        '<div class="form-group" style="margin-bottom:0;"><label>盈亏比例%</label><input type="number" class="tr-pnlpct" placeholder="2.5" step="0.1" style="width:80px;"></div>' +
        '<button class="btn-secondary btn-sm" onclick="this.parentElement.remove()" style="margin-bottom:0;">删除</button>';
    document.getElementById('tradeRecords').appendChild(div);
}

async function runTradeAttr() {
    var trades = [];
    var rows = document.querySelectorAll('#tradeRecords .trade-row');
    rows.forEach(function(row) {
        var type = row.querySelector('.tr-type').value;
        var pnl = parseFloat(row.querySelector('.tr-pnl').value) || 0;
        var pnlpct = parseFloat(row.querySelector('.tr-pnlpct').value) || 0;
        trades.push({ '类型': type, '盈亏': pnl, '盈亏比例': pnlpct });
    });

    if (trades.length === 0) { alert('请至少添加一笔交易'); return; }

    var data = await apiPost('/api/attribution/trade', { trades: trades });
    var container = document.getElementById('tradeAttrResult');

    if (data.error) { container.innerHTML = '<div class="error-box">' + data.error + '</div>'; return; }

    var html = '<div class="result-card" style="margin-top:16px;"><h4>交易归因结果</h4>';
    html += '<div class="bt-summary" style="margin-top:12px;">';
    html += buildSummaryCard('总交易次数', data['总交易次数'], '');
    html += buildSummaryCard('胜率', data['胜率'] + '%', data['胜率'] >= 50 ? 'up' : 'down');
    html += buildSummaryCard('总盈亏', data['总盈亏'], data['总盈亏'] >= 0 ? 'up' : 'down');
    html += buildSummaryCard('盈亏比', data['盈亏比'], '');
    html += buildSummaryCard('最大连续盈利', data['最大连续盈利'], 'up');
    html += buildSummaryCard('最大连续亏损', data['最大连续亏损'], 'down');
    html += '</div>';

    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px;">';
    html += '<div><h4>盈亏分布</h4><table class="data-table"><thead><tr><th>区间</th><th>次数</th></tr></thead><tbody>';
    var dist = data['盈亏分布'] || {};
    Object.keys(dist).forEach(function(k) { html += '<tr><td>' + k + '</td><td>' + dist[k] + '</td></tr>'; });
    html += '</tbody></table></div>';

    html += '<div><h4>关键指标</h4><table class="data-table"><tbody>';
    html += '<tr><td>平均盈利</td><td class="up">' + data['平均盈利'] + '</td></tr>';
    html += '<tr><td>平均亏损</td><td class="down">' + data['平均亏损'] + '</td></tr>';
    html += '<tr><td>最大单笔盈利</td><td class="up">' + data['最大单笔盈利'] + '</td></tr>';
    html += '<tr><td>最大单笔亏损</td><td class="down">' + data['最大单笔亏损'] + '</td></tr>';
    html += '</tbody></table></div></div></div>';
    container.innerHTML = html;
}

// ==================== 市场情绪/舆情分析 ====================

function switchSentTab(tab) {
    document.querySelectorAll('#page-sentiment .monitor-tab').forEach(function(t) { t.classList.remove('active'); });
    document.querySelectorAll('#page-sentiment .monitor-tab-content').forEach(function(c) { c.classList.remove('active'); });
    var tabBtn = document.querySelector('#page-sentiment .monitor-tab[onclick*="' + tab + '"]');
    if (tabBtn) tabBtn.classList.add('active');
    var tabContent = document.getElementById('sentTab-' + tab);
    if (tabContent) tabContent.classList.add('active');
}

async function runStockSentiment() {
    var symbol = document.getElementById('sentSymbol').value.trim();
    var days = parseInt(document.getElementById('sentDays').value) || 60;
    if (!symbol) { alert('请输入股票代码'); return; }

    var data = await apiPost('/api/sentiment/stock', { symbol: symbol, days: days });
    var container = document.getElementById('stockSentResult');

    if (data.error) { container.innerHTML = '<div class="error-box">' + data.error + '</div>'; return; }

    var html = '<div class="result-card" style="margin-top:16px;"><h4>' + data['股票代码'] + ' 情绪分析</h4>';
    html += '<div class="bt-summary" style="margin-top:12px;">';
    html += buildSummaryCard('综合情绪指数', data['综合情绪指数'], data['综合情绪指数'] >= 50 ? 'up' : 'down');
    html += buildSummaryCard('情绪等级', data['情绪等级'], '');
    html += '</div>';
    html += '<div style="margin-top:12px;padding:12px;background:var(--bg-card);border-radius:8px;">';
    html += '<b>操作建议: </b>' + data['操作建议'] + '</div>';

    html += '<h4 style="margin-top:16px;">分项得分</h4>';
    html += '<table class="data-table"><thead><tr><th>维度</th><th>得分</th></tr></thead><tbody>';
    var scores = data['分项得分'] || {};
    Object.keys(scores).forEach(function(k) { html += '<tr><td>' + k + '</td><td>' + scores[k] + '</td></tr>'; });
    html += '</tbody></table>';

    html += '<h4 style="margin-top:16px;">技术指标</h4>';
    html += '<table class="data-table"><thead><tr><th>指标</th><th>数值</th></tr></thead><tbody>';
    var tech = data['技术指标'] || {};
    Object.keys(tech).forEach(function(k) { html += '<tr><td>' + k + '</td><td>' + tech[k] + '</td></tr>'; });
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

async function runBreadth() {
    var symbolsStr = document.getElementById('breadthSymbols').value.trim();
    var days = parseInt(document.getElementById('breadthDays').value) || 5;
    if (!symbolsStr) { alert('请输入股票代码列表'); return; }
    var symbols = symbolsStr.split(',').map(function(s) { return s.trim(); }).filter(Boolean);

    var data = await apiPost('/api/sentiment/breadth', { symbols: symbols, days: days });
    var container = document.getElementById('breadthResult');

    if (data.error) { container.innerHTML = '<div class="error-box">' + data.error + '</div>'; return; }

    var html = '<div class="result-card" style="margin-top:16px;"><h4>市场宽度分析</h4>';
    html += '<div class="bt-summary" style="margin-top:12px;">';
    html += buildSummaryCard('样本数量', data['样本数量'], '');
    html += buildSummaryCard('上涨比例', data['上涨比例'] + '%', 'up');
    html += buildSummaryCard('下跌比例', data['下跌比例'] + '%', 'down');
    html += buildSummaryCard('市场宽度', data['市场宽度'] + '%', data['市场宽度'] >= 0 ? 'up' : 'down');
    html += '</div>';

    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px;">';
    html += '<div><h4>涨幅前5</h4><table class="data-table"><thead><tr><th>股票</th><th>涨跌幅</th></tr></thead><tbody>';
    (data['涨幅前5'] || []).forEach(function(s) { html += '<tr><td>' + s['股票代码'] + '</td><td class="up">' + s['涨跌幅'] + '%</td></tr>'; });
    html += '</tbody></table></div>';

    html += '<div><h4>跌幅前5</h4><table class="data-table"><thead><tr><th>股票</th><th>涨跌幅</th></tr></thead><tbody>';
    (data['跌幅前5'] || []).forEach(function(s) { html += '<tr><td>' + s['股票代码'] + '</td><td class="down">' + s['涨跌幅'] + '%</td></tr>'; });
    html += '</tbody></table></div></div></div>';
    container.innerHTML = html;
}

function addNewsItem() {
    var div = document.createElement('div');
    div.className = 'news-row';
    div.style.cssText = 'display:flex;gap:8px;align-items:flex-end;margin-bottom:6px;';
    div.innerHTML = '<div class="form-group" style="margin-bottom:0;flex:1;"><label>新闻标题</label><input type="text" class="ni-title" placeholder="如 茅台突破2000元创新高" style="width:100%;"></div>' +
        '<div class="form-group" style="margin-bottom:0;flex:1;"><label>内容摘要</label><input type="text" class="ni-content" placeholder="如 贵州茅台股价突破2000元..." style="width:100%;"></div>' +
        '<button class="btn-secondary btn-sm" onclick="this.parentElement.remove()" style="margin-bottom:0;">删除</button>';
    document.getElementById('newsItems').appendChild(div);
}

async function runNewsSentiment() {
    var items = [];
    var rows = document.querySelectorAll('#newsItems .news-row');
    rows.forEach(function(row) {
        var title = row.querySelector('.ni-title').value.trim();
        var content = row.querySelector('.ni-content').value.trim();
        if (title) { items.push({ title: title, content: content }); }
    });

    if (items.length === 0) { alert('请至少添加一条新闻'); return; }

    var data = await apiPost('/api/sentiment/news', { items: items });
    var container = document.getElementById('newsSentResult');

    if (data.error) { container.innerHTML = '<div class="error-box">' + data.error + '</div>'; return; }

    var html = '<div class="result-card" style="margin-top:16px;"><h4>新闻情感分析</h4>';
    html += '<div class="bt-summary" style="margin-top:12px;">';
    html += buildSummaryCard('新闻总数', data['新闻总数'], '');
    html += buildSummaryCard('平均情感得分', data['平均情感得分'], data['平均情感得分'] >= 0 ? 'up' : 'down');
    html += buildSummaryCard('整体评价', data['整体评价'], '');
    html += buildSummaryCard('正面比例', data['正面比例'] + '%', 'up');
    html += '</div>';

    html += '<h4 style="margin-top:16px;">新闻明细</h4>';
    html += '<table class="data-table"><thead><tr><th>标题</th><th>情感得分</th><th>情感</th><th>正面词</th><th>负面词</th></tr></thead><tbody>';
    (data['新闻明细'] || []).forEach(function(n) {
        html += '<tr><td>' + n['标题'] + '</td><td class="' + (n['情感得分'] >= 0 ? 'up' : 'down') + '">' + n['情感得分'] + '</td><td>' + n['情感'] + '</td><td>' + n['正面词数'] + '</td><td>' + n['负面词数'] + '</td></tr>';
    });
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

async function runFearGreed() {
    var data_input = {
        market_change: parseFloat(document.getElementById('fgChange').value) || 0,
        put_call_ratio: parseFloat(document.getElementById('fgPcr').value) || 0,
        volatility: parseFloat(document.getElementById('fgVol').value) || 0,
        volume_ratio: parseFloat(document.getElementById('fgVolRatio').value) || 0,
        advance_decline: parseFloat(document.getElementById('fgAd').value) || 0,
        new_high_low: parseFloat(document.getElementById('fgNhl').value) || 0,
    };

    var data = await apiPost('/api/sentiment/fear-greed', { data: data_input });
    var container = document.getElementById('fgResult');

    if (data.error) { container.innerHTML = '<div class="error-box">' + data.error + '</div>'; return; }

    var html = '<div class="result-card" style="margin-top:16px;"><h4>恐惧贪婪指数</h4>';
    html += '<div class="bt-summary" style="margin-top:12px;">';
    html += buildSummaryCard('恐惧贪婪指数', data['恐惧贪婪指数'], data['恐惧贪婪指数'] >= 50 ? 'up' : 'down');
    html += buildSummaryCard('情绪等级', data['情绪等级'], '');
    html += '</div>';
    html += '<div style="margin-top:12px;padding:12px;background:var(--bg-card);border-radius:8px;">' + data['描述'] + '</div>';

    html += '<h4 style="margin-top:16px;">各维度得分</h4>';
    html += '<table class="data-table"><thead><tr><th>维度</th><th>得分</th></tr></thead><tbody>';
    var dims = data['各维度得分'] || {};
    Object.keys(dims).forEach(function(k) { html += '<tr><td>' + k + '</td><td>' + dims[k] + '</td></tr>'; });
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

// ==================== 实时风控监控 ====================

function switchRiskTab(tab) {
    document.querySelectorAll('#page-risk-monitor .monitor-tab').forEach(function(t) { t.classList.remove('active'); });
    document.querySelectorAll('#page-risk-monitor .monitor-tab-content').forEach(function(c) { c.classList.remove('active'); });
    var tabBtn = document.querySelector('#page-risk-monitor .monitor-tab[onclick*="' + tab + '"]');
    if (tabBtn) tabBtn.classList.add('active');
    var tabContent = document.getElementById('riskTab-' + tab);
    if (tabContent) tabContent.classList.add('active');
}

function addRiskPosition() {
    var div = document.createElement('div');
    div.className = 'risk-pos-row';
    div.style.cssText = 'display:flex;gap:8px;align-items:flex-end;margin-bottom:6px;flex-wrap:wrap;';
    div.innerHTML = '<div class="form-group" style="margin-bottom:0;"><label>股票代码</label><input type="text" class="rp-symbol" placeholder="600519" style="width:100px;"></div>' +
        '<div class="form-group" style="margin-bottom:0;"><label>持仓数量</label><input type="number" class="rp-qty" value="1000" style="width:100px;"></div>' +
        '<div class="form-group" style="margin-bottom:0;"><label>成本价</label><input type="number" class="rp-cost" value="1800" step="0.01" style="width:100px;"></div>' +
        '<div class="form-group" style="margin-bottom:0;"><label>当前价</label><input type="number" class="rp-price" value="1850" step="0.01" style="width:100px;"></div>' +
        '<div class="form-group" style="margin-bottom:0;"><label>行业</label><input type="text" class="rp-sector" placeholder="白酒" style="width:80px;"></div>' +
        '<button class="btn-secondary btn-sm" onclick="this.parentElement.remove()" style="margin-bottom:0;">删除</button>';
    document.getElementById('riskPositions').appendChild(div);
}

async function runRiskCheck() {
    var positions = [];
    var rows = document.querySelectorAll('#riskPositions .risk-pos-row');
    rows.forEach(function(row) {
        var symbol = row.querySelector('.rp-symbol').value.trim();
        var qty = parseInt(row.querySelector('.rp-qty').value) || 0;
        var cost = parseFloat(row.querySelector('.rp-cost').value) || 0;
        var price = parseFloat(row.querySelector('.rp-price').value) || 0;
        var sector = row.querySelector('.rp-sector').value.trim() || '其他';
        if (symbol && qty > 0) {
            positions.push({ symbol: symbol, quantity: qty, cost: cost, current_price: price, sector: sector });
        }
    });

    if (positions.length === 0) { alert('请至少添加一个持仓'); return; }

    var indexChange = parseFloat(document.getElementById('riskIndexChange').value) || 0;
    var marketData = { index_change: indexChange };

    var data = await apiPost('/api/risk/check', { positions: positions, market_data: marketData });
    var container = document.getElementById('riskCheckResult');

    if (data.error) { container.innerHTML = '<div class="error-box">' + data.error + '</div>'; return; }

    var html = '<div class="result-card" style="margin-top:16px;"><h4>风险检查结果</h4>';
    html += '<div class="bt-summary" style="margin-top:12px;">';
    html += buildSummaryCard('风险等级', data['风险等级'], data['风险等级'] === '正常' ? 'up' : 'down');
    html += buildSummaryCard('总市值', formatMoney(data['总市值']), '');
    html += buildSummaryCard('总盈亏', formatMoney(data['总盈亏']), data['总盈亏'] >= 0 ? 'up' : 'down');
    html += buildSummaryCard('盈亏比例', data['总盈亏比例'] + '%', data['总盈亏比例'] >= 0 ? 'up' : 'down');
    html += '</div>';

    if (data['预警列表'] && data['预警列表'].length > 0) {
        html += '<h4 style="margin-top:16px;color:var(--danger);">预警信息 (' + data['预警列表'].length + '条)</h4>';
        html += '<table class="data-table"><thead><tr><th>级别</th><th>类型</th><th>描述</th></tr></thead><tbody>';
        data['预警列表'].forEach(function(a) {
            var color = a['级别'] === '严重' ? 'var(--danger)' : a['级别'] === '警告' ? 'var(--warning)' : 'var(--text-muted)';
            html += '<tr><td style="color:' + color + ';font-weight:bold;">' + a['级别'] + '</td><td>' + a['类型'] + '</td><td>' + a['描述'] + '</td></tr>';
        });
        html += '</tbody></table>';
    }

    html += '<h4 style="margin-top:16px;">持仓明细</h4>';
    html += '<table class="data-table"><thead><tr><th>股票</th><th>数量</th><th>成本</th><th>现价</th><th>市值</th><th>盈亏</th><th>盈亏%</th></tr></thead><tbody>';
    (data['持仓明细'] || []).forEach(function(p) {
        html += '<tr><td>' + p['股票代码'] + '</td><td>' + p['持仓数量'] + '</td><td>' + p['成本价'] + '</td><td>' + p['当前价'] + '</td><td>' + formatMoney(p['市值']) + '</td><td class="' + (p['盈亏'] >= 0 ? 'up' : 'down') + '">' + formatMoney(p['盈亏']) + '</td><td class="' + (p['盈亏比例'] >= 0 ? 'up' : 'down') + '">' + p['盈亏比例'] + '%</td></tr>';
    });
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

async function runVaR() {
    var returnsStr = document.getElementById('varReturns').value.trim();
    if (!returnsStr) { alert('请输入收益率序列'); return; }
    var returns = returnsStr.split(',').map(function(s) { return parseFloat(s.trim()); }).filter(function(v) { return !isNaN(v); });
    var confidence = parseFloat(document.getElementById('varConfidence').value);
    var method = document.getElementById('varMethod').value;

    var data = await apiPost('/api/risk/var', { returns: returns, confidence: confidence, method: method });
    var container = document.getElementById('varResult');

    if (data.error) { container.innerHTML = '<div class="error-box">' + data.error + '</div>'; return; }

    var html = '<div class="result-card" style="margin-top:16px;"><h4>VaR计算结果</h4>';
    html += '<div class="bt-summary" style="margin-top:12px;">';
    html += buildSummaryCard('分析方法', data['分析方法'], '');
    html += buildSummaryCard('置信水平', data['置信水平'], '');
    html += buildSummaryCard('VaR(日)', data['VaR(日)'] + '%', 'down');
    html += buildSummaryCard('CVaR(日)', data['CVaR(日)'] + '%', 'down');
    html += '</div>';
    html += '<div class="bt-summary" style="margin-top:8px;">';
    html += buildSummaryCard('VaR(周)', data['VaR(周)'] + '%', 'down');
    html += buildSummaryCard('VaR(月)', data['VaR(月)'] + '%', 'down');
    html += '</div>';
    html += '<div style="margin-top:12px;padding:12px;background:var(--bg-card);border-radius:8px;">' + data['含义'] + '</div></div>';
    container.innerHTML = html;
}

async function runDrawdown() {
    var equityStr = document.getElementById('ddEquity').value.trim();
    if (!equityStr) { alert('请输入权益曲线'); return; }
    var equity = equityStr.split(',').map(function(s) { return parseFloat(s.trim()); }).filter(function(v) { return !isNaN(v); });

    var data = await apiPost('/api/risk/drawdown', { equity: equity });
    var container = document.getElementById('ddResult');

    if (data.error) { container.innerHTML = '<div class="error-box">' + data.error + '</div>'; return; }

    var html = '<div class="result-card" style="margin-top:16px;"><h4>回撤分析结果</h4>';
    html += '<div class="bt-summary" style="margin-top:12px;">';
    html += buildSummaryCard('当前权益', formatMoney(data['当前权益']), '');
    html += buildSummaryCard('历史最高', formatMoney(data['历史最高']), 'up');
    html += buildSummaryCard('当前回撤', data['当前回撤'] + '%', 'down');
    html += buildSummaryCard('最大回撤', data['最大回撤'] + '%', 'down');
    html += '</div>';
    html += '<div class="bt-summary" style="margin-top:8px;">';
    html += buildSummaryCard('最大回撤位置', data['最大回撤位置'], '');
    html += buildSummaryCard('持续天数', data['当前回撤持续天数'] + '天', '');
    html += buildSummaryCard('恢复状态', data['恢复状态'], '');
    html += '</div>';

    html += '<h4 style="margin-top:16px;">回撤分布</h4>';
    html += '<table class="data-table"><thead><tr><th>区间</th><th>天数</th></tr></thead><tbody>';
    var dist = data['回撤分布'] || {};
    Object.keys(dist).forEach(function(k) { html += '<tr><td>' + k + '</td><td>' + dist[k] + '</td></tr>'; });
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

async function runLimits() {
    var positions = [];
    var rows = document.querySelectorAll('#riskPositions .risk-pos-row');
    rows.forEach(function(row) {
        var symbol = row.querySelector('.rp-symbol').value.trim();
        var qty = parseInt(row.querySelector('.rp-qty').value) || 0;
        var cost = parseFloat(row.querySelector('.rp-cost').value) || 0;
        var price = parseFloat(row.querySelector('.rp-price').value) || 0;
        var sector = row.querySelector('.rp-sector').value.trim() || '其他';
        if (symbol && qty > 0) {
            positions.push({ symbol: symbol, quantity: qty, cost: cost, current_price: price, sector: sector });
        }
    });

    if (positions.length === 0) { alert('请先在"风险检查"标签中添加持仓'); return; }

    var limits = {
        max_single_position: parseFloat(document.getElementById('limSingle').value) / 100 || 0.3,
        max_sector_exposure: parseFloat(document.getElementById('limSector').value) / 100 || 0.4,
        max_total_leverage: parseFloat(document.getElementById('limLeverage').value) || 1.0,
        nav: parseFloat(document.getElementById('limNav').value) || 1000000,
    };

    var data = await apiPost('/api/risk/limits', { positions: positions, limits: limits });
    var container = document.getElementById('limitsResult');

    if (data.error) { container.innerHTML = '<div class="error-box">' + data.error + '</div>'; return; }

    var html = '<div class="result-card" style="margin-top:16px;"><h4>限额检查结果</h4>';
    html += '<div class="bt-summary" style="margin-top:12px;">';
    html += buildSummaryCard('总市值', formatMoney(data['总市值']), '');
    html += buildSummaryCard('违规数量', data['违规数量'], data['违规数量'] > 0 ? 'down' : 'up');
    html += buildSummaryCard('是否合规', data['是否合规'] ? '合规' : '不合规', data['是否合规'] ? 'up' : 'down');
    html += '</div>';

    if (data['违规明细'] && data['违规明细'].length > 0) {
        html += '<h4 style="margin-top:16px;color:var(--danger);">违规明细</h4>';
        html += '<table class="data-table"><thead><tr><th>类型</th><th>详情</th><th>当前</th><th>限额</th><th>超出</th><th>建议</th></tr></thead><tbody>';
        data['违规明细'].forEach(function(v) {
            html += '<tr><td>' + v['类型'] + '</td><td>' + (v['股票'] || v['行业'] || '') + '</td><td>' + v['当前权重'] + '%</td><td>' + v['限额'] + '%</td><td class="down">' + v['超出'] + '%</td><td>' + v['建议'] + '</td></tr>';
        });
        html += '</tbody></table>';
    }
    html += '</div>';
    container.innerHTML = html;
}

function addStressScenario() {
    var div = document.createElement('div');
    div.className = 'stress-row';
    div.style.cssText = 'display:flex;gap:8px;align-items:flex-end;margin-bottom:6px;flex-wrap:wrap;';
    div.innerHTML = '<div class="form-group" style="margin-bottom:0;"><label>场景名称</label><input type="text" class="ss-name" value="大盘跌5%" style="width:120px;"></div>' +
        '<div class="form-group" style="margin-bottom:0;"><label>大盘跌幅(%)</label><input type="number" class="ss-index" value="-5" style="width:100px;"></div>' +
        '<div class="form-group" style="margin-bottom:0;"><label>行业冲击(JSON)</label><input type="text" class="ss-sector" placeholder=\'{"白酒":-8,"银行":-3}\' style="width:200px;"></div>' +
        '<button class="btn-secondary btn-sm" onclick="this.parentElement.remove()" style="margin-bottom:0;">删除</button>';
    document.getElementById('stressScenarios').appendChild(div);
}

async function runStress() {
    var positions = [];
    var rows = document.querySelectorAll('#riskPositions .risk-pos-row');
    rows.forEach(function(row) {
        var symbol = row.querySelector('.rp-symbol').value.trim();
        var qty = parseInt(row.querySelector('.rp-qty').value) || 0;
        var cost = parseFloat(row.querySelector('.rp-cost').value) || 0;
        var price = parseFloat(row.querySelector('.rp-price').value) || 0;
        var sector = row.querySelector('.rp-sector').value.trim() || '其他';
        if (symbol && qty > 0) {
            positions.push({ symbol: symbol, quantity: qty, cost: cost, current_price: price, sector: sector });
        }
    });

    if (positions.length === 0) { alert('请先在"风险检查"标签中添加持仓'); return; }

    var scenarios = [];
    var sRows = document.querySelectorAll('#stressScenarios .stress-row');
    sRows.forEach(function(row) {
        var name = row.querySelector('.ss-name').value.trim();
        var indexChange = parseFloat(row.querySelector('.ss-index').value) / 100 || 0;
        var sectorStr = row.querySelector('.ss-sector').value.trim();
        var sectorImpacts = {};
        if (sectorStr) {
            try { sectorImpacts = JSON.parse(sectorStr); } catch(e) {}
        }
        if (name) {
            scenarios.push({ name: name, index_change: indexChange, sector_impacts: sectorImpacts });
        }
    });

    if (scenarios.length === 0) { alert('请至少添加一个测试场景'); return; }

    var data = await apiPost('/api/risk/stress', { positions: positions, scenarios: scenarios });
    var container = document.getElementById('stressResult');

    if (data.error) { container.innerHTML = '<div class="error-box">' + data.error + '</div>'; return; }

    var html = '<div class="result-card" style="margin-top:16px;"><h4>压力测试结果</h4>';
    html += '<div style="margin-top:12px;padding:8px 12px;background:var(--bg-card);border-radius:8px;">当前总市值: <b>' + formatMoney(data['当前总市值']) + '</b></div>';

    (data['压力测试结果'] || []).forEach(function(s) {
        html += '<div class="result-card" style="margin-top:12px;">';
        html += '<h4>' + s['场景'] + ' (大盘跌' + s['大盘跌幅'] + '%)</h4>';
        html += '<div class="bt-summary" style="margin-top:8px;">';
        html += buildSummaryCard('压力前市值', formatMoney(s['压力前市值']), '');
        html += buildSummaryCard('压力后市值', formatMoney(s['压力后市值']), 'down');
        html += buildSummaryCard('总损失', formatMoney(s['总损失']), 'down');
        html += buildSummaryCard('损失比例', s['损失比例'] + '%', 'down');
        html += '</div>';

        html += '<table class="data-table" style="margin-top:12px;"><thead><tr><th>股票</th><th>当前价</th><th>压力价</th><th>跌幅</th><th>当前市值</th><th>压力市值</th><th>损失</th></tr></thead><tbody>';
        (s['个股影响'] || []).forEach(function(p) {
            html += '<tr><td>' + p['股票'] + '</td><td>' + p['当前价'] + '</td><td class="down">' + p['压力价'] + '</td><td class="down">' + p['跌幅'] + '%</td><td>' + formatMoney(p['当前市值']) + '</td><td class="down">' + formatMoney(p['压力市值']) + '</td><td class="down">' + formatMoney(p['损失']) + '</td></tr>';
        });
        html += '</tbody></table></div>';
    });
    html += '</div>';
    container.innerHTML = html;
}

// ==================== 系统设置页面 ====================

function loadSettings() {
    loadAiConfigToForm();
    loadSettingsStatus();
}

function loadAiConfigToForm() {
    fetch('/api/ai/config')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.error) return;
            document.getElementById('settingsAiBase').value = data.api_base || '';
            document.getElementById('settingsAiModel').value = data.model || '';
            document.getElementById('settingsAiKey').value = '';
            document.getElementById('settingsAiMaxTokens').value = data.max_tokens || 2000;
            document.getElementById('settingsAiTemperature').value = data.temperature || 0.3;
            document.getElementById('settingsAiEnabled').checked = data.enabled || false;
        })
        .catch(function() {});
}

function loadSettingsStatus() {
    var statusEl = document.getElementById('settingsStatus');

    fetch('/api/ai/config')
        .then(function(r) { return r.json(); })
        .then(function(aiConfig) {
            var aiEnabled = aiConfig.enabled;

            var html = '';

            html += '<div class="settings-status-card">';
            html += '<div class="status-label">大模型</div>';
            html += '<div class="status-value">' + (aiConfig.model || '未配置') + '</div>';
            html += '<span class="status-badge ' + (aiEnabled ? 'enabled' : 'disabled') + '">' + (aiEnabled ? '已启用' : '未启用') + '</span>';
            html += '</div>';

            html += '<div class="settings-status-card">';
            html += '<div class="status-label">API 地址</div>';
            html += '<div class="status-value">' + (aiConfig.api_base || '未配置') + '</div>';
            html += '</div>';

            statusEl.innerHTML = html;
        })
        .catch(function() {
            statusEl.innerHTML = '<div class="loading-text">加载失败</div>';
        });
}

function testAiFromSettings() {
    var msgEl = document.getElementById('aiConfigMsg');
    msgEl.style.display = 'block';
    msgEl.textContent = '正在测试连接...';
    msgEl.className = 'settings-msg';

    fetch('/api/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.status === 'ok') {
                msgEl.textContent = '连接成功: ' + (data.message || '');
                msgEl.className = 'settings-msg success';
            } else {
                msgEl.textContent = '连接失败: ' + (data.message || data.error || '未知错误');
                msgEl.className = 'settings-msg error';
            }
            loadSettingsStatus();
        })
        .catch(function(e) {
            msgEl.textContent = '请求失败: ' + e.message;
            msgEl.className = 'settings-msg error';
        });
}

function saveAiFromSettings() {
    var msgEl = document.getElementById('aiConfigMsg');
    var body = {
        api_base: document.getElementById('settingsAiBase').value.trim(),
        api_key: document.getElementById('settingsAiKey').value.trim(),
        model: document.getElementById('settingsAiModel').value.trim(),
        max_tokens: parseInt(document.getElementById('settingsAiMaxTokens').value) || 2000,
        temperature: parseFloat(document.getElementById('settingsAiTemperature').value) || 0.3,
        enabled: document.getElementById('settingsAiEnabled').checked
    };

    msgEl.style.display = 'block';
    msgEl.textContent = '正在保存...';
    msgEl.className = 'settings-msg';

    fetch('/api/ai/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.status === 'ok') {
                msgEl.textContent = '大模型配置已保存';
                msgEl.className = 'settings-msg success';
                document.getElementById('settingsAiKey').value = '';
                loadSettingsStatus();
            } else {
                msgEl.textContent = '保存失败: ' + (data.error || '未知错误');
                msgEl.className = 'settings-msg error';
            }
        })
        .catch(function(e) {
            msgEl.textContent = '请求失败: ' + e.message;
            msgEl.className = 'settings-msg error';
        });
}

// ==================== 市场状态检查 ====================
function updateMarketStatusBar() {
    fetch('/api/market/status')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            var bar = document.getElementById('marketStatusBar');
            if (!bar) return;

            bar.style.display = 'flex';
            bar.className = 'market-status-bar';

            var iconEl = document.getElementById('marketStatusIcon');
            var textEl = document.getElementById('marketStatusText');
            var extraEl = document.getElementById('marketStatusExtra');

            var statusType = data['状态类型'] || 'closed';
            var isOpen = data['是否开盘'];

            if (isOpen) {
                bar.classList.add('status-trading');
                iconEl.textContent = '\u25CF';
                textEl.textContent = data['状态描述'] || '交易中';
                extraEl.textContent = data['距收盘'] || '';
            } else if (statusType === 'weekend') {
                bar.classList.add('status-weekend');
                iconEl.textContent = '\u25A0';
                textEl.textContent = data['状态描述'] || '周末休市';
                extraEl.textContent = '';
            } else if (statusType === 'holiday') {
                bar.classList.add('status-holiday');
                iconEl.textContent = '\u25A0';
                textEl.textContent = data['状态描述'] || '节假日休市';
                extraEl.textContent = '';
            } else if (statusType === 'pre_open' || statusType === 'auction') {
                bar.classList.add('status-pre-open');
                iconEl.textContent = '\u25CB';
                textEl.textContent = data['状态描述'] || '盘前阶段';
                extraEl.textContent = data['距离开盘'] || '';
            } else if (statusType === 'lunch_break') {
                bar.classList.add('status-lunch-break');
                iconEl.textContent = '\u25D0';
                textEl.textContent = data['状态描述'] || '午间休市';
                extraEl.textContent = data['距离开盘'] || '';
            } else if (statusType === 'after_close') {
                bar.classList.add('status-after-close');
                iconEl.textContent = '\u25A0';
                textEl.textContent = data['状态描述'] || '已收盘';
                extraEl.textContent = '';
            } else {
                bar.classList.add('status-closed');
                iconEl.textContent = '\u25A0';
                textEl.textContent = data['状态描述'] || '休市';
                extraEl.textContent = '';
            }
        })
        .catch(function() {
            var bar = document.getElementById('marketStatusBar');
            if (bar) bar.style.display = 'none';
        });
}

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', function () {
    markAuthRequiredPages();
    initDatePickers();

    // 启动市场状态检查（每60秒刷新一次）
    updateMarketStatusBar();
    setInterval(updateMarketStatusBar, 60000);

    // 先检查登录状态，已登录才加载仪表盘
    if (authToken) {
        fetch('/api/auth/check', {
            headers: { 'Authorization': 'Bearer ' + authToken }
        }).then(function(r) { return r.json(); }).then(function(data) {
            if (data.logged_in && data.user) {
                updateUserUI(data.user.username);
                hideAuthFullscreen();
                loadDashboard();
            } else {
                authToken = '';
                localStorage.removeItem('auth_token');
                updateUserUI(null);
                showAuthFullscreen();
            }
        }).catch(function() {
            updateUserUI(null);
            showAuthFullscreen();
        });
    } else {
        showAuthFullscreen();
    }

    // 回车键触发分析
    document.getElementById('stockSearch').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') analyzeStock();
    });
});
