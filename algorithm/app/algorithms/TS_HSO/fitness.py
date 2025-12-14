"""
適應度函數與評分計算
"""

from typing import Dict, List
from datetime import datetime
import logging

from app.models.scheduling import Surgery

logger = logging.getLogger(__name__)


def calculate_allocation_score(db, room: Dict, surgery: Surgery) -> float:
    """
    計算手術室分配分數
    
    考慮因素：
    1. 利用率提升
    2. 護士數量匹配
    3. 負載平衡
    4. 班次可用性
    """
    score = 0
    
    # 1. 利用率提升（權重最高）
    current_util = get_daily_utilization(db, room['id'], surgery.surgery_date)
    potential_util = calculate_potential_utilization(
        db, room['id'], surgery.surgery_date, surgery.duration
    )
    util_gain = potential_util - current_util
    score += util_gain * 100
    
    # 2. 護士數量剛好匹配
    if room['nurse_count'] == surgery.nurse_count:
        score += 20  # 完美匹配獎勵
    else:
        score += 10  # 有餘裕但可接受
    
    # 3. 負載平衡
    room_load = get_room_daily_load(db, room['id'], surgery.surgery_date)
    avg_load = get_average_load(db, surgery.surgery_date, surgery.surgery_room_type)
    if room_load < avg_load:
        score += 15  # 負載較低的手術室優先
    
    # 4. 班次可用性
    available_shifts = get_available_shifts(room)
    score += len(available_shifts) * 5
    
    return score


def calculate_fitness(db, individual: Dict, surgeries: List[Surgery]) -> float:
    """
    計算GA個體的適應度
    
    目標：
    - 最大化整體利用率
    - 最小化過載懲罰
    - 最小化負載不均
    """
    score = 0
    
    # 計算整體利用率
    total_utilization = 0
    room_dates = {}
    
    for surgery in surgeries:
        if surgery.surgery_id not in individual:
            continue
        
        room_id = individual[surgery.surgery_id]['room_id']
        date = surgery.surgery_date
        
        key = (room_id, date)
        if key not in room_dates:
            room_dates[key] = []
        room_dates[key].append(surgery.duration)
    
    # 計算每個手術室每天的利用率
    for (room_id, date), durations in room_dates.items():
        total_hours = sum(durations) + len(durations) * 0.5  # 含清潔時間
        capacity = get_daily_capacity(db, room_id, date)
        
        if capacity > 0:
            utilization = (total_hours / capacity) * 100
            
            # 過載懲罰
            if utilization > 100:
                score -= 9999  # 極大懲罰
            else:
                total_utilization += utilization
    
    # 平均利用率作為主要分數
    if room_dates:
        score += total_utilization / len(room_dates)
    
    # 負載不均懲罰
    if room_dates:
        loads = [sum(durations) for durations in room_dates.values()]
        load_std = calculate_std(loads)
        score -= load_std * 10
    
    return score


def calculate_ahp_score(db, surgery: Surgery) -> float:
    """
    計算AHP優先分數
    
    因子權重：
    - 手術時長 40%
    - 碎片填補 30%
    - 醫生時間 20%
    - 等待天數 10%
    """
    # 1. 手術時長分數（短手術優先）
    duration_score = 1 / (1 + surgery.duration)
    
    # 2. 碎片填補能力（暫時簡化）
    fragment_score = 0.5  # 需實際計算
    
    # 3. 醫生可用性（暫時簡化）
    doctor_score = 0.8
    
    # 4. 等待天數
    if hasattr(surgery, 'created_at'):
        waiting_days = (datetime.now().date() - surgery.created_at.date()).days
        waiting_score = min(waiting_days / 30, 1.0)
    else:
        waiting_score = 0.5
    
    # 加權計算
    total_score = (
        duration_score * 0.4 +
        fragment_score * 0.3 +
        doctor_score * 0.2 +
        waiting_score * 0.1
    )
    
    return total_score


# === 輔助函數 ===

def get_daily_utilization(db, room_id: str, date) -> float:
    """取得手術室當天利用率"""
    capacity = db.execute_query(
        "SELECT daily_total, daily_utilization FROM room_daily_capacity "
        "WHERE room_id = %s AND capacity_date = %s",
        (room_id, date)
    )
    
    if capacity:
        return capacity[0]['daily_utilization'] or 0
    return 0


def calculate_potential_utilization(
    db, 
    room_id: str, 
    date, 
    additional_duration: float
) -> float:
    """計算加入新手術後的利用率"""
    capacity_info = db.execute_query(
        "SELECT daily_total, daily_used FROM room_daily_capacity "
        "WHERE room_id = %s AND capacity_date = %s",
        (room_id, date)
    )
    
    if not capacity_info:
        return 0
    
    total = capacity_info[0]['daily_total']
    used = capacity_info[0]['daily_used']
    
    if total == 0:
        return 0
    
    new_used = used + additional_duration + 0.5  # 含清潔
    return (new_used / total) * 100


def get_room_daily_load(db, room_id: str, date) -> float:
    """取得手術室當天負載（已用時數）"""
    capacity = db.execute_query(
        "SELECT daily_used FROM room_daily_capacity "
        "WHERE room_id = %s AND capacity_date = %s",
        (room_id, date)
    )
    
    if capacity:
        return capacity[0]['daily_used'] or 0
    return 0


def get_average_load(db, date, room_type: str) -> float:
    """取得同類型手術室的平均負載"""
    avg = db.execute_query(
        """
        SELECT AVG(rdc.daily_used) as avg_load
        FROM room_daily_capacity rdc
        JOIN surgery_room sr ON rdc.room_id = sr.id
        WHERE sr.room_type = %s AND rdc.capacity_date = %s
        """,
        (room_type, date)
    )
    
    if avg and avg[0]['avg_load']:
        return float(avg[0]['avg_load'])
    return 0


def get_available_shifts(room: Dict) -> List[str]:
    """取得手術室可用時段"""
    shifts = []
    if room.get('morning_shift'):
        shifts.append('morning')
    if room.get('night_shift'):
        shifts.append('night')
    if room.get('graveyard_shift'):
        shifts.append('graveyard')
    return shifts


def get_daily_capacity(db, room_id: str, date) -> float:
    """取得手術室當天總容量"""
    capacity = db.execute_query(
        "SELECT daily_total FROM room_daily_capacity "
        "WHERE room_id = %s AND capacity_date = %s",
        (room_id, date)
    )
    
    if capacity:
        return capacity[0]['daily_total'] or 0
    return 0


def calculate_std(values: List[float]) -> float:
    """計算標準差"""
    if not values:
        return 0
    
    mean = sum(values) / len(values)
    variance = sum((x - mean) ** 2 for x in values) / len(values)
    return variance ** 0.5
