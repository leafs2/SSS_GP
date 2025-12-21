"""
適應度函數與評分計算 - 修正版
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


def calculate_fitness(schedule, surgeries, rooms_info, weights=None):
    """
    計算染色體的適應度 - 修正版
    
    策略：
    1. 手術室利用率 (高利用率 = 好)
    2. 負載平衡 (各間手術室時間差異小 = 好)
    3. 超時懲罰 (盡量排在 8 小時內)
    4. [新增] 手術室數量懲罰 (鼓勵使用適當數量的手術室)
    """
    if weights is None:
        weights = {
            'utilization': 0.25,
            'balance': 0.25,
            'overtime': 0.3,
            'room_count': 0.2  # 新增：手術室數量權重
        }
    
    room_usage = {}  # {room_id: total_minutes}
    
    # 1. 計算每間手術室的總工時
    for gene in schedule:
        surgery_id = gene['surgery_id']
        room_id = gene['room_id']
        
        # 找出對應手術的持續時間
        surgery = next((s for s in surgeries if s.surgery_id == surgery_id), None)
        if surgery:
            duration_mins = (surgery.duration + 0.5) * 60  # 包含清潔時間
            if room_id not in room_usage:
                room_usage[room_id] = 0
            room_usage[room_id] += duration_mins

    if not room_usage:
        return 0

    # --- 計算各項指標 ---

    # 1. 利用率分數 (越高越好，但不要過度集中)
    IDEAL_USAGE_PER_ROOM = 480  # 8小時
    total_used = sum(room_usage.values())
    ideal_room_count = max(1, int(total_used / IDEAL_USAGE_PER_ROOM) + 1)
    actual_room_count = len(room_usage)
    
    # 如果使用的手術室太少，給予懲罰
    if actual_room_count < ideal_room_count:
        utilization_score = actual_room_count / ideal_room_count * 0.5
    else:
        # 正常利用率計算
        total_capacity = actual_room_count * IDEAL_USAGE_PER_ROOM
        utilization_score = min(1.0, total_used / total_capacity)

    # 2. 負載平衡分數 (標準差越小越好)
    usage_values = list(room_usage.values())
    if len(usage_values) > 1:
        avg_usage = sum(usage_values) / len(usage_values)
        variance = sum((x - avg_usage) ** 2 for x in usage_values) / len(usage_values)
        std_dev = variance ** 0.5
        # 標準差越小分數越高
        balance_score = 1.0 / (1.0 + std_dev / 100)
    else:
        balance_score = 0.5  # 只用一間手術室，平衡分數給中等

    # 3. 超時懲罰 (每間手術室不應超過8小時)
    overtime_penalty = 0
    MORNING_SHIFT_LIMIT = 480  # 分鐘
    
    for room_id, used_mins in room_usage.items():
        if used_mins > MORNING_SHIFT_LIMIT:
            excess = used_mins - MORNING_SHIFT_LIMIT
            # 超時懲罰：每超過1小時扣5分
            overtime_penalty += (excess / 60) ** 1.5  # 非線性懲罰

    # 4. [新增] 手術室數量評分
    # 鼓勵使用接近理想數量的手術室
    room_count_score = 1.0 - abs(actual_room_count - ideal_room_count) / max(ideal_room_count, 1) * 0.5
    room_count_score = max(0, room_count_score)

    # 5. 總分計算 (0~100)
    base_score = (
        utilization_score * weights['utilization'] +
        balance_score * weights['balance'] +
        room_count_score * weights['room_count']
    ) * 100
    
    # 扣除懲罰
    final_score = base_score - (overtime_penalty * 10)
    
    return max(0, final_score)


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