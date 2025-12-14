"""
第二階段：貪婪演算法時間排程
"""

from datetime import datetime, time, timedelta
from typing import List, Dict, Optional, Tuple
import logging

from app.models.scheduling import Surgery, ScheduleResult
from .fitness import calculate_ahp_score
from .constraints import (
    find_feasible_time_slots,
    calculate_shift_occupation,
    has_capacity
)

logger = logging.getLogger(__name__)


class Stage2GreedyScheduler:
    """第二階段：Greedy時間排程"""
    
    def __init__(self, db_connection):
        self.db = db_connection
    
    def schedule_surgeries(
        self, 
        surgeries: List[Surgery], 
        allocation: Dict[str, Dict]
    ) -> List[ScheduleResult]:
        """
        為手術安排具體時段
        
        Args:
            surgeries: 手術列表
            allocation: 第一階段分配結果
            
        Returns:
            排程結果列表
        """
        # 計算AHP分數並排序
        surgeries_with_score = []
        for surgery in surgeries:
            if surgery.surgery_id not in allocation:
                continue
                
            ahp_score = calculate_ahp_score(self.db, surgery)
            surgeries_with_score.append((surgery, ahp_score))
        
        # 按AHP分數排序（高→低）
        surgeries_with_score.sort(key=lambda x: x[1], reverse=True)
        
        schedule_results = []
        failed_surgeries = []
        
        # 貪婪插入
        for surgery, ahp_score in surgeries_with_score:
            allocation_info = allocation[surgery.surgery_id]
            room_id = allocation_info['room_id']
            
            try:
                # 找可行時段
                feasible_slots = find_feasible_time_slots(
                    self.db,
                    room_id,
                    surgery.surgery_date,
                    surgery.duration,
                    surgery.doctor_id,
                    surgery.assistant_doctor_id
                )
                
                if not feasible_slots:
                    logger.warning(f"手術 {surgery.surgery_id} 無可行時段")
                    failed_surgeries.append(surgery)
                    continue
                
                # 選擇最佳時段
                best_slot = self.select_best_slot(
                    feasible_slots,
                    surgery.duration
                )
                
                # 建立排程結果
                result = self.create_schedule_result(
                    surgery,
                    room_id,
                    best_slot,
                    ahp_score,
                    allocation_info['score']
                )
                
                schedule_results.append(result)
                
                logger.info(
                    f"手術 {surgery.surgery_id} 排程成功: "
                    f"{room_id} {best_slot['start_time']}-{result.end_time}"
                )
                
            except Exception as e:
                logger.error(f"排程手術 {surgery.surgery_id} 失敗: {str(e)}")
                failed_surgeries.append(surgery)
        
        if failed_surgeries:
            logger.warning(f"{len(failed_surgeries)} 台手術排程失敗")
        
        return schedule_results
    
    def find_and_insert(
        self, 
        surgery: Surgery, 
        existing_schedule: List[ScheduleResult]
    ) -> Optional[ScheduleResult]:
        """
        增量插入單一手術
        
        Args:
            surgery: 待插入的手術
            existing_schedule: 現有排程
            
        Returns:
            排程結果或None
        """
        # 快速分配手術室（選擇負載最低的）
        candidate_rooms = self.db.get_available_rooms(
            surgery.surgery_room_type,
            surgery.nurse_count,
            surgery.surgery_date
        )
        
        if not candidate_rooms:
            return None
        
        # 選擇當天手術最少的手術室
        room_loads = {}
        for room in candidate_rooms:
            load = len([
                s for s in existing_schedule 
                if s.room_id == room['id'] and s.scheduled_date == surgery.surgery_date
            ])
            room_loads[room['id']] = load
        
        best_room_id = min(room_loads, key=room_loads.get)
        
        # 找可行時段
        feasible_slots = find_feasible_time_slots(
            self.db,
            best_room_id,
            surgery.surgery_date,
            surgery.duration,
            surgery.doctor_id,
            surgery.assistant_doctor_id
        )
        
        if not feasible_slots:
            return None
        
        # 選擇最早可用時段
        best_slot = feasible_slots[0]
        
        # 建立排程結果
        ahp_score = calculate_ahp_score(self.db, surgery)
        result = self.create_schedule_result(
            surgery,
            best_room_id,
            best_slot,
            ahp_score,
            0
        )
        
        return result
    
    def select_best_slot(
        self, 
        feasible_slots: List[Dict], 
        duration: float
    ) -> Dict:
        """
        選擇最佳時段
        
        策略：
        1. 長手術（>4h）優先選擇時段開始位置
        2. 短手術優先填補碎片時段
        3. 其他選擇最早可用時段
        """
        if not feasible_slots:
            raise ValueError("沒有可行時段")
        
        # 長手術：優先時段開始
        if duration > 4:
            for slot in feasible_slots:
                start_hour = slot['start_time'].hour
                if start_hour in [8, 16]:  # 早班或晚班開始
                    return slot
        
        # 短手術：優先填補碎片
        # （這裡簡化，直接選最早）
        # 實際應檢查前後是否有手術，計算碎片填補率
        
        return feasible_slots[0]  # 最早可用
    
    def create_schedule_result(
        self,
        surgery: Surgery,
        room_id: str,
        slot: Dict,
        ahp_score: float,
        allocation_score: float
    ) -> ScheduleResult:
        """建立排程結果物件"""
        start_time = slot['start_time']
        end_time = slot['end_time']
        cleanup_end = slot['cleanup_end']
        
        # 判斷主要時段
        start_hour = start_time.hour
        if 8 <= start_hour < 16:
            primary_shift = 'morning'
        elif 16 <= start_hour < 24:
            primary_shift = 'night'
        else:
            primary_shift = 'graveyard'
        
        # 判斷是否跨時段
        is_cross_shift = slot.get('cross_shift', False)
        
        return ScheduleResult(
            surgery_id=surgery.surgery_id,
            room_id=room_id,
            scheduled_date=surgery.surgery_date,
            start_time=start_time,
            end_time=end_time,
            cleanup_end_time=cleanup_end,
            primary_shift=primary_shift,
            is_cross_shift=is_cross_shift,
            ahp_score=ahp_score,
            allocation_score=allocation_score
        )
