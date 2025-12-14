"""
工具函數
"""

from datetime import datetime, time, timedelta
from typing import List, Dict, Any
import json


def format_time(t: time) -> str:
    """格式化時間為 HH:MM"""
    return t.strftime('%H:%M')


def parse_time(time_str: str) -> time:
    """解析時間字串"""
    return datetime.strptime(time_str, '%H:%M').time()


def format_date(d: datetime) -> str:
    """格式化日期為 YYYY-MM-DD"""
    if isinstance(d, str):
        return d
    return d.strftime('%Y-%m-%d')


def parse_date(date_str: str) -> datetime:
    """解析日期字串"""
    return datetime.strptime(date_str, '%Y-%m-%D')


def time_to_minutes(t: time) -> int:
    """將時間轉換為分鐘數（從午夜開始）"""
    return t.hour * 60 + t.minute


def minutes_to_time(minutes: int) -> time:
    """將分鐘數轉換為時間"""
    hours = minutes // 60
    mins = minutes % 60
    return time(hours % 24, mins)


def calculate_duration(start: time, end: time) -> float:
    """計算時長（小時）"""
    start_minutes = time_to_minutes(start)
    end_minutes = time_to_minutes(end)
    
    if end_minutes < start_minutes:
        # 跨日
        end_minutes += 24 * 60
    
    return (end_minutes - start_minutes) / 60


def serialize_schedule(schedule) -> Dict:
    """序列化排程結果為JSON"""
    return {
        'surgery_id': schedule.surgery_id,
        'room_id': schedule.room_id,
        'scheduled_date': format_date(schedule.scheduled_date),
        'start_time': format_time(schedule.start_time),
        'end_time': format_time(schedule.end_time),
        'cleanup_end_time': format_time(schedule.cleanup_end_time),
        'primary_shift': schedule.primary_shift,
        'is_cross_shift': schedule.is_cross_shift,
        'ahp_score': round(schedule.ahp_score, 4) if schedule.ahp_score else None,
        'allocation_score': round(schedule.allocation_score, 4) if schedule.allocation_score else None
    }


def batch_serialize(schedules: List) -> List[Dict]:
    """批次序列化"""
    return [serialize_schedule(s) for s in schedules]
