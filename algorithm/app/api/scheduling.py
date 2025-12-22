"""
algorithm/app/api/scheduling.py
手術排程 API 路由 (FastAPI) - 使用獨立排程器
"""

from fastapi import APIRouter, HTTPException, status
from typing import List, Dict, Optional
from datetime import datetime, date
from pydantic import BaseModel

from app.algorithms.TS_HSO.scheduler_standalone import StandaloneScheduler
from app.models.scheduling import Surgery, ScheduleResult

router = APIRouter(prefix="/api/scheduling", tags=["scheduling"])


# === Pydantic 模型 ===

class SurgeryInput(BaseModel):
    """手術輸入資料"""
    surgery_id: str
    doctor_id: str
    assistant_doctor_id: Optional[str] = None
    surgery_type_code: str
    patient_id: int
    surgery_room_type: str
    surgery_date: date
    duration: float
    nurse_count: int


class RoomInfo(BaseModel):
    """手術室資訊"""
    id: str
    room_type: str
    nurse_count: int
    morning_shift: bool
    night_shift: bool
    graveyard_shift: bool


class ExistingSchedule(BaseModel):
    """現有排程資訊"""
    surgery_id: str
    room_id: str
    scheduled_date: date
    start_time: str  # "HH:MM" or "HH:MM:SS"
    end_time: str
    cleanup_end_time: str


class SchedulingRequest(BaseModel):
    """排程請求"""
    surgeries: List[SurgeryInput]
    available_rooms: List[RoomInfo]
    existing_schedules: Optional[List[ExistingSchedule]] = []
    doctor_schedules: Optional[Dict[str, Dict[str, str]]] = {}
    config: Optional[Dict] = {}


class SchedulingResponse(BaseModel):
    """排程回應"""
    success: bool
    message: str
    results: List[Dict]
    failed_surgeries: List[str] = []
    statistics: Optional[Dict] = {}


# === API 端點 ===

@router.post("/trigger", response_model=SchedulingResponse)
async def trigger_scheduling(request: SchedulingRequest):
    """
    執行完整排程
    
    Args:
        request: 包含待排程手術、可用手術室、現有排程
    
    Returns:
        排程結果
    """
    try:
        if not request.surgeries:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="手術列表不能為空"
            )
        
        if not request.available_rooms:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="手術室列表不能為空"
            )
        
        # 轉換為內部模型
        surgeries = [
            Surgery(
                surgery_id=s.surgery_id,
                doctor_id=s.doctor_id,
                assistant_doctor_id=s.assistant_doctor_id,
                surgery_type_code=s.surgery_type_code,
                patient_id=s.patient_id,
                surgery_room_type=s.surgery_room_type,
                surgery_date=s.surgery_date,
                duration=s.duration,
                nurse_count=s.nurse_count
            )
            for s in request.surgeries
        ]
        
        # 轉換手術室資訊
        available_rooms = [room.dict() for room in request.available_rooms]
        
        # 轉換現有排程
        existing_schedules = [
            {
                'surgery_id': s.surgery_id,
                'room_id': s.room_id,
                'scheduled_date': s.scheduled_date,
                'start_time': s.start_time,
                'end_time': s.end_time,
                'cleanup_end_time': s.cleanup_end_time
            }
            for s in request.existing_schedules
        ] if request.existing_schedules else []
        
        # 建立獨立排程器
        scheduler = StandaloneScheduler(
            available_rooms=available_rooms,
            existing_schedules=existing_schedules,
            config=request.config,
            doctor_schedules=request.doctor_schedules
        )
        
        # 執行排程
        results, failed = scheduler.schedule(surgeries)
        
        # 序列化結果
        serialized_results = [r.to_dict() for r in results]
        
        # 計算統計
        statistics = {
            'total_surgeries': len(surgeries),
            'successful': len(results),
            'failed': len(failed),
            'success_rate': (len(results) / len(surgeries) * 100) if surgeries else 0,
            'utilization_rate': scheduler.calculate_utilization()
        }
        
        return SchedulingResponse(
            success=True,
            message=f"排程完成，成功排定 {len(results)} 台手術",
            results=serialized_results,
            failed_surgeries=[s.surgery_id for s in failed],
            statistics=statistics
        )
    
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"排程執行失敗: {str(e)}"
        )


@router.get("/health")
async def scheduling_health():
    """健康檢查"""
    return {
        "status": "healthy",
        "service": "TS-HSO Scheduling",
        "version": "1.0.0",
        "algorithms": ["GA", "Greedy", "AHP"],
        "mode": "standalone"
    }