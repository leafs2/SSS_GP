"""
Surgery Room Data Models

手術室相關的 Pydantic 資料模型
"""

from pydantic import BaseModel, Field
from typing import Optional, List


class SurgeryRoomInput(BaseModel):
    """
    手術室輸入模型 - 用於接收 Node.js 傳來的手術室資料
    """
    room_id: str = Field(..., description="手術室編號")
    room_type: str = Field(..., description="手術室類型 (RSU/RSP/RD/RE)")
    require_nurses: int = Field(..., description="需要的護士人數")
    
    # 手術室特性 - 用於成本計算
    complexity: Optional[str] = Field("medium", description="複雜度 (low/medium/high)")
    recent_activity: Optional[float] = Field(0.5, description="近期使用率 (0.0-1.0)")
    
    class Config:
        json_schema_extra = {
            "example": {
                "room_id": "RSU01",
                "room_type": "RSU",
                "require_nurses": 3,
                "complexity": "high",
                "recent_activity": 0.85
            }
        }


class RoomAssignmentSummary(BaseModel):
    """
    單一手術室的分配摘要
    """
    room_id: str = Field(..., description="手術室編號")
    nurses: List[str] = Field(..., description="分配的護士員工編號列表")
    total_cost: float = Field(..., description="總成本")
    experience_mix: Optional[str] = Field(None, description="資歷組合 (balanced/senior/junior)")
    
    class Config:
        json_schema_extra = {
            "example": {
                "room_id": "RSU01",
                "nurses": ["NOT0001", "NOT0002", "NOT0003"],
                "total_cost": 1.5,
                "experience_mix": "balanced"
            }
        }