"""
約束檢查與可行性驗證
"""

from datetime import datetime, time, timedelta
from typing import List, Dict, Optional
import logging

logger = logging.getLogger(__name__)


def check_daily_overload(
    db,
    room_id: str,
    date,
    additional_duration: float
) -> bool:
    """
    檢查手術室當天是否會過載
    
    Returns:
        True = 會過載, False = 不會過載
    """
    capacity_info = db.execute_query(
        """
        SELECT daily_total, daily_used 
        FROM room_daily_capacity
        WHERE room_id = %s AND capacity_date = %s
        """,
        (room_id, date)
    )
    
    if not capacity_info:
        logger.warning(f"找不到容量資訊: {room_id} {date}")
        return True  # 保守起見，視為過載
    
    total = capacity_info[0]['daily_total'] or 0
    used = capacity_info[0]['daily_used'] or 0
    
    required = additional_duration + 0.5  # 含清潔時間
    
    return (used + required) > total


def get_candidate_rooms(
    db,
    room_type: str,
    required_nurses: int,
    exclude_emergency: bool = True
) -> List[Dict]:
    """
    取得符合條件的候選手術室
    
    Args:
        db: 資料庫連接
        room_type: 手術室類型
        required_nurses: 需要的護士數
        exclude_emergency: 是否排除緊急手術室
    
    Returns:
        符合條件的手術室列表
    """
    # 建立排除條件
    exclude_types = []
    if exclude_emergency:
        exclude_types.append('RE')
    
    exclude_clause = ""
    if exclude_types:
        placeholders = ', '.join(['%s'] * len(exclude_types))
        exclude_clause = f" AND room_type NOT IN ({placeholders})"
    
    query = f"""
        SELECT id, room_type, nurse_count, 
               morning_shift, night_shift, graveyard_shift
        FROM surgery_room
        WHERE room_type = %s 
          AND nurse_count >= %s
          {exclude_clause}
    """
    
    params = [room_type, required_nurses]
    if exclude_types:
        params.extend(exclude_types)
    
    rooms = db.execute_query(query, tuple(params))
    
    return rooms or []


def find_feasible_time_slots(
    db,
    room_id: str,
    date,
    duration: float,
    doctor_id: str,
    assistant_id: Optional[str]
) -> List[Dict]:
    """
    找出所有可行的時間段
    
    Returns:
        可行時段列表，每個時段包含 start_time, end_time, cleanup_end
    """
    feasible_slots = []
    
    # 取得手術室資訊
    room_info = db.execute_query(
        "SELECT * FROM surgery_room WHERE id = %s",
        (room_id,)
    )[0]
    
    # 取得當天已排程的手術
    existing_surgeries = db.execute_query(
        """
        SELECT start_time, cleanup_end_time 
        FROM surgery_correct_time
        WHERE room_id = %s AND scheduled_date = %s
        ORDER BY start_time
        """,
        (room_id, date)
    )
    
    # 取得醫生時間表
    doctor_schedule = db.execute_query(
        """
        SELECT start_time, end_time
        FROM resource_occupation
        WHERE resource_type = 'doctor' 
          AND resource_id = %s 
          AND occupation_date = %s
        ORDER BY start_time
        """,
        (doctor_id, date)
    )
    
    # 取得助理時間表
    assistant_schedule = []
    if assistant_id:
        assistant_schedule = db.execute_query(
            """
            SELECT start_time, end_time
            FROM resource_occupation
            WHERE resource_type = 'assistant' 
              AND resource_id = %s 
              AND occupation_date = %s
            ORDER BY start_time
            """,
            (assistant_id, date)
        )
    
    # 產生候選時段（每30分鐘一個）
    start_hour = 8  # 早班開始
    end_hour = 24   # 晚班結束
    
    current_time = datetime.combine(date, time(start_hour, 0))
    end_time_limit = datetime.combine(date, time(end_hour, 0))
    
    while current_time < end_time_limit:
        # 計算手術結束時間
        surgery_end = current_time + timedelta(hours=duration)
        cleanup_end = surgery_end + timedelta(minutes=30)
        
        # 檢查所有約束
        if is_slot_feasible(
            current_time.time(),
            cleanup_end.time(),
            duration,
            room_info,
            existing_surgeries,
            doctor_schedule,
            assistant_schedule,
            db,
            room_id,
            date
        ):
            # 判斷是否跨時段
            is_cross = is_cross_shift(current_time.time(), surgery_end.time())
            
            feasible_slots.append({
                'start_time': current_time.time(),
                'end_time': surgery_end.time(),
                'cleanup_end': cleanup_end.time(),
                'cross_shift': is_cross
            })
        
        # 下一個候選時間（30分鐘後）
        current_time += timedelta(minutes=30)
    
    return feasible_slots


def is_slot_feasible(
    start_time: time,
    cleanup_end: time,
    duration: float,
    room_info: Dict,
    existing_surgeries: List[Dict],
    doctor_schedule: List[Dict],
    assistant_schedule: List[Dict],
    db,
    room_id: str,
    date
) -> bool:
    """檢查時段是否可行"""
    
    # 1. 檢查時段是否開放
    if not is_shift_open(start_time, room_info):
        return False
    
    # 2. 檢查手術室衝突（含清潔時間）
    for surgery in existing_surgeries:
        if time_overlap(
            start_time, 
            cleanup_end,
            surgery['start_time'],
            surgery['cleanup_end_time']
        ):
            return False
    
    # 3. 檢查醫生衝突（含1小時休息）
    end_with_rest = add_minutes_to_time(cleanup_end, 60)
    for occupied in doctor_schedule:
        occupied_start_with_rest = subtract_minutes_from_time(occupied['start_time'], 60)
        occupied_end_with_rest = add_minutes_to_time(occupied['end_time'], 60)
        
        if time_overlap(
            start_time,
            end_with_rest,
            occupied_start_with_rest,
            occupied_end_with_rest
        ):
            return False
    
    # 4. 檢查助理醫生衝突（含1小時休息）
    for occupied in assistant_schedule:
        occupied_start_with_rest = subtract_minutes_from_time(occupied['start_time'], 60)
        occupied_end_with_rest = add_minutes_to_time(occupied['end_time'], 60)
        
        if time_overlap(
            start_time,
            end_with_rest,
            occupied_start_with_rest,
            occupied_end_with_rest
        ):
            return False
    
    # 5. 檢查各時段容量
    occupation = calculate_shift_occupation(start_time, duration)
    for shift, hours in occupation.items():
        if not has_capacity(db, room_id, date, shift, hours):
            return False
    
    return True


def calculate_shift_occupation(start_time: time, duration: float) -> Dict[str, float]:
    """
    計算手術佔用各時段的時間
    
    Returns:
        {'morning': X, 'night': Y, 'graveyard': Z}
    """
    total_duration = duration + 0.5  # 含清潔
    
    # 轉換為小時數（浮點數）
    start_hour = start_time.hour + start_time.minute / 60
    end_hour = start_hour + total_duration
    
    shifts = {
        'morning': (8, 16),
        'night': (16, 24),
        'graveyard': (0, 8)
    }
    
    occupation = {}
    
    for shift_name, (shift_start, shift_end) in shifts.items():
        overlap_start = max(start_hour, shift_start)
        overlap_end = min(end_hour, shift_end)
        
        overlap_hours = max(0, overlap_end - overlap_start)
        
        if overlap_hours > 0:
            occupation[shift_name] = overlap_hours
    
    return occupation


def has_capacity(db, room_id: str, date, shift: str, required_hours: float) -> bool:
    """檢查時段容量是否足夠"""
    capacity = db.execute_query(
        f"""
        SELECT {shift}_remaining 
        FROM room_daily_capacity
        WHERE room_id = %s AND capacity_date = %s
        """,
        (room_id, date)
    )
    
    if not capacity:
        return False
    
    remaining = capacity[0][f'{shift}_remaining'] or 0
    return remaining >= required_hours


def is_shift_open(start_time: time, room_info: Dict) -> bool:
    """檢查時段是否開放"""
    hour = start_time.hour
    
    if 8 <= hour < 16:
        return room_info.get('morning_shift', False)
    elif 16 <= hour < 24:
        return room_info.get('night_shift', False)
    else:
        return room_info.get('graveyard_shift', False)


def is_cross_shift(start_time: time, end_time: time) -> bool:
    """判斷是否跨時段"""
    start_hour = start_time.hour
    end_hour = end_time.hour
    
    # 判斷開始和結束是否在不同時段
    start_shift = get_shift(start_hour)
    end_shift = get_shift(end_hour)
    
    return start_shift != end_shift


def get_shift(hour: int) -> str:
    """取得時段名稱"""
    if 8 <= hour < 16:
        return 'morning'
    elif 16 <= hour < 24:
        return 'night'
    else:
        return 'graveyard'


def time_overlap(start1: time, end1: time, start2: time, end2: time) -> bool:
    """判斷兩個時段是否重疊"""
    return not (end1 <= start2 or end2 <= start1)


def add_minutes_to_time(t: time, minutes: int) -> time:
    """時間加上分鐘"""
    dt = datetime.combine(datetime.today(), t)
    dt += timedelta(minutes=minutes)
    return dt.time()


def subtract_minutes_from_time(t: time, minutes: int) -> time:
    """時間減去分鐘"""
    dt = datetime.combine(datetime.today(), t)
    dt -= timedelta(minutes=minutes)
    return dt.time()
