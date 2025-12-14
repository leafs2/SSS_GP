"""
Algorithm Service - Main Application Entry Point

This is the main FastAPI application that serves as the entry point
for all algorithm-related services.

Usage:
    uvicorn app.main:app --reload --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api import health, assignment, scheduling  # 新增 scheduling

# 創建 FastAPI 應用實例
app = FastAPI(
    title="Algorithm Service",
    description="手術室排程演算法服務 - 提供護士排班、手術室分配、TS-HSO排程等演算法",
    version="1.0.0"
)

# 配置 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 註冊 API 路由
app.include_router(health.router)
app.include_router(assignment.router)
app.include_router(scheduling.router)  # 新增：註冊排程路由


@app.get("/")
async def root():
    """
    根端點
    
    Returns:
        基本服務資訊
    """
    return {
        "service": "Algorithm Service",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
        "health": "/api/health",
        "algorithms": {
            "hungarian": "/api/assignment",
            "tshso_scheduling": "/api/scheduling"
        }
    }


@app.on_event("startup")
async def startup_event():
    """應用啟動事件"""
    print("🚀 Algorithm Service 啟動中...")
    print("📊 可用演算法:")
    print("   - 匈牙利演算法 (護士排班)")
    print("   - TS-HSO 演算法 (手術排程)")
    print("📖 API 文件: http://localhost:8000/docs")


@app.on_event("shutdown")
async def shutdown_event():
    """應用關閉事件"""
    print("👋 Algorithm Service 關閉中...")