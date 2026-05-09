#!/usr/bin/env python3
"""
路由蓝图注册中心
将所有子路由蓝图注册到 Flask app
"""
from .market import market_bp
from .stock import stock_bp
from .portfolio import portfolio_bp
from .backtest import backtest_bp
from .trading import trading_bp
from .risk import risk_bp
from .ai import ai_bp
from .auth import auth_bp
from .scheduler import scheduler_bp
from .factor import factor_bp
from .attribution import attribution_bp
from .notify import notify_bp
from .skills import skills_bp
from .data_quality import data_quality_bp


def register_routes(app):
    """将所有蓝图注册到 Flask app"""
    app.register_blueprint(market_bp)
    app.register_blueprint(stock_bp)
    app.register_blueprint(portfolio_bp)
    app.register_blueprint(backtest_bp)
    app.register_blueprint(trading_bp)
    app.register_blueprint(risk_bp)
    app.register_blueprint(ai_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(scheduler_bp)
    app.register_blueprint(factor_bp)
    app.register_blueprint(attribution_bp)
    app.register_blueprint(notify_bp)
    app.register_blueprint(skills_bp)
    app.register_blueprint(data_quality_bp)