"""
algorithm/app/algorithms/TS_HSO/scheduler_standalone.py
獨立排程器 - 不依賴資料庫連接，所有資料由外部傳入
"""

from typing import List, Dict, Optional, Tuple
from datetime import datetime, time, date
import logging
import random

from app.models.scheduling import Surgery, ScheduleResult

logger = logging.getLogger(__name__)


class StandaloneScheduler:
    """
    獨立排程器
    
    不依賴資料庫，所有資料由外部傳入
    適用於 API 呼叫場景
    """
    
    def __init__(
        self,
        available_rooms: List[Dict],
        existing_schedules: List[Dict] = None,
        config: Dict = None
    ):
        """
        初始化排程器
        
        Args:
            available_rooms: 可用手術室列表
            existing_schedules: 現有排程列表（避免衝突）
            config: 配置參數
        """
        self.available_rooms = {room['id']: room for room in available_rooms}
        self.existing_schedules = existing_schedules or []
        self.config = config or {}
        
        # GA 參數
        self.ga_generations = self.config.get('ga_generations', 100)
        self.ga_population = self.config.get('ga_population', 50)
        self.mutation_rate = self.config.get('mutation_rate', 0.15)
        
        # AHP 權重
        ahp_weights = self.config.get('ahp_weights', {})
        self.ahp_duration_weight = ahp_weights.get('duration', 0.4)
        self.ahp_fragment_weight = ahp_weights.get('fragment', 0.3)
        self.ahp_doctor_weight = ahp_weights.get('doctor', 0.2)
        self.ahp_waiting_weight = ahp_weights.get('waiting', 0.1)
    
    def schedule(self, surgeries: List[Surgery]) -> Tuple[List[ScheduleResult], List[Surgery]]:
        """
        執行排程
        
        Args:
            surgeries: 待排程手術列表
            
        Returns:
            (成功排程列表, 失敗手術列表)
        """
        if not surgeries:
            return [], []
        
        logger.info(f"開始排程 {len(surgeries)} 台手術")
        
        # 第一階段：手術室分配（簡化版GA）
        allocation = self._allocate_rooms_simple(surgeries)
        
        # 第二階段：時間排程（Greedy + AHP）
        results, failed = self._schedule_time_slots(surgeries, allocation)
        
        logger.info(f"排程完成：成功 {len(results)} 台，失敗 {len(failed)} 台")
        
        return results, failed
    
    def _allocate_rooms_simple(self, surgeries: List[Surgery]) -> Dict[str, str]:
        """
        簡化版手術室分配
        
        Args:
            surgeries: 手術列表
            
        Returns:
            {surgery_id: room_id}
        """
        allocation = {}
        
        # 按手術時長排序（短→長）
        sorted_surgeries = sorted(surgeries, key=lambda s: s.duration)
        
        for surgery in sorted_surgeries:
            # 找符合條件的手術室
            candidate_rooms = [
                room for room in self.available_rooms.values()
                if room['room_type'] == surgery.surgery_room_type
                and room['nurse_count'] >= surgery.nurse_count
            ]
            
            if not candidate_rooms:
                logger.warning(f"手術 {surgery.surgery_id} 找不到合適的手術室")
                continue
            
            # 選擇負載最低的手術室
            room_loads = {}
            for room in candidate_rooms:
                # 計算該手術室當天已排程的手術數
                load = sum(
                    1 for s in self.existing_schedules
                    if s.get('room_id') == room['id']
                    and s.get('scheduled_date') == surgery.surgery_date
                )
                room_loads[room['id']] = load
            
            # 選擇負載最小的
            best_room_id = min(room_loads, key=room_loads.get)
            allocation[surgery.surgery_id] = best_room_id
        
        return allocation
    
    def _schedule_time_slots(
        self, 
        surgeries: List[Surgery], 
        allocation: Dict[str, str]
    ) -> Tuple[List[ScheduleResult], List[Surgery]]:
        """
        時間排程
        
        Args:
            surgeries: 手術列表
            allocation: 手術室分配 {surgery_id: room_id}
            
        Returns:
            (成功排程列表, 失敗手術列表)
        """
        # 計算 AHP 分數並排序
        surgeries_with_score = []
        for surgery in surgeries:
            if surgery.surgery_id not in allocation:
                continue
            
            score = self._calculate_ahp_score(surgery)
            surgeries_with_score.append((surgery, score))
        
        # 按分數排序（高→低）
        surgeries_with_score.sort(key=lambda x: x[1], reverse=True)
        
        results = []
        failed = []
        scheduled_slots = list(self.existing_schedules)  # 複製現有排程
        
        # Greedy 插入
        for surgery, ahp_score in surgeries_with_score:
            room_id = allocation[surgery.surgery_id]
            
            # 找可行時段
            feasible_slot = self._find_feasible_slot(
                surgery, 
                room_id, 
                scheduled_slots
            )
            
            if feasible_slot:
                # 建立排程結果
                result = ScheduleResult(
                    surgery_id=surgery.surgery_id,
                    room_id=room_id,
                    scheduled_date=surgery.surgery_date,
                    start_time=feasible_slot['start_time'],
                    end_time=feasible_slot['end_time'],
                    cleanup_end_time=feasible_slot['cleanup_end'],
                    primary_shift=feasible_slot['shift'],
                    is_cross_shift=feasible_slot['is_cross'],
                    ahp_score=ahp_score,
                    allocation_score=0.0
                )
                
                results.append(result)
                
                # 加入已排程列表（避免後續衝突）
                scheduled_slots.append({
                    'surgery_id': surgery.surgery_id,
                    'room_id': room_id,
                    'scheduled_date': surgery.surgery_date,
                    'start_time': feasible_slot['start_time'].isoformat(),
                    'end_time': feasible_slot['end_time'].isoformat(),
                    'cleanup_end_time': feasible_slot['cleanup_end'].isoformat()
                })
            else:
                logger.warning(f"手術 {surgery.surgery_id} 找不到可行時段")
                failed.append(surgery)
        
        return results, failed
    
    def _calculate_ahp_score(self, surgery: Surgery) -> float:
        """
        計算 AHP 優先分數
        
        Args:
            surgery: 手術物件
            
        Returns:
            AHP 分數
        """
        # 1. 手術時長分數（短手術優先）
        duration_score = 1 / (1 + surgery.duration)
        
        # 2. 碎片填補能力（簡化）
        fragment_score = 0.5
        
        # 3. 醫生可用性（簡化）
        doctor_score = 0.8
        
        # 4. 等待天數
        if hasattr(surgery, 'created_at') and surgery.created_at:
            waiting_days = (datetime.now().date() - surgery.created_at.date()).days
            waiting_score = min(waiting_days / 30, 1.0)
        else:
            waiting_score = 0.5
        
        # 加權計算
        total_score = (
            duration_score * self.ahp_duration_weight +
            fragment_score * self.ahp_fragment_weight +
            doctor_score * self.ahp_doctor_weight +
            waiting_score * self.ahp_waiting_weight
        )
        
        return total_score
    
    def _find_feasible_slot(
        self, 
        surgery: Surgery, 
        room_id: str,
        scheduled_slots: List[Dict]
    ) -> Optional[Dict]:
        """
        找可行時段
        
        Args:
            surgery: 手術物件
            room_id: 手術室ID
            scheduled_slots: 已排程時段
            
        Returns:
            可行時段資訊或 None
        """
        # 候選時段（每30分鐘一個，從 08:00 開始）
        start_hour = 8
        end_hour = 20  # 最晚20:00開始
        
        for hour in range(start_hour, end_hour):
            for minute in [0, 30]:
                start_time = time(hour, minute)
                
                # 計算結束時間
                start_datetime = datetime.combine(surgery.surgery_date, start_time)
                end_datetime = start_datetime + self._hours_to_timedelta(surgery.duration)
                end_time = end_datetime.time()
                
                # 加上清潔時間
                cleanup_datetime = end_datetime + self._hours_to_timedelta(0.5)
                cleanup_end = cleanup_datetime.time()
                
                # 檢查是否可行
                if self._is_slot_available(
                    surgery,
                    room_id,
                    start_time,
                    cleanup_end,
                    scheduled_slots
                ):
                    # 判斷時段和是否跨時段
                    shift = self._get_shift(start_time)
                    is_cross = self._is_cross_shift(start_time, end_time)
                    
                    return {
                        'start_time': start_time,
                        'end_time': end_time,
                        'cleanup_end': cleanup_end,
                        'shift': shift,
                        'is_cross': is_cross
                    }
        
        return None
    
    def _is_slot_available(
        self,
        surgery: Surgery,
        room_id: str,
        start_time: time,
        cleanup_end: time,
        scheduled_slots: List[Dict]
    ) -> bool:
        """
        檢查時段是否可用
        
        Args:
            surgery: 手術物件
            room_id: 手術室ID
            start_time: 開始時間
            cleanup_end: 清潔結束時間
            scheduled_slots: 已排程時段
            
        Returns:
            是否可用
        """
        # 檢查手術室衝突
        for slot in scheduled_slots:
            if (slot.get('room_id') == room_id and 
                slot.get('scheduled_date') == surgery.surgery_date):
                
                # 解析已排程的時間
                existing_start = self._parse_time(slot.get('start_time'))
                existing_end = self._parse_time(slot.get('cleanup_end_time'))
                
                # 檢查是否重疊
                if self._time_overlap(start_time, cleanup_end, existing_start, existing_end):
                    return False
        
        # 可以加入更多檢查：醫生衝突、助理衝突等
        # 為了簡化，這裡暫時只檢查手術室衝突
        
        return True
    
    def _time_overlap(
        self, 
        start1: time, 
        end1: time, 
        start2: time, 
        end2: time
    ) -> bool:
        """檢查兩個時段是否重疊"""
        return not (end1 <= start2 or end2 <= start1)
    
    def _get_shift(self, t: time) -> str:
        """取得時段名稱"""
        hour = t.hour
        if 8 <= hour < 16:
            return 'morning'
        elif 16 <= hour < 24:
            return 'night'
        else:
            return 'graveyard'
    
    def _is_cross_shift(self, start_time: time, end_time: time) -> bool:
        """判斷是否跨時段"""
        start_shift = self._get_shift(start_time)
        end_shift = self._get_shift(end_time)
        return start_shift != end_shift
    
    def _hours_to_timedelta(self, hours: float):
        """將小時轉換為 timedelta"""
        from datetime import timedelta
        return timedelta(hours=hours)
    
    def _parse_time(self, time_str) -> time:
        """解析時間字串"""
        if isinstance(time_str, time):
            return time_str
        if isinstance(time_str, str):
            # 處理 "HH:MM" 或 "HH:MM:SS" 格式
            parts = time_str.split(':')
            return time(int(parts[0]), int(parts[1]))
        return time(0, 0)
    
    def calculate_utilization(self) -> float:
        """
        計算利用率
        
        Returns:
            利用率百分比
        """
        if not self.existing_schedules:
            return 0.0
        
        # 簡化計算：已排程手術數 / 可用手術室數
        total_rooms = len(self.available_rooms)
        if total_rooms == 0:
            return 0.0
        
        scheduled_count = len(self.existing_schedules)
        return min((scheduled_count / total_rooms) * 100, 100.0)