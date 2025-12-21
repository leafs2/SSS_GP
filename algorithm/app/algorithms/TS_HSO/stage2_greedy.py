"""
stage2_greedy.py - 修正版
第二階段：貪婪演算法時間排程
"""

from datetime import datetime, time
from typing import List, Dict, Optional
import logging

from app.models.scheduling import Surgery, ScheduleResult
from .fitness import calculate_ahp_score
from .constraints import (
    find_feasible_time_slots,
    calculate_shift_occupation
)

logger = logging.getLogger(__name__)


class Stage2GreedyScheduler:
    """第二階段：Greedy時間排程 - 修正版"""
    
    def __init__(self, db_connection):
        self.db = db_connection
    
    def schedule_surgeries(
        self, 
        surgeries: List[Surgery], 
        allocation: Dict[str, Dict]
    ) -> List[ScheduleResult]:
        """
        為手術安排具體時段
        
        修正重點：
        1. 正確記錄資源佔用（使用 cleanup_end_time）
        2. 改進錯誤處理
        3. 安全處理 allocation_score
        """
        # 計算AHP分數並排序
        surgeries_with_score = []
        for surgery in surgeries:
            if surgery.surgery_id not in allocation:
                logger.warning(f"手術 {surgery.surgery_id} 未在分配結果中，跳過")
                continue
                
            ahp_score = calculate_ahp_score(self.db, surgery)
            surgeries_with_score.append((surgery, ahp_score))
        
        # 按AHP分數排序（高→低）
        surgeries_with_score.sort(key=lambda x: x[1], reverse=True)
        
        logger.info(f"開始時間排程，共 {len(surgeries_with_score)} 台手術")
        
        schedule_results = []
        failed_surgeries = []
        
        # 建立資源佔用追蹤表 (包含醫師、助理、與手術室)
        current_resource_usage = {
            'doctor': {},
            'assistant': {},
            'room': {} 
        }
        
        # 貪婪插入
        for idx, (surgery, ahp_score) in enumerate(surgeries_with_score, 1):
            allocation_info = allocation[surgery.surgery_id]
            room_id = allocation_info['room_id']
            
            try:
                # 找可行時段 (傳入即時資源表)
                feasible_slots = find_feasible_time_slots(
                    self.db,
                    room_id,
                    surgery.surgery_date,
                    surgery.duration,
                    surgery.doctor_id,
                    surgery.assistant_doctor_id,
                    current_resource_usage=current_resource_usage
                )
                
                if not feasible_slots:
                    logger.warning(
                        f"[{idx}/{len(surgeries_with_score)}] "
                        f"手術 {surgery.surgery_id} 在 {room_id} 無可行時段"
                    )
                    failed_surgeries.append(surgery)
                    continue
                
                # 選擇最佳時段
                best_slot = self.select_best_slot(
                    feasible_slots,
                    surgery.duration
                )
                
                # [修正] 安全取得 allocation_score
                allocation_score = allocation_info.get('score', 0.0)
                
                # 建立排程結果
                result = self.create_schedule_result(
                    surgery,
                    room_id,
                    best_slot,
                    ahp_score,
                    allocation_score
                )
                
                schedule_results.append(result)
                
                # 更新當前資源佔用表
                self._update_resource_usage(
                    current_resource_usage,
                    surgery,
                    room_id,
                    result
                )
                
                logger.debug(
                    f"[{idx}/{len(surgeries_with_score)}] "
                    f"手術 {surgery.surgery_id} 排程成功: "
                    f"{room_id} {best_slot['start_time']}-{result.end_time}"
                )
                
            except Exception as e:
                logger.error(
                    f"排程手術 {surgery.surgery_id} 失敗: {str(e)}", 
                    exc_info=True
                )
                failed_surgeries.append(surgery)
        
        # 最終統計
        logger.info(
            f"時間排程完成: 成功 {len(schedule_results)} 台, "
            f"失敗 {len(failed_surgeries)} 台"
        )
        
        if failed_surgeries:
            logger.warning(
                f"失敗手術ID: {[s.surgery_id for s in failed_surgeries]}"
            )
        
        return schedule_results
    
    def _update_resource_usage(
        self,
        current_resource_usage: Dict,
        surgery: Surgery,
        room_id: str,
        result: ScheduleResult
    ):
        """
        更新資源佔用追蹤表
        
        修正重點：確保正確記錄 cleanup_end_time
        """
        # 1. 記錄主刀醫師
        if surgery.doctor_id:
            if surgery.doctor_id not in current_resource_usage['doctor']:
                current_resource_usage['doctor'][surgery.doctor_id] = []
            current_resource_usage['doctor'][surgery.doctor_id].append({
                'date': surgery.surgery_date,
                'start_time': result.start_time,
                'end_time': result.end_time  # 醫師只需到手術結束
            })
        
        # 2. 記錄助理醫師
        if surgery.assistant_doctor_id:
            if surgery.assistant_doctor_id not in current_resource_usage['assistant']:
                current_resource_usage['assistant'][surgery.assistant_doctor_id] = []
            current_resource_usage['assistant'][surgery.assistant_doctor_id].append({
                'date': surgery.surgery_date,
                'start_time': result.start_time,
                'end_time': result.end_time  # 助理也只需到手術結束
            })
        
        # 3. [關鍵修正] 記錄手術室（必須使用 cleanup_end_time）
        if room_id not in current_resource_usage['room']:
            current_resource_usage['room'][room_id] = []
        current_resource_usage['room'][room_id].append({
            'date': surgery.surgery_date,
            'start_time': result.start_time,
            'end_time': result.cleanup_end_time,  # [修正] 這裡必須用清潔結束時間
            'cleanup_end_time': result.cleanup_end_time
        })
    
    def select_best_slot(
        self, 
        feasible_slots: List[Dict], 
        duration: float
    ) -> Dict:
        """
        選擇最佳時段
        
        策略：
        1. 優先選擇早班（08:00-16:00）
        2. 同一時段內選擇最早的
        3. 避免跨時段（如果可能）
        """
        if not feasible_slots:
            raise ValueError("沒有可行時段")
        
        # 策略 1: 優先選擇早班且不跨時段的
        morning_slots = [
            s for s in feasible_slots 
            if s['start_time'].hour >= 8 
            and s['start_time'].hour < 16
            and not s.get('cross_shift', False)
        ]
        
        if morning_slots:
            return morning_slots[0]  # 最早的早班時段
        
        # 策略 2: 如果沒有完整的早班，選擇不跨時段的
        non_cross_slots = [
            s for s in feasible_slots 
            if not s.get('cross_shift', False)
        ]
        
        if non_cross_slots:
            return non_cross_slots[0]
        
        # 策略 3: 都沒有就選最早的
        return feasible_slots[0]
    
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
        
        return ScheduleResult(
            surgery_id=surgery.surgery_id,
            room_id=room_id,
            scheduled_date=surgery.surgery_date,
            start_time=start_time,
            end_time=end_time,
            cleanup_end_time=cleanup_end,
            primary_shift=primary_shift,
            is_cross_shift=slot.get('cross_shift', False),
            ahp_score=ahp_score,
            allocation_score=allocation_score
        )
    
    def find_and_insert(
        self, 
        surgery: Surgery, 
        existing_schedule: List[ScheduleResult]
    ) -> Optional[ScheduleResult]:
        """
        增量插入單一手術（用於動態新增）
        
        應用場景：當有新手術加入時，嘗試插入現有排程
        """
        logger.info(f"嘗試插入手術 {surgery.surgery_id}")
        
        # 先取得候選手術室
        from .constraints import get_candidate_rooms
        
        candidate_rooms = get_candidate_rooms(
            self.db,
            surgery.surgery_room_type,
            surgery.nurse_count,
            exclude_emergency=True
        )
        
        if not candidate_rooms:
            logger.warning(f"手術 {surgery.surgery_id} 無可用手術室")
            return None
        
        # 建立現有排程的資源佔用表
        current_resource_usage = self._build_resource_usage_from_schedule(
            existing_schedule,
            surgery.surgery_date
        )
        
        # 嘗試每個候選手術室
        best_result = None
        best_score = -float('inf')
        
        for room in candidate_rooms:
            room_id = room['id']
            
            # 找可行時段
            feasible_slots = find_feasible_time_slots(
                self.db,
                room_id,
                surgery.surgery_date,
                surgery.duration,
                surgery.doctor_id,
                surgery.assistant_doctor_id,
                current_resource_usage=current_resource_usage
            )
            
            if not feasible_slots:
                continue
            
            # 選擇最佳時段
            best_slot = self.select_best_slot(feasible_slots, surgery.duration)
            
            # 計算分數
            ahp_score = calculate_ahp_score(self.db, surgery)
            
            # 簡化的分配分數（可以改用更複雜的評估）
            allocation_score = len(feasible_slots) * 10  # 可行時段越多分數越高
            
            if allocation_score > best_score:
                best_score = allocation_score
                best_result = self.create_schedule_result(
                    surgery,
                    room_id,
                    best_slot,
                    ahp_score,
                    allocation_score
                )
        
        if best_result:
            logger.info(
                f"成功插入手術 {surgery.surgery_id} 到 "
                f"{best_result.room_id} {best_result.start_time}"
            )
        else:
            logger.warning(f"無法插入手術 {surgery.surgery_id}")
        
        return best_result
    
    def _build_resource_usage_from_schedule(
        self,
        existing_schedule: List[ScheduleResult],
        target_date
    ) -> Dict:
        """
        從現有排程建立資源佔用表
        """
        resource_usage = {
            'doctor': {},
            'assistant': {},
            'room': {}
        }
        
        # 只考慮目標日期的排程
        for result in existing_schedule:
            if result.scheduled_date != target_date:
                continue
            
            # 需要從資料庫查詢手術詳情以取得醫師資訊
            # 這裡簡化處理，實際應該查詢資料庫
            room_id = result.room_id
            
            if room_id not in resource_usage['room']:
                resource_usage['room'][room_id] = []
            
            resource_usage['room'][room_id].append({
                'date': result.scheduled_date,
                'start_time': result.start_time,
                'end_time': result.cleanup_end_time,  # 使用清潔結束時間
                'cleanup_end_time': result.cleanup_end_time
            })
        
        return resource_usage