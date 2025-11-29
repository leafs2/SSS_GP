"""
Assignment API - Enhanced with Float Nurse Scheduling

匈牙利演算法分配相關的 API 端點（含流動護士排班）
"""

from fastapi import APIRouter, HTTPException, status
from typing import List, Dict
from ..models.assignment import (
    HungarianAssignmentRequest,
    HungarianAssignmentResponse,
    FloatNurseScheduleRequest,
    FloatNurseScheduleResponse
)
from ..algorithms.assignment.hungarian_solver import HungarianSolver
from ..algorithms.assignment.float_nurse_scheduler import FloatNurseScheduler

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
    匈牙利演算法護士分配（固定護士）
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
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"演算法執行失敗: {str(e)}"
        )


@router.post(
    "/float-nurse-schedule",
    response_model=FloatNurseScheduleResponse,
    summary="流動護士排班",
    description="根據固定護士的休假情況，分配流動護士填補空缺"
)
async def float_nurse_schedule(
    request: FloatNurseScheduleRequest
) -> FloatNurseScheduleResponse:
    """
    流動護士排班
    
    在固定護士分配完成後，計算每日空缺並分配流動護士
    """
    try:
        if not request.float_nurses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="流動護士列表不能為空"
            )
        
        if not request.fixed_assignments:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="固定護士分配結果不能為空"
            )
        
        # 創建流動護士排班器
        scheduler = FloatNurseScheduler()
        
        # 步驟 1: 計算每日空缺
        vacancies = scheduler.calculate_daily_vacancies(
            fixed_assignments=request.fixed_assignments,
            room_requirements=request.room_requirements
        )
        
        # 步驟 2: 分配流動護士
        strategy = request.config.get("strategy", "balanced") if request.config else "balanced"
        
        assignments = scheduler.assign_float_nurses(
            float_nurses=request.float_nurses,
            vacancies=vacancies,
            strategy=strategy
        )
        
        # 步驟 3: 格式化結果
        schedule_records = scheduler.format_float_schedule(assignments)
        
        # 步驟 4: 生成報告
        report = scheduler.generate_float_schedule_report(
            assignments=assignments,
            float_nurses=request.float_nurses
        )
        
        return FloatNurseScheduleResponse(
            success=True,
            schedule=schedule_records,
            vacancies=vacancies,
            summary=report
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"流動護士排班失敗: {str(e)}"
        )


@router.get(
    "/health",
    summary="健康檢查",
    description="檢查分配服務是否正常運行"
)
async def assignment_health():
    """
    分配服務健康檢查
    """
    return {
        "status": "healthy",
        "service": "assignment",
        "algorithms": ["hungarian", "float_nurse_schedule"],
        "version": "2.0.0"
    }