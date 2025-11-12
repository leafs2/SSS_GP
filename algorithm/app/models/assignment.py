"""
Hungarian Algorithm Request and Response Models

匈牙利演算法 API 的請求和回應模型
"""

from pydantic import BaseModel, Field
from typing import List, Dict, Optional
from .nurse import NurseInput, NurseAssignment
from .room import SurgeryRoomInput, RoomAssignmentSummary


class CostWeights(BaseModel):
    """
    成本權重配置
    """
    familiarity: float = Field(0.5, ge=0.0, le=1.0, description="熟悉度權重")
    workload: float = Field(0.3, ge=0.0, le=1.0, description="工作負荷權重")
    experience: float = Field(0.2, ge=0.0, le=1.0, description="資歷匹配權重")
    
    class Config:
        json_schema_extra = {
            "example": {
                "familiarity": 0.5,
                "workload": 0.3,
                "experience": 0.2
            }
        }


class HungarianAssignmentRequest(BaseModel):
    """
    匈牙利演算法分配請求模型
    """
    shift: str = Field(..., description="時段 (早班/晚班/大夜)")
    room_type: str = Field(..., description="手術室類型 (RSU/RSP/RD/RE)")
    nurses: List[NurseInput] = Field(..., description="護士列表")
    rooms: List[SurgeryRoomInput] = Field(..., description="手術室列表")
    
    config: Optional[Dict] = Field(
        default_factory=lambda: {
            "cost_weights": {
                "familiarity": 0.5,
                "workload": 0.3,
                "experience": 0.2
            },
            "allow_partial_assignment": False
        },
        description="演算法配置"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "shift": "早班",
                "room_type": "RSU",
                "nurses": [
                    {
                        "employee_id": "NOT0001",
                        "name": "張小明",
                        "room_type": "RSU",
                        "scheduling_time": "早班",
                        "last_assigned_room": "RSU01",
                        "workload_this_week": 3,
                        "experience_years": 5
                    }
                ],
                "rooms": [
                    {
                        "room_id": "RSU01",
                        "room_type": "RSU",
                        "require_nurses": 3,
                        "complexity": "high",
                        "recent_activity": 0.85
                    }
                ],
                "config": {
                    "cost_weights": {
                        "familiarity": 0.5,
                        "workload": 0.3,
                        "experience": 0.2
                    },
                    "allow_partial_assignment": False
                }
            }
        }


class AssignmentMetadata(BaseModel):
    """
    分配結果的元資料
    """
    algorithm: str = Field(default="hungarian", description="使用的演算法")
    execution_time: float = Field(..., description="執行時間 (秒)")
    optimal_solution: bool = Field(..., description="是否為最佳解")
    total_nurses: int = Field(..., description="總護士數")
    total_positions: int = Field(..., description="總職位數")
    
    class Config:
        json_schema_extra = {
            "example": {
                "algorithm": "hungarian",
                "execution_time": 0.08,
                "optimal_solution": True,
                "total_nurses": 23,
                "total_positions": 23
            }
        }


class HungarianAssignmentResponse(BaseModel):
    """
    匈牙利演算法分配回應模型
    """
    success: bool = Field(..., description="是否成功")
    assignments: List[NurseAssignment] = Field(..., description="護士分配結果列表")
    room_assignments: Dict[str, RoomAssignmentSummary] = Field(..., description="手術室分配摘要")
    total_cost: float = Field(..., description="總成本")
    metadata: AssignmentMetadata = Field(..., description="元資料")
    
    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "assignments": [
                    {
                        "employee_id": "NOT0001",
                        "nurse_name": "張小明",
                        "assigned_room": "RSU01",
                        "position": 1,
                        "cost": 0.5,
                        "reasons": ["high_familiarity", "balanced_workload"]
                    }
                ],
                "room_assignments": {
                    "RSU01": {
                        "room_id": "RSU01",
                        "nurses": ["NOT0001", "NOT0002", "NOT0003"],
                        "total_cost": 1.5,
                        "experience_mix": "balanced"
                    }
                },
                "total_cost": 15.8,
                "metadata": {
                    "algorithm": "hungarian",
                    "execution_time": 0.08,
                    "optimal_solution": True,
                    "total_nurses": 23,
                    "total_positions": 23
                }
            }
        }