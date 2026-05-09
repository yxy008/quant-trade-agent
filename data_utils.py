#!/usr/bin/env python3
"""
统一数据获取工具 - 多数据源降级支持
所有模块应通过此工具获取数据，确保数据源不可用时有备选方案
"""
import os
os.environ.setdefault('TQDM_DISABLE', '1')

import time
from datetime import datetime, timedelta, date

# 共享数据缓存，避免同一请求周期内多次下载全市场数据
_SPOT_CACHE = None
_SPOT_CACHE_TIME = None
_SPOT_CACHE_TTL = 60  # 60秒内复用

# K线数据缓存
_KLINE_CACHE = {}
_KLINE_CACHE_TIME = {}
_KLINE_CACHE_TTL = 300  # 5分钟内复用

# 指数K线缓存
_INDEX_KLINE_CACHE = {}
_INDEX_KLINE_CACHE_TIME = {}
_INDEX_KLINE_CACHE_TTL = 300

# 缓存统计
_CACHE_STATS = {
    "命中次数": 0,
    "未命中次数": 0,
    "总请求次数": 0,
    "缓存条目数": 0,
}

# 智能缓存TTL配置（秒）
_CACHE_TTL_CONFIG = {
    "实时行情": 30,       # 盘中数据30秒刷新
    "日K线": 300,         # 日线5分钟
    "周K线": 1800,        # 周线30分钟
    "月K线": 3600,        # 月线1小时
    "指数行情": 60,       # 指数60秒
    "板块数据": 120,      # 板块2分钟
    "历史K线": 600,       # 历史数据10分钟
    "基本面数据": 1800,   # 基本面30分钟
}

# 市场交易时间判断
def _is_trading_time():
    """判断当前是否在A股交易时间内"""
    now = datetime.now()
    if now.weekday() >= 5:
        return False
    morning_start = now.replace(hour=9, minute=30, second=0, microsecond=0)
    morning_end = now.replace(hour=11, minute=30, second=0, microsecond=0)
    afternoon_start = now.replace(hour=13, minute=0, second=0, microsecond=0)
    afternoon_end = now.replace(hour=15, minute=0, second=0, microsecond=0)
    return (morning_start <= now <= morning_end) or (afternoon_start <= now <= afternoon_end)


def _get_adaptive_ttl(data_type="实时行情"):
    """
    获取自适应TTL
    交易时间内缩短TTL，非交易时间延长TTL
    """
    base_ttl = _CACHE_TTL_CONFIG.get(data_type, 300)
    if _is_trading_time():
        return base_ttl
    else:
        return base_ttl * 3  # 非交易时间延长3倍


def _update_cache_stats(hit=True):
    """更新缓存统计"""
    _CACHE_STATS["总请求次数"] += 1
    if hit:
        _CACHE_STATS["命中次数"] += 1
    else:
        _CACHE_STATS["未命中次数"] += 1


def get_cache_stats():
    """获取缓存统计信息"""
    total = _CACHE_STATS["总请求次数"]
    hit_rate = round(_CACHE_STATS["命中次数"] / total * 100, 1) if total > 0 else 0
    return {
        **_CACHE_STATS,
        "命中率": f"{hit_rate}%",
        "K线缓存条目": len(_KLINE_CACHE),
        "指数缓存条目": len(_INDEX_KLINE_CACHE),
        "交易时间": _is_trading_time(),
    }


def clear_expired_cache():
    """清理过期缓存"""
    now = time.time()
    expired_kline = [
        k for k, t in _KLINE_CACHE_TIME.items()
        if now - t > _KLINE_CACHE_TTL * 2
    ]
    for k in expired_kline:
        del _KLINE_CACHE[k]
        del _KLINE_CACHE_TIME[k]

    expired_index = [
        k for k, t in _INDEX_KLINE_CACHE_TIME.items()
        if now - t > _INDEX_KLINE_CACHE_TTL * 2
    ]
    for k in expired_index:
        del _INDEX_KLINE_CACHE[k]
        del _INDEX_KLINE_CACHE_TIME[k]

    return {
        "清理K线缓存": len(expired_kline),
        "清理指数缓存": len(expired_index),
    }

try:
    import akshare as ak
    import pandas as pd
    import numpy as np
except ImportError:
    raise ImportError("请先安装依赖: pip install akshare pandas numpy")

try:
    import tqdm
    tqdm.tqdm.disable = True
except ImportError:
    pass


def _get_spot_df():
    """获取A股实时行情DataFrame（带缓存，列名标准化）"""
    global _SPOT_CACHE, _SPOT_CACHE_TIME
    now = time.time()
    adaptive_ttl = _get_adaptive_ttl("实时行情")
    if _SPOT_CACHE is not None and _SPOT_CACHE_TIME is not None:
        if now - _SPOT_CACHE_TIME < adaptive_ttl:
            _update_cache_stats(hit=True)
            return _SPOT_CACHE.copy() if _SPOT_CACHE is not None else None
    _update_cache_stats(hit=False)
    try:
        df = ak.stock_zh_a_spot_em()
        if df is not None and not df.empty:
            df = _normalize_spot_columns(df)
            _SPOT_CACHE = df.copy()
            _SPOT_CACHE_TIME = now
            return df
    except Exception:
        pass
    return _SPOT_CACHE.copy() if _SPOT_CACHE is not None else None


def _normalize_spot_columns(df):
    """将实时行情DataFrame的列名标准化为中文标准名称"""
    col_map = {}
    for c in df.columns:
        cl = str(c).strip()
        # 标准列名映射
        if cl in ('代码', 'code', 'symbol'):
            col_map[c] = '代码'
        elif cl in ('名称', 'name', 'stock_name'):
            col_map[c] = '名称'
        elif cl in ('最新价', 'price', 'close', '最新价格'):
            col_map[c] = '最新价'
        elif cl in ('涨跌幅', 'change_pct', 'pct_change', '涨跌'):
            col_map[c] = '涨跌幅'
        elif cl in ('涨跌额', 'change_amount'):
            col_map[c] = '涨跌额'
        elif cl in ('成交量', 'volume', 'vol'):
            col_map[c] = '成交量'
        elif cl in ('成交额', 'amount', 'turnover'):
            col_map[c] = '成交额'
        elif cl in ('振幅', 'amplitude'):
            col_map[c] = '振幅'
        elif cl in ('最高', 'high'):
            col_map[c] = '最高'
        elif cl in ('最低', 'low'):
            col_map[c] = '最低'
        elif cl in ('今开', 'open'):
            col_map[c] = '今开'
        elif cl in ('昨收', 'pre_close', 'prev_close'):
            col_map[c] = '昨收'
        elif cl in ('量比', 'vol_ratio', 'volume_ratio'):
            col_map[c] = '量比'
        elif cl in ('换手率', 'turnover_rate', 'turnover_pct'):
            col_map[c] = '换手率'
        elif cl in ('市盈率-动态', 'pe_dynamic', 'pe_ttm', 'pe'):
            col_map[c] = '市盈率-动态'
        elif cl in ('市净率', 'pb'):
            col_map[c] = '市净率'
        elif cl in ('总市值', 'total_mv', 'market_cap'):
            col_map[c] = '总市值'
        elif cl in ('流通市值', 'circ_mv', 'float_market_cap'):
            col_map[c] = '流通市值'
    if col_map:
        df = df.rename(columns=col_map)
    return df


def get_stock_kline(symbol, days=250, adjust="qfq"):
    """
    获取股票K线数据（多数据源降级），统一返回中文列名
    数据源优先级: stock_zh_a_hist_tx -> stock_zh_a_hist -> stock_zh_a_daily
    """
    # 检查缓存（使用自适应TTL）
    cache_key = f"{symbol}_{days}_{adjust}"
    now_ts = time.time()
    adaptive_ttl = _get_adaptive_ttl("日K线" if days <= 60 else "历史K线")
    if cache_key in _KLINE_CACHE and cache_key in _KLINE_CACHE_TIME:
        if now_ts - _KLINE_CACHE_TIME[cache_key] < adaptive_ttl:
            _update_cache_stats(hit=True)
            return _KLINE_CACHE[cache_key].copy() if _KLINE_CACHE[cache_key] is not None else None

    _update_cache_stats(hit=False)

    if len(symbol) == 6:
        full_symbol = f"sh{symbol}" if symbol.startswith('6') else f"sz{symbol}"
    else:
        full_symbol = symbol

    end_date = datetime.now().strftime('%Y%m%d')
    start_date = (datetime.now() - timedelta(days=days + 30)).strftime('%Y%m%d')

    def _normalize_columns(df):
        """将列名统一为中文"""
        col_map = {}
        for c in df.columns:
            cl = str(c).lower().strip()
            if cl in ('open', '开盘'):
                col_map[c] = '开盘'
            elif cl in ('close', '收盘'):
                col_map[c] = '收盘'
            elif cl in ('high', '最高'):
                col_map[c] = '最高'
            elif cl in ('low', '最低'):
                col_map[c] = '最低'
            elif cl in ('volume', '成交量'):
                col_map[c] = '成交量'
            elif cl in ('amount', '成交额'):
                col_map[c] = '成交额'
            elif cl in ('date', '日期'):
                col_map[c] = '日期'
        if col_map:
            df = df.rename(columns=col_map)
        if '成交额' not in df.columns and '成交量' in df.columns and '收盘' in df.columns:
            df['成交额'] = df['成交量'] * df['收盘']
        return df

    # 数据源1: stock_zh_a_hist_tx (腾讯数据源)
    for attempt in range(2):
        try:
            df = ak.stock_zh_a_hist_tx(
                symbol=full_symbol, start_date=start_date, end_date=end_date, adjust=adjust
            )
            if df is not None and not df.empty and len(df) >= 2:
                df['date'] = pd.to_datetime(df['date'])
                df = _normalize_columns(df)
                df.set_index('日期', inplace=True)
                df = df.sort_index()
                _KLINE_CACHE[cache_key] = df.copy()
                _KLINE_CACHE_TIME[cache_key] = now_ts
                return df
        except Exception:
            pass
        time.sleep(0.3)

    # 数据源2: stock_zh_a_hist (东方财富数据源，新版API)
    for attempt in range(2):
        try:
            df = ak.stock_zh_a_hist(
                symbol=symbol, period="daily",
                start_date=start_date, end_date=end_date, adjust=adjust
            )
            if df is not None and not df.empty and len(df) >= 2:
                if '日期' in df.columns:
                    df['date'] = pd.to_datetime(df['日期'])
                elif 'date' in df.columns:
                    df['date'] = pd.to_datetime(df['date'])
                df = _normalize_columns(df)
                df.set_index('日期', inplace=True)
                df = df.sort_index()
                _KLINE_CACHE[cache_key] = df.copy()
                _KLINE_CACHE_TIME[cache_key] = now_ts
                return df
        except Exception:
            pass
        time.sleep(0.3)

    # 数据源3: stock_zh_a_daily (新浪数据源)
    for attempt in range(2):
        try:
            df = ak.stock_zh_a_daily(
                symbol=full_symbol, start_date=start_date, end_date=end_date, adjust=adjust
            )
            if df is not None and not df.empty and len(df) >= 2:
                if 'date' in df.columns:
                    df['date'] = pd.to_datetime(df['date'])
                df = _normalize_columns(df)
                df.set_index('日期', inplace=True)
                df = df.sort_index()
                _KLINE_CACHE[cache_key] = df.copy()
                _KLINE_CACHE_TIME[cache_key] = now_ts
                return df
        except Exception:
            pass
        time.sleep(0.3)

    return None


def get_realtime_quote(symbol):
    """
    获取实时行情（多数据源降级）
    数据源优先级: stock_zh_a_spot_em -> stock_bid_ask_em -> K线近似
    """
    # 数据源1: stock_zh_a_spot_em (东方财富实时行情)
    try:
        df = _get_spot_df()
        if df is not None and not df.empty:
            match = df[df['代码'] == symbol]
            if not match.empty:
                row = match.iloc[0]
                return {
                    "代码": symbol,
                    "名称": str(row.get('名称', '')),
                    "最新价": float(row.get('最新价', 0)),
                    "涨跌幅": float(row.get('涨跌幅', 0)),
                    "涨跌额": float(row.get('涨跌额', 0)),
                    "成交量": float(row.get('成交量', 0)),
                    "成交额": float(row.get('成交额', 0)),
                    "振幅": float(row.get('振幅', 0)),
                    "最高": float(row.get('最高', 0)),
                    "最低": float(row.get('最低', 0)),
                    "今开": float(row.get('今开', 0)),
                    "昨收": float(row.get('昨收', 0)),
                    "换手率": float(row.get('换手率', 0)),
                    "量比": float(row.get('量比', 0)),
                    "市盈率": float(row.get('市盈率-动态', 0)),
                    "市净率": float(row.get('市净率', 0)),
                    "总市值": float(row.get('总市值', 0)),
                    "流通市值": float(row.get('流通市值', 0)),
                    "60日涨跌幅": float(row.get('60日涨跌幅', 0)),
                    "年初至今涨跌幅": float(row.get('年初至今涨跌幅', 0)),
                }
    except Exception:
        pass

    # 数据源2: 通过K线数据近似实时价
    try:
        kline = get_stock_kline(symbol, days=5)
        if kline is not None and not kline.empty:
            latest = kline.iloc[-1]
            prev = kline.iloc[-2] if len(kline) > 1 else latest
            change_pct = (float(latest['收盘']) / float(prev['收盘']) - 1) * 100
            return {
                "代码": symbol,
                "名称": symbol,
                "最新价": float(latest['收盘']),
                "涨跌幅": round(change_pct, 2),
                "涨跌额": round(float(latest['收盘']) - float(prev['收盘']), 2),
                "成交量": float(latest.get('成交量', 0)),
                "成交额": float(latest.get('成交额', 0)) if '成交额' in latest.index else 0,
                "振幅": round((float(latest['最高']) - float(latest['最低'])) / float(prev['收盘']) * 100, 2) if float(prev['收盘']) > 0 else 0,
                "最高": float(latest['最高']),
                "最低": float(latest['最低']),
                "今开": float(latest['开盘']),
                "昨收": float(prev['收盘']),
                "换手率": 0,
                "量比": 0,
                "市盈率": 0,
                "市净率": 0,
                "总市值": 0,
                "流通市值": 0,
                "60日涨跌幅": 0,
                "年初至今涨跌幅": 0,
            }
    except Exception:
        pass

    return None


def get_index_kline(index_code, days=250):
    """
    获取指数K线数据（多数据源降级），统一返回中文列名
    数据源优先级: stock_zh_index_daily_em -> stock_zh_index_daily_tx
    """
    end_date = datetime.now().strftime('%Y%m%d')
    start_date = (datetime.now() - timedelta(days=days + 30)).strftime('%Y%m%d')

    def _normalize_columns(df):
        col_map = {}
        for c in df.columns:
            cl = str(c).lower().strip()
            if cl in ('open', '开盘'):
                col_map[c] = '开盘'
            elif cl in ('close', '收盘'):
                col_map[c] = '收盘'
            elif cl in ('high', '最高'):
                col_map[c] = '最高'
            elif cl in ('low', '最低'):
                col_map[c] = '最低'
            elif cl in ('volume', '成交量'):
                col_map[c] = '成交量'
            elif cl in ('amount', '成交额'):
                col_map[c] = '成交额'
            elif cl in ('date', '日期'):
                col_map[c] = '日期'
        if col_map:
            df = df.rename(columns=col_map)
        if '成交额' not in df.columns and '成交量' in df.columns and '收盘' in df.columns:
            df['成交额'] = df['成交量'] * df['收盘']
        return df

    # 数据源1: stock_zh_index_daily_em (东方财富)
    for attempt in range(2):
        try:
            df = ak.stock_zh_index_daily_em(symbol=index_code)
            if df is not None and not df.empty:
                df['date'] = pd.to_datetime(df['date'])
                df.set_index('date', inplace=True)
                df = df.sort_index()
                if start_date:
                    df = df[df.index >= pd.to_datetime(start_date)]
                if len(df) >= 30:
                    return _normalize_columns(df)
        except Exception:
            pass
        time.sleep(0.5)

    # 数据源2: stock_zh_index_daily_tx (腾讯)
    for attempt in range(2):
        try:
            df = ak.stock_zh_index_daily_tx(symbol=index_code)
            if df is not None and not df.empty:
                df['date'] = pd.to_datetime(df['date'])
                df.set_index('date', inplace=True)
                df = df.sort_index()
                if start_date:
                    df = df[df.index >= pd.to_datetime(start_date)]
                if len(df) >= 30:
                    return _normalize_columns(df)
        except Exception:
            pass
        time.sleep(0.5)

    return None


def get_market_overview():
    """
    获取市场概览（多数据源降级）
    """
    indices = {}
    market_stats = {}

    # 获取主要指数
    try:
        df = ak.stock_zh_index_spot_em()
        if df is not None and not df.empty:
            key_indices = {
                "上证指数": "000001",
                "深证成指": "399001",
                "创业板指": "399006",
                "科创50": "000688"
            }
            for name, code in key_indices.items():
                match = df[df['名称'].str.contains(name.replace('指数', '').replace('指', ''), na=False)]
                if not match.empty:
                    row = match.iloc[0]
                    indices[name] = {
                        "最新": float(row['最新价']),
                        "涨跌幅": float(row['涨跌幅']),
                        "涨跌额": float(row['涨跌额'])
                    }
    except Exception:
        pass

    # 备用：逐个获取指数日K线
    if not indices:
        index_map = {
            "上证指数": "sh000001",
            "深证成指": "sz399001",
            "创业板指": "sz399006",
            "科创50": "sh000688"
        }
        for name, code in index_map.items():
            try:
                kline = get_index_kline(code, days=5)
                if kline is not None and not kline.empty:
                    latest = kline.iloc[-1]
                    prev = kline.iloc[-2] if len(kline) > 1 else latest
                    change_pct = (float(latest['收盘']) / float(prev['收盘']) - 1) * 100
                    indices[name] = {
                        "最新": float(latest['收盘']),
                        "涨跌幅": round(change_pct, 2),
                        "涨跌额": round(float(latest['收盘']) - float(prev['收盘']), 2)
                    }
            except Exception:
                pass

    # 市场统计
    try:
        stock_df = _get_spot_df()
        if stock_df is not None and not stock_df.empty:
            up = int(len(stock_df[stock_df['涨跌幅'] > 0]))
            down = int(len(stock_df[stock_df['涨跌幅'] < 0]))
            flat = int(len(stock_df[stock_df['涨跌幅'] == 0]))
            limit_up = int(len(stock_df[stock_df['涨跌幅'] >= 9.5]))
            limit_down = int(len(stock_df[stock_df['涨跌幅'] <= -9.5]))
            total = up + down + flat

            market_stats = {
                "上涨家数": up,
                "下跌家数": down,
                "平盘家数": flat,
                "涨停家数": limit_up,
                "跌停家数": limit_down,
                "上涨比例": round(up / total * 100, 2) if total > 0 else 0
            }
    except Exception:
        pass

    return {
        "时间": datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        "主要指数": indices,
        "市场统计": market_stats
    }


def get_northbound_funds():
    """获取北向资金数据（多数据源降级）"""
    # 数据源1: stock_hsgt_hist_em（akshare 1.18.59 可用）
    for attempt in range(2):
        try:
            df = ak.stock_hsgt_hist_em(symbol="北向资金")
            if df is not None and not df.empty:
                print(f"[北向资金] 数据源1 stock_hsgt_hist_em 列名: {list(df.columns)}")
                df = df.tail(30)
                result = _parse_northbound_rows(df)
                if result:
                    return {"数据日期说明": get_data_date_note(), "数据": result}
        except Exception as e:
            print(f"[北向资金] 数据源1失败: {e}")
        time.sleep(0.3)

    # 数据源2: stock_hsgt_fund_flow_summary_em
    for attempt in range(2):
        try:
            df = ak.stock_hsgt_fund_flow_summary_em()
            if df is not None and not df.empty:
                print(f"[北向资金] 数据源2 stock_hsgt_fund_flow_summary_em 列名: {list(df.columns)}")
                result = _parse_northbound_rows(df)
                if result:
                    return {"数据日期说明": get_data_date_note(), "数据": result}
        except Exception as e:
            print(f"[北向资金] 数据源2失败: {e}")
        time.sleep(0.3)

    # 数据源3: 分别获取沪股通和深股通数据
    for attempt in range(2):
        try:
            sh_df = ak.stock_hsgt_hist_em(symbol="沪股通")
            sz_df = ak.stock_hsgt_hist_em(symbol="深股通")
            if sh_df is not None and not sh_df.empty and sz_df is not None and not sz_df.empty:
                print(f"[北向资金] 数据源3 沪股通列名: {list(sh_df.columns)}, 深股通列名: {list(sz_df.columns)}")
                sh_df = sh_df.tail(30)
                sz_df = sz_df.tail(30)
                result = _parse_split_northbound(sh_df, sz_df)
                if result:
                    return {"数据日期说明": get_data_date_note(), "数据": result}
        except Exception as e:
            print(f"[北向资金] 数据源3失败: {e}")
        time.sleep(0.3)

    # 数据源4: stock_hsgt_north_net_flow_in_em
    for attempt in range(2):
        try:
            df = ak.stock_hsgt_north_net_flow_in_em(symbol="北上")
            if df is not None and not df.empty:
                print(f"[北向资金] 数据源4 stock_hsgt_north_net_flow_in_em 列名: {list(df.columns)}")
                df = df.tail(30)
                result = _parse_northbound_rows(df)
                if result:
                    return {"数据日期说明": get_data_date_note(), "数据": result}
        except Exception as e:
            print(f"[北向资金] 数据源4失败: {e}")
        time.sleep(0.3)

    return {"数据": [], "数据日期说明": get_data_date_note()}


def _parse_split_northbound(sh_df, sz_df):
    """分别解析沪股通和深股通数据并合并"""
    result = []
    # 构建日期到深股通净流入的映射
    sz_map = {}
    for _, row in sz_df.iterrows():
        date_val = _find_col(row, ['日期', 'date', '时间', 'trade_date', 'day'])
        net_val = _find_col(row, ['当日成交净买额', '当日净流入', '净流入', 'value', 'net_flow',
                                   '资金净流入', '当日资金净流入', 'net_inflow', '净买入额',
                                   '当日净买入', '净买额'])
        sz_map[str(date_val)] = float(net_val) if pd.notna(net_val) else 0

    for _, row in sh_df.iterrows():
        date_val = _find_col(row, ['日期', 'date', '时间', 'trade_date', 'day'])
        net_val = _find_col(row, ['当日成交净买额', '当日净流入', '净流入', 'value', 'net_flow',
                                   '资金净流入', '当日资金净流入', 'net_inflow', '净买入额',
                                   '当日净买入', '净买额'])
        sh_flow = float(net_val) if pd.notna(net_val) else 0
        sz_flow = sz_map.get(str(date_val), 0)
        result.append({
            "日期": str(date_val),
            "当日净流入": sh_flow + sz_flow,
            "沪股通净流入": sh_flow,
            "深股通净流入": sz_flow
        })
    print(f"[北向资金] 分离解析完成，共{len(result)}条记录")
    return result


def _parse_northbound_rows(df):
    """解析北向资金数据行，自动识别列名"""
    result = []
    # 打印第一行数据用于调试
    if len(df) > 0:
        sample_row = df.iloc[0]
        print(f"[北向资金] 第一行数据: {dict(sample_row)}")
    for _, row in df.iterrows():
        date_val = _find_col(row, ['日期', 'date', '时间', 'trade_date', 'day'])
        net_val = _find_col(row, ['当日成交净买额', '当日净流入', '净流入', 'value', 'net_flow',
                                   '资金净流入', '当日资金净流入', '北向资金净流入', 'net_inflow',
                                   '沪股通净流入', '深股通净流入', '当日资金流入', '净买入额',
                                   '当日净买入', '北向净买入', 'north_net_flow', '净买额'])
        sh_val = _find_col(row, ['沪股通净流入', '沪股通', 'sh_net_flow', '沪股通买入',
                                  '沪股通净买入', '沪股通成交净买额'])
        sz_val = _find_col(row, ['深股通净流入', '深股通', 'sz_net_flow', '深股通买入',
                                  '深股通净买入', '深股通成交净买额'])

        # 如果当日净流入为0但沪股通和深股通有值，则求和
        net_flow = float(net_val) if pd.notna(net_val) else 0
        sh_flow = float(sh_val) if pd.notna(sh_val) else 0
        sz_flow = float(sz_val) if pd.notna(sz_val) else 0
        if net_flow == 0 and (sh_flow != 0 or sz_flow != 0):
            net_flow = sh_flow + sz_flow

        result.append({
            "日期": str(date_val),
            "当日净流入": net_flow,
            "沪股通净流入": sh_flow,
            "深股通净流入": sz_flow
        })
    print(f"[北向资金] 解析完成，共{len(result)}条记录，首条净流入={result[0]['当日净流入'] if result else 0}")
    return result


def _find_col(row, candidates):
    """在行数据中查找第一个匹配的候选列名"""
    for c in candidates:
        if c in row.index:
            val = row[c]
            if pd.notna(val):
                return val
    return 0


def get_industry_funds():
    """获取行业板块资金流向（多数据源降级）"""
    for attempt in range(2):
        try:
            df = ak.stock_sector_fund_flow_rank(indicator="今日", sector_type="行业资金流")
            if df is not None and not df.empty:
                print(f"[行业资金] 数据源1 stock_sector_fund_flow_rank 列名: {list(df.columns)}")
                df = df.head(20)
                result = _parse_industry_rows(df)
                if result:
                    return {"数据日期说明": get_data_date_note(), "数据": result}
        except Exception as e:
            print(f"[行业资金] 数据源1失败: {e}")
        time.sleep(0.5)

    for attempt in range(2):
        try:
            df = ak.stock_sector_fund_flow_summary(symbol="行业资金流向")
            if df is not None and not df.empty:
                print(f"[行业资金] 数据源2 stock_sector_fund_flow_summary 列名: {list(df.columns)}")
                df = df.head(20)
                result = _parse_industry_rows(df)
                if result:
                    return {"数据日期说明": get_data_date_note(), "数据": result}
        except Exception as e:
            print(f"[行业资金] 数据源2失败: {e}")
        time.sleep(0.5)

    for attempt in range(2):
        try:
            df = ak.stock_sector_fund_flow_rank(indicator="今日", sector_type="概念资金流")
            if df is not None and not df.empty:
                print(f"[行业资金] 数据源3 stock_sector_fund_flow_rank(概念) 列名: {list(df.columns)}")
                df = df.head(20)
                result = _parse_industry_rows(df)
                if result:
                    return {"数据日期说明": get_data_date_note(), "数据": result}
        except Exception as e:
            print(f"[行业资金] 数据源3失败: {e}")
        time.sleep(0.5)

    return {"数据": [], "数据日期说明": get_data_date_note()}


def _parse_industry_rows(df):
    """解析行业资金数据行，自动识别列名"""
    result = []
    for _, row in df.iterrows():
        name_val = _find_col(row, ['名称', '板块名称', '行业', '板块', 'name', 'sector_name'])
        chg_val = _find_col(row, ['涨跌幅', '涨幅', 'change_pct', 'pct_change', '涨跌'])
        inflow_val = _find_col(row, ['主力净流入-净额', '主力净流入', '净流入', '主力资金净流入',
                                       'net_inflow', 'main_net_inflow', '资金净流入'])
        ratio_val = _find_col(row, ['主力净流入-净占比', '主力净占比', '净占比', '主力净占比(%)',
                                      'net_inflow_ratio', 'inflow_ratio'])

        result.append({
            "板块名称": str(name_val),
            "涨跌幅": float(chg_val) if pd.notna(chg_val) else 0,
            "主力净流入": float(inflow_val) if pd.notna(inflow_val) else 0,
            "主力净占比": float(ratio_val) if pd.notna(ratio_val) else 0
        })
    return result


def get_industry_index_data(industry_code, days=250):
    """
    获取行业指数数据（多数据源降级），统一返回中文列名
    数据源优先级: index_hist_sw_tx -> stock_board_industry_index_ths -> ETF数据
    """
    end_date = datetime.now().strftime('%Y%m%d')
    start_date = (datetime.now() - timedelta(days=days + 60)).strftime('%Y%m%d')

    def _normalize_columns(df):
        col_map = {}
        for c in df.columns:
            cl = str(c).lower().strip()
            if cl in ('open', '开盘'):
                col_map[c] = '开盘'
            elif cl in ('close', '收盘'):
                col_map[c] = '收盘'
            elif cl in ('high', '最高'):
                col_map[c] = '最高'
            elif cl in ('low', '最低'):
                col_map[c] = '最低'
            elif cl in ('volume', '成交量'):
                col_map[c] = '成交量'
            elif cl in ('amount', '成交额'):
                col_map[c] = '成交额'
            elif cl in ('date', '日期'):
                col_map[c] = '日期'
        if col_map:
            df = df.rename(columns=col_map)
        if '成交额' not in df.columns and '成交量' in df.columns and '收盘' in df.columns:
            df['成交额'] = df['成交量'] * df['收盘']
        return df

    # 数据源1: index_hist_sw_tx (申万行业指数)
    for attempt in range(2):
        try:
            df = ak.index_hist_sw_tx(symbol=industry_code, start_date=start_date, end_date=end_date)
            if df is not None and not df.empty and len(df) >= 2:
                df['date'] = pd.to_datetime(df['date'])
                df.set_index('date', inplace=True)
                df = df.sort_index()
                return _normalize_columns(df)
        except Exception:
            pass
        time.sleep(0.5)

    # 数据源2: stock_board_industry_index_ths (同花顺行业指数)
    for attempt in range(2):
        try:
            df = ak.stock_board_industry_index_ths(symbol=industry_code, start_date=start_date, end_date=end_date)
            if df is not None and not df.empty and len(df) >= 2:
                df['date'] = pd.to_datetime(df['date'])
                df.set_index('date', inplace=True)
                df = df.sort_index()
                return _normalize_columns(df)
        except Exception:
            pass
        time.sleep(0.5)

    return None


def get_industry_etf_data(etf_code, days=250):
    """
    获取行业ETF数据（多数据源降级），统一返回中文列名
    """
    end_date = datetime.now().strftime('%Y%m%d')
    start_date = (datetime.now() - timedelta(days=days + 60)).strftime('%Y%m%d')

    def _normalize_columns(df):
        col_map = {}
        for c in df.columns:
            cl = str(c).lower().strip()
            if cl in ('open', '开盘'):
                col_map[c] = '开盘'
            elif cl in ('close', '收盘'):
                col_map[c] = '收盘'
            elif cl in ('high', '最高'):
                col_map[c] = '最高'
            elif cl in ('low', '最低'):
                col_map[c] = '最低'
            elif cl in ('volume', '成交量'):
                col_map[c] = '成交量'
            elif cl in ('amount', '成交额'):
                col_map[c] = '成交额'
            elif cl in ('date', '日期'):
                col_map[c] = '日期'
        if col_map:
            df = df.rename(columns=col_map)
        if '成交额' not in df.columns and '成交量' in df.columns and '收盘' in df.columns:
            df['成交额'] = df['成交量'] * df['收盘']
        return df

    # 数据源1: fund_etf_hist_em_tx
    for attempt in range(2):
        try:
            df = ak.fund_etf_hist_em_tx(symbol=etf_code, start_date=start_date, end_date=end_date, adjust="qfq")
            if df is not None and not df.empty and len(df) >= 2:
                df['date'] = pd.to_datetime(df['date'])
                df.set_index('date', inplace=True)
                df = df.sort_index()
                return _normalize_columns(df)
        except Exception:
            pass
        time.sleep(0.5)

    # 数据源2: fund_etf_hist_em
    for attempt in range(2):
        try:
            df = ak.fund_etf_hist_em(symbol=etf_code, period="daily",
                                     start_date=start_date, end_date=end_date, adjust="qfq")
            if df is not None and not df.empty and len(df) >= 2:
                if '日期' in df.columns:
                    df['date'] = pd.to_datetime(df['日期'])
                elif 'date' in df.columns:
                    df['date'] = pd.to_datetime(df['date'])
                df.set_index('date', inplace=True)
                df = df.sort_index()
                return df
        except Exception:
            pass
        time.sleep(0.5)

    return None


def get_financial_data(symbol):
    """
    获取财务数据（多数据源降级）
    """
    # 数据源1: stock_financial_abstract_ths
    try:
        df = ak.stock_financial_abstract_ths(symbol=symbol, indicator="按报告期")
        if df is not None and not df.empty:
            return df
    except Exception:
        pass

    # 数据源2: stock_financial_analysis_indicator
    try:
        df = ak.stock_financial_analysis_indicator(symbol=symbol)
        if df is not None and not df.empty:
            return df
    except Exception:
        pass

    return None


def get_market_breadth(date=None):
    """获取市场宽度数据 - 支持指定日期查询历史数据"""
    if date:
        return _get_market_breadth_by_date(date)

    for attempt in range(2):
        try:
            df = _get_spot_df()
            if df is None or df.empty:
                continue

            total = len(df)
            up_count = int((df['涨跌幅'] > 0).sum())
            down_count = int((df['涨跌幅'] < 0).sum())
            flat_count = int((df['涨跌幅'] == 0).sum())
            limit_up_count = int((df['涨跌幅'] >= 9.5).sum())
            limit_down_count = int((df['涨跌幅'] <= -9.5).sum())

            surge_up = int((df['涨跌幅'] >= 5).sum())
            big_up = int(((df['涨跌幅'] >= 3) & (df['涨跌幅'] < 5)).sum())
            small_up = int(((df['涨跌幅'] > 0) & (df['涨跌幅'] < 3)).sum())
            small_down = int(((df['涨跌幅'] < 0) & (df['涨跌幅'] >= -3)).sum())
            big_down = int(((df['涨跌幅'] < -3) & (df['涨跌幅'] >= -5)).sum())
            surge_down = int((df['涨跌幅'] <= -5).sum())

            total_amount = float(df['成交额'].sum()) if '成交额' in df.columns else 0
            avg_amount = total_amount / total if total > 0 else 0

            up_ratio = up_count / total * 100 if total > 0 else 0
            if up_ratio >= 70:
                sentiment = "极度乐观"
                sentiment_score = 90
            elif up_ratio >= 55:
                sentiment = "偏乐观"
                sentiment_score = 70
            elif up_ratio >= 45:
                sentiment = "中性"
                sentiment_score = 50
            elif up_ratio >= 30:
                sentiment = "偏悲观"
                sentiment_score = 30
            else:
                sentiment = "极度悲观"
                sentiment_score = 10

            return {
                "统计时间": datetime.now().strftime('%Y-%m-%d %H:%M'),
                "数据日期说明": get_data_date_note(),
                "总家数": total,
                "上涨家数": up_count,
                "下跌家数": down_count,
                "平盘家数": flat_count,
                "涨停家数": limit_up_count,
                "跌停家数": limit_down_count,
                "上涨比例": round(up_ratio, 2),
                "涨幅分布": {
                    "大涨(>=5%)": surge_up,
                    "中涨(3%-5%)": big_up,
                    "小涨(0%-3%)": small_up,
                    "小跌(0%-3%)": small_down,
                    "中跌(3%-5%)": big_down,
                    "大跌(<=-5%)": surge_down
                },
                "总成交额": round(total_amount / 100000000, 2),
                "平均成交额": round(avg_amount / 10000, 2),
                "市场情绪": sentiment,
                "情绪评分": sentiment_score
            }
        except Exception:
            pass
        time.sleep(0.5)

    return None


def _get_market_breadth_by_date(date_str):
    """根据指定日期获取历史市场宽度数据"""
    try:
        target_date = pd.to_datetime(date_str)

        if target_date.weekday() >= 5:
            weekday_names = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
            return {
                "统计时间": target_date.strftime('%Y-%m-%d'),
                "数据日期说明": f"{target_date.strftime('%Y-%m-%d')} {weekday_names[target_date.weekday()]} 休市",
                "休市": True,
                "总家数": 0, "上涨家数": 0, "下跌家数": 0, "平盘家数": 0,
                "涨停家数": 0, "跌停家数": 0, "上涨比例": 0,
                "涨幅分布": {}, "总成交额": 0, "平均成交额": 0,
                "市场情绪": "休市", "情绪评分": 0
            }

        result = {
            "统计时间": target_date.strftime('%Y-%m-%d'),
            "数据日期说明": f"历史数据({target_date.strftime('%Y-%m-%d')})",
            "总家数": 0, "上涨家数": 0, "下跌家数": 0, "平盘家数": 0,
            "涨停家数": 0, "跌停家数": 0, "上涨比例": 0,
            "涨幅分布": {}, "总成交额": 0, "平均成交额": 0,
            "市场情绪": "未知", "情绪评分": 0
        }

        has_data = False
        try:
            activity_df = ak.stock_market_activity_legu()
            if activity_df is not None and not activity_df.empty:
                activity_dict = dict(zip(activity_df['item'], activity_df['value']))

                up_count = int(activity_dict.get('上涨', 0))
                down_count = int(activity_dict.get('下跌', 0))
                flat_count = int(activity_dict.get('平盘', 0))
                limit_up_count = int(activity_dict.get('涨停', 0))
                limit_down_count = int(activity_dict.get('跌停', 0))
                total = up_count + down_count + flat_count

                # 涨幅分布从实时行情计算
                surge_up = big_up = small_up = small_down = big_down = surge_down = 0
                total_amount = 0
                try:
                    spot_df = _get_spot_df()
                    if spot_df is not None and not spot_df.empty:
                        surge_up = int((spot_df['涨跌幅'] >= 5).sum())
                        big_up = int(((spot_df['涨跌幅'] >= 3) & (spot_df['涨跌幅'] < 5)).sum())
                        small_up = int(((spot_df['涨跌幅'] > 0) & (spot_df['涨跌幅'] < 3)).sum())
                        small_down = int(((spot_df['涨跌幅'] < 0) & (spot_df['涨跌幅'] >= -3)).sum())
                        big_down = int(((spot_df['涨跌幅'] < -3) & (spot_df['涨跌幅'] >= -5)).sum())
                        surge_down = int((spot_df['涨跌幅'] <= -5).sum())
                        total_amount = float(spot_df['成交额'].sum()) if '成交额' in spot_df.columns else 0
                except Exception:
                    pass

                avg_amount = total_amount / total if total > 0 else 0

                up_ratio = up_count / total * 100 if total > 0 else 0
                if up_ratio >= 70:
                    sentiment = "极度乐观"
                    sentiment_score = 90
                elif up_ratio >= 55:
                    sentiment = "偏乐观"
                    sentiment_score = 70
                elif up_ratio >= 45:
                    sentiment = "中性"
                    sentiment_score = 50
                elif up_ratio >= 30:
                    sentiment = "偏悲观"
                    sentiment_score = 30
                else:
                    sentiment = "极度悲观"
                    sentiment_score = 10

                result.update({
                    "总家数": total, "上涨家数": up_count, "下跌家数": down_count,
                    "平盘家数": flat_count, "涨停家数": limit_up_count,
                    "跌停家数": limit_down_count, "上涨比例": round(up_ratio, 2),
                    "涨幅分布": {
                        "大涨(>=5%)": surge_up, "中涨(3%-5%)": big_up,
                        "小涨(0%-3%)": small_up, "小跌(0%-3%)": small_down,
                        "中跌(3%-5%)": big_down, "大跌(<=-5%)": surge_down
                    },
                    "总成交额": round(total_amount / 100000000, 2),
                    "平均成交额": round(avg_amount / 10000, 2),
                    "市场情绪": sentiment, "情绪评分": sentiment_score
                })
                has_data = True
        except Exception as e:
            print(f"[市场宽度] stock_market_activity_legu 失败: {e}")

        if not has_data:
            result["数据日期说明"] = f"{target_date.strftime('%Y-%m-%d')} 可能为节假日休市，无交易数据"
            result["休市"] = True

        return result
    except Exception as e:
        print(f"[市场宽度] _get_market_breadth_by_date 异常: {e}")
        return {"error": str(e)}


def get_stock_name(symbol):
    """获取股票名称"""
    try:
        df = ak.stock_zh_a_spot_em()
        if df is not None and not df.empty:
            match = df[df['代码'] == symbol]
            if not match.empty:
                return str(match.iloc[0]['名称'])
    except Exception:
        pass

    name_map = {
        "600519": "贵州茅台", "000001": "平安银行", "002594": "比亚迪",
        "300750": "宁德时代", "600036": "招商银行", "601318": "中国平安",
        "601398": "工商银行", "601939": "建设银行", "000858": "五粮液",
        "000568": "泸州老窖", "600809": "山西汾酒", "002466": "天齐锂业",
        "300014": "亿纬锂能", "300782": "卓胜微", "688981": "中芯国际",
        "603986": "兆易创新", "600887": "伊利股份", "000333": "美的集团",
        "000651": "格力电器", "600309": "万华化学"
    }
    return name_map.get(symbol, symbol)


def is_trading_day(check_date=None):
    """判断是否为交易日（基于真实交易日历）"""
    try:
        import akshare as ak
        import pandas as pd
        df = ak.tool_trade_date_hist_sina()
        trade_dates = set(pd.to_datetime(df['trade_date']).dt.date.tolist())

        if check_date is None:
            check_date = datetime.now().date()
        elif isinstance(check_date, datetime):
            check_date = check_date.date()
        elif isinstance(check_date, str):
            check_date = check_date.replace('-', '').replace('/', '')
            check_date = date(int(check_date[:4]), int(check_date[4:6]), int(check_date[6:8]))

        return check_date in trade_dates
    except Exception:
        today = datetime.now()
        return today.weekday() < 5


def get_data_date_note():
    """获取数据日期说明"""
    today = datetime.now()
    if not is_trading_day(today):
        weekday_names = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
        if today.weekday() >= 5:
            return f"今日{weekday_names[today.weekday()]}休市，数据为最近交易日数据"
        else:
            return f"今日节假日休市，数据为最近交易日数据"
    return ""


def get_market_status():
    """获取当前市场状态（是否开盘、休市原因等）"""
    now = datetime.now()
    weekday = now.weekday()
    hour = now.hour
    minute = now.minute
    current_time = now.strftime('%H:%M')

    weekday_names = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]

    result = {
        "当前时间": now.strftime('%Y-%m-%d %H:%M:%S'),
        "星期": weekday_names[weekday],
        "是否开盘": False,
        "状态": "休市",
        "状态描述": "",
        "状态类型": "closed",
        "距离开盘": "",
        "距收盘": ""
    }

    # 周末休市
    if weekday >= 5:
        result["状态描述"] = f"今日{weekday_names[weekday]}，A股市场休市"
        result["状态类型"] = "weekend"
        return result

    # 尝试获取交易日历判断是否为节假日
    try:
        trade_cal = ak.tool_trade_date_hist_sina()
        if trade_cal is not None and not trade_cal.empty:
            today_str = now.strftime('%Y-%m-%d')
            trade_dates = trade_cal['trade_date'].astype(str).tolist()
            if today_str not in trade_dates:
                result["状态描述"] = "今日为节假日，A股市场休市"
                result["状态类型"] = "holiday"
                return result
    except Exception:
        pass

    # 盘前（0:00 - 9:15）
    if hour < 9 or (hour == 9 and minute < 15):
        result["状态描述"] = "盘前竞价阶段，尚未开盘"
        result["状态类型"] = "pre_open"
        result["距离开盘"] = "约15分钟后开盘"
        return result

    # 集合竞价（9:15 - 9:25）
    if hour == 9 and 15 <= minute < 25:
        result["状态描述"] = "集合竞价阶段"
        result["状态类型"] = "auction"
        result["距离开盘"] = "约5分钟后连续竞价"
        return result

    # 早盘交易（9:30 - 11:30）
    if (hour == 9 and minute >= 30) or hour == 10 or (hour == 11 and minute <= 30):
        result["是否开盘"] = True
        result["状态"] = "交易中"
        result["状态描述"] = "早盘交易中"
        result["状态类型"] = "morning"
        if hour == 11 and minute >= 0:
            remain = 30 - minute
            result["距收盘"] = f"距早盘收盘约{remain}分钟"
        return result

    # 午间休市（11:30 - 13:00）
    if (hour == 11 and minute > 30) or hour == 12:
        result["状态描述"] = "午间休市，13:00恢复交易"
        result["状态类型"] = "lunch_break"
        result["距离开盘"] = "约13:00恢复交易"
        return result

    # 午盘交易（13:00 - 15:00）
    if hour == 13 or hour == 14:
        result["是否开盘"] = True
        result["状态"] = "交易中"
        result["状态描述"] = "午盘交易中"
        result["状态类型"] = "afternoon"
        if hour == 14 and minute >= 30:
            remain = 60 - minute
            result["距收盘"] = f"距收盘约{remain}分钟"
        return result

    # 盘后（15:00 - 24:00）
    result["状态描述"] = "今日交易已结束，市场已收盘"
    result["状态类型"] = "after_close"
    return result


def fetch_with_fallback(fetch_funcs, max_retries=2, retry_delay=0.5, default=None):
    """
    通用数据获取容错函数，按优先级依次尝试多个数据源

    参数:
        fetch_funcs: 数据获取函数列表，按优先级排列，每个元素为 (func, args, kwargs) 或 func
        max_retries: 每个数据源的最大重试次数
        retry_delay: 重试间隔（秒）
        default: 所有数据源都失败时的默认返回值

    返回: 第一个成功获取的数据，或 default

    使用示例:
        data = fetch_with_fallback([
            (ak.stock_zh_a_hist, (symbol,), {"period": "daily"}),
            (ak.stock_zh_a_hist_tx, (symbol,), {}),
        ])
    """
    for i, func_entry in enumerate(fetch_funcs):
        if callable(func_entry) and not isinstance(func_entry, tuple):
            func = func_entry
            args = ()
            kwargs = {}
        elif isinstance(func_entry, tuple):
            func = func_entry[0]
            args = func_entry[1] if len(func_entry) > 1 else ()
            kwargs = func_entry[2] if len(func_entry) > 2 else {}
        else:
            continue

        for attempt in range(max_retries + 1):
            try:
                result = func(*args, **kwargs)
                if result is not None:
                    if hasattr(result, 'empty') and result.empty:
                        if attempt < max_retries:
                            time.sleep(retry_delay)
                            continue
                    return result
            except Exception as e:
                if attempt < max_retries:
                    time.sleep(retry_delay)
                    continue

    return default


def safe_float(value, default=0.0):
    """安全转换为float，转换失败返回默认值"""
    try:
        return float(value)
    except (ValueError, TypeError):
        return default


def safe_int(value, default=0):
    """安全转换为int，转换失败返回默认值"""
    try:
        return int(float(value))
    except (ValueError, TypeError):
        return default


def safe_str(value, default=""):
    """安全转换为str，转换失败返回默认值"""
    try:
        return str(value) if value is not None else default
    except (ValueError, TypeError):
        return default


# ==================== DataProvider 统一数据抽象层 ====================

class DataProvider:
    """
    统一数据提供者，封装所有数据获取逻辑
    支持多数据源降级、数据质量检查、速率限制
    """

    def __init__(self):
        self._rate_limit_tracker = {}
        self._min_interval = 0.3

    def _rate_limit(self, source_name="default"):
        """简单的速率限制，避免请求过快"""
        now = time.time()
        last = self._rate_limit_tracker.get(source_name, 0)
        elapsed = now - last
        if elapsed < self._min_interval:
            time.sleep(self._min_interval - elapsed)
        self._rate_limit_tracker[source_name] = time.time()

    def get_stock_kline(self, symbol, days=250, adjust="qfq"):
        """获取股票K线数据"""
        self._rate_limit("kline")
        result = get_stock_kline(symbol, days, adjust)
        return self._validate_kline(result, symbol)

    def get_realtime_quote(self, symbol):
        """获取实时行情"""
        self._rate_limit("quote")
        return get_realtime_quote(symbol)

    def get_market_overview(self):
        """获取市场概览"""
        self._rate_limit("market")
        return get_market_overview()

    def get_market_status(self):
        """获取市场状态"""
        return get_market_status()

    def get_northbound_funds(self):
        """获取北向资金"""
        self._rate_limit("northbound")
        return get_northbound_funds()

    def get_industry_funds(self):
        """获取行业资金流向"""
        self._rate_limit("industry")
        return get_industry_funds()

    def get_index_kline(self, index_code, days=250):
        """获取指数K线"""
        self._rate_limit("index")
        return get_index_kline(index_code, days)

    def get_market_breadth(self, date=None):
        """获取市场宽度"""
        self._rate_limit("breadth")
        return get_market_breadth(date)

    def get_stock_name(self, symbol):
        """获取股票名称"""
        return get_stock_name(symbol)

    def is_trading_day(self, check_date=None):
        """判断是否为交易日"""
        return is_trading_day(check_date)

    def get_cache_stats(self):
        """获取缓存统计"""
        return get_cache_stats()

    def clear_expired_cache(self):
        """清理过期缓存"""
        return clear_expired_cache()

    @staticmethod
    def _validate_kline(df, symbol):
        """验证K线数据质量"""
        if df is None:
            return {"error": f"无法获取 {symbol} 的K线数据", "data": None, "quality": "failed"}

        if df.empty:
            return {"error": f"{symbol} K线数据为空", "data": None, "quality": "empty"}

        issues = []

        if len(df) < 5:
            issues.append(f"数据量过少（仅{len(df)}条）")

        null_counts = df.isnull().sum()
        for col, count in null_counts.items():
            if count > 0:
                issues.append(f"列'{col}'存在{count}个缺失值")

        if '收盘' in df.columns:
            zero_close = (df['收盘'] == 0).sum()
            if zero_close > 0:
                issues.append(f"存在{zero_close}条收盘价为0的记录")

            price_changes = df['收盘'].pct_change().dropna()
            extreme_changes = (abs(price_changes) > 0.2).sum()
            if extreme_changes > 0:
                issues.append(f"存在{extreme_changes}条异常涨跌（>20%）")

        quality = "good" if len(issues) == 0 else "warning"

        return {
            "data": df,
            "quality": quality,
            "issues": issues,
            "record_count": len(df),
            "date_range": f"{df.index[0]} ~ {df.index[-1]}" if hasattr(df.index[0], 'strftime') else "N/A",
        }

    def validate_dataframe(self, df, name="数据"):
        """通用DataFrame质量检查"""
        if df is None:
            return {"valid": False, "issues": [f"{name}为None"], "quality": "failed"}

        if df.empty:
            return {"valid": False, "issues": [f"{name}为空"], "quality": "empty"}

        issues = []

        null_ratio = df.isnull().sum().sum() / (df.shape[0] * df.shape[1]) if df.shape[0] > 0 else 0
        if null_ratio > 0.1:
            issues.append(f"{name}缺失值比例过高（{round(null_ratio * 100, 1)}%）")

        if df.shape[0] < 3:
            issues.append(f"{name}数据量过少（仅{df.shape[0]}条）")

        quality = "good" if len(issues) == 0 else "warning"

        return {
            "valid": True,
            "quality": quality,
            "issues": issues,
            "shape": df.shape,
            "columns": list(df.columns),
        }


_data_provider = None


def get_data_provider() -> DataProvider:
    """获取全局DataProvider单例"""
    global _data_provider
    if _data_provider is None:
        _data_provider = DataProvider()
    return _data_provider
