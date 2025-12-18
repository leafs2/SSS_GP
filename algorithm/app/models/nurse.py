"""
Nurse Data Models

護士相關的 Pydantic 資料模型
"""

from pydantic import BaseModel, Field
from typing import Optional, List


class NurseInput(BaseModel):
    employee_id: str = Field(..., description="護士員工編號")
    name: Optional[str] = Field(None, description="護士姓名")
    room_type: str = Field(..., description="手術室類型")
    scheduling_time: str = Field(..., description="排班時段")
    
    # 【修正】對齊資料庫欄位名稱
    last_assigned_room: Optional[str] = Field(None, description="上次分配的手術室")
    workload_this_week: int = Field(0, description="本週已工作天數")
    
    # 【關鍵修正】新增這兩個欄位，讓 Python 能接收到正確數值
    total_fixed_count: int = Field(0, description="累計擔任固定角色的次數")
    total_float_count: int = Field(0, description="累計擔任流動角色的次數")
    
    # 為了兼容舊程式碼，可以保留這些，但我們主要依賴上面兩個
    history_fixed_count: Optional[int] = Field(0, description="舊欄位兼容")
    history_float_count: Optional[int] = Field(0, description="舊欄位兼容")
    
    class Config:
        json_schema_extra = {
            "example": {
                "employee_id": "NOT0001",
                "name": "張小明",
                "room_type": "RSU",
                "scheduling_time": "早班",
                "last_assigned_room": "RSU01",
                "workload_this_week": 3,
                "history_fixed_count": 10,  # 範例：當過 10 次固定
                "history_float_count": 2    # 範例：當過 2 次流動
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