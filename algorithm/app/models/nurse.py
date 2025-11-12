"""
Nurse Data Models

護士相關的 Pydantic 資料模型
"""

from pydantic import BaseModel, Field
from typing import Optional, List


class NurseInput(BaseModel):
    """
    護士輸入模型 - 用於接收 Node.js 傳來的護士資料
    """
    employee_id: str = Field(..., description="護士員工編號")
    name: Optional[str] = Field(None, description="護士姓名")
    room_type: str = Field(..., description="手術室類型 (RSU/RSP/RD/RE)")
    scheduling_time: str = Field(..., description="排班時段 (早班/晚班/大夜)")
    
    # 歷史資料 - 用於計算成本
    last_assigned_room: Optional[str] = Field(None, description="上次分配的手術室")
    workload_this_week: Optional[int] = Field(0, description="本週已工作天數")
    experience_years: Optional[int] = Field(0, description="年資")
    
    class Config:
        json_schema_extra = {
            "example": {
                "employee_id": "NOT0001",
                "name": "張小明",
                "room_type": "RSU",
                "scheduling_time": "早班",
                "last_assigned_room": "RSU01",
                "workload_this_week": 3,
                "experience_years": 5
            }
        }


class NurseAssignment(BaseModel):
    """
    護士分配結果模型
    """
    employee_id: str = Field(..., description="護士員工編號")
    nurse_name: Optional[str] = Field(None, description="護士姓名")
    assigned_room: str = Field(..., description="分配的手術室編號")
    position: int = Field(..., description="在該手術室的位置編號 (1-based)")
    cost: float = Field(..., description="分配成本")
    reasons: List[str] = Field(default_factory=list, description="分配原因")
    
    class Config:
        json_schema_extra = {
            "example": {
                "employee_id": "NOT0001",
                "nurse_name": "張小明",
                "assigned_room": "RSU01",
                "position": 1,
                "cost": 0.5,
                "reasons": ["high_familiarity", "balanced_workload"]
            }
        }