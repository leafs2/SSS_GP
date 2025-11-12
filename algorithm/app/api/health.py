"""
Health Check API

Provides endpoints for monitoring service health and status.

Endpoints:
    GET /api/health - Basic health check
    GET /api/health/detailed - Detailed health information
"""

from fastapi import APIRouter
from datetime import datetime

router = APIRouter(prefix="/api/health", tags=["health"])


@router.get(
    "",
    summary="基本健康檢查",
    description="檢查服務是否正常運行"
)
async def health_check():
    """
    基本健康檢查
    
    Returns:
        服務狀態資訊
    """
    return {
        "status": "healthy",
        "service": "Algorithm Service",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat()
    }


@router.get(
    "/detailed",
    summary="詳細健康檢查",
    description="檢查服務詳細狀態和可用演算法"
)
async def detailed_health_check():
    """
    詳細健康檢查
    
    Returns:
        詳細的服務狀態資訊，包括可用演算法列表
    """
    return {
        "status": "healthy",
        "service": "Algorithm Service",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat(),
        "algorithms": {
            "assignment": {
                "hungarian": "available",
                "description": "匈牙利演算法 - 護士最佳化分配"
            },
            "scheduling": {
                "rotation": "in_development",
                "description": "輪班調整演算法"
            },
            "optimization": {
                "status": "planned",
                "description": "通用最佳化演算法"
            }
        },
        "dependencies": {
            "numpy": "available",
            "scipy": "available",
            "fastapi": "available"
        }
    }