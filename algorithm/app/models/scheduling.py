"""
排程資料模型
"""

from dataclasses import dataclass
from datetime import datetime, time, date
from typing import Optional


@dataclass
class Surgery:
    """手術資料模型"""
    surgery_id: str
    doctor_id: str
    assistant_doctor_id: Optional[str]
    surgery_type_code: str
    patient_id: int
    surgery_room_type: str
    surgery_date: date
    duration: float  # 小時
    nurse_count: int
    created_at: Optional[datetime] = None
    status: str = 'pending'
    
    # 擴展資訊（可選）
    surgery_name: Optional[str] = None
    doctor_name: Optional[str] = None
    assistant_name: Optional[str] = None
    patient_name: Optional[str] = None


@dataclass
class ScheduleResult:
    """排程結果模型"""
    surgery_id: str
    room_id: str
    scheduled_date: date
    start_time: time
    end_time: time
    cleanup_end_time: time
    primary_shift: str  # 'morning', 'night', 'graveyard'
    is_cross_shift: bool
    ahp_score: float
    allocation_score: float
    
    def to_dict(self):
        """轉換為字典"""
        return {
            'surgery_id': self.surgery_id,
            'room_id': self.room_id,
            'scheduled_date': self.scheduled_date.isoformat() if isinstance(self.scheduled_date, date) else self.scheduled_date,
            'start_time': self.start_time.isoformat() if isinstance(self.start_time, time) else self.start_time,
            'end_time': self.end_time.isoformat() if isinstance(self.end_time, time) else self.end_time,
            'cleanup_end_time': self.cleanup_end_time.isoformat() if isinstance(self.cleanup_end_time, time) else self.cleanup_end_time,
            'primary_shift': self.primary_shift,
            'is_cross_shift': self.is_cross_shift,
            'ahp_score': round(self.ahp_score, 4),
            'allocation_score': round(self.allocation_score, 4)
        }
