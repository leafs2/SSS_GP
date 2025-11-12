"""
Assignment API

匈牙利演算法分配相關的 API 端點
"""

from fastapi import APIRouter, HTTPException, status
from ..models.assignment import (
    HungarianAssignmentRequest,
    HungarianAssignmentResponse
)
from ..algorithms.assignment.hungarian_solver import HungarianSolver

router = APIRouter(prefix="/api/assignment", tags=["assignment"])


@router.post(
    "/hungarian",
    response_model=HungarianAssignmentResponse,
    summary="匈牙利演算法護士分配",
    description="使用匈牙利演算法將護士最佳化分配到手術室"
)
async def hungarian_assignment(
    request: HungarianAssignmentRequest
) -> HungarianAssignmentResponse:
    """
    匈牙利演算法護士分配
    
    根據成本矩陣（考慮熟悉度、工作負荷、資歷匹配）
    將護士最佳化分配到手術室職位
    
    Args:
        request: 分配請求（包含護士、手術室、配置）
        
    Returns:
        分配結果（包含護士分配、手術室摘要、成本資訊）
        
    Raises:
        HTTPException: 當輸入資料不合法或演算法執行失敗時
    """
    try:
        # 驗證輸入資料
        if not request.nurses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="護士列表不能為空"
            )
        
        if not request.rooms:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="手術室列表不能為空"
            )
        
        # 驗證護士和手術室的類型是否一致
        nurse_room_types = {nurse.room_type for nurse in request.nurses}
        room_room_types = {room.room_type for room in request.rooms}
        
        if nurse_room_types != room_room_types:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"護士手術室類型 {nurse_room_types} 與手術室類型 {room_room_types} 不一致"
            )
        
        # 計算總需求
        total_positions = sum(room.require_nurses for room in request.rooms)
        total_nurses = len(request.nurses)
        
        # 驗證人數是否足夠
        if total_nurses < total_positions:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"護士人數不足：需要 {total_positions} 人，但只有 {total_nurses} 人"
            )
        
        # 獲取配置
        config = request.config or {}
        cost_weights = config.get("cost_weights", {})
        
        # 創建求解器
        solver = HungarianSolver(
            familiarity_weight=cost_weights.get("familiarity", 0.5),
            workload_weight=cost_weights.get("workload", 0.3),
            experience_weight=cost_weights.get("experience", 0.2)
        )
        
        # 執行分配
        response = solver.assign(
            nurses=request.nurses,
            rooms=request.rooms
        )
        
        return response
        
    except HTTPException:
        # 重新拋出 HTTP 異常
        raise
    except Exception as e:
        # 捕獲其他異常並回傳 500 錯誤
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"演算法執行失敗: {str(e)}"
        )


@router.get(
    "/health",
    summary="健康檢查",
    description="檢查分配服務是否正常運行"
)
async def assignment_health():
    """
    分配服務健康檢查
    
    Returns:
        服務狀態資訊
    """
    return {
        "status": "healthy",
        "service": "assignment",
        "algorithms": ["hungarian"],
        "version": "1.0.0"
    }