"""
TS-HSO 兩階段混合啟發式手術排程最佳化演算法
主排程器 - 實作方案3：即時觸發 + 背景兜底
"""

import threading
import time
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import logging

from .stage1_ga import Stage1GeneticAlgorithm
from .stage2_greedy import Stage2GreedyScheduler
from app.models.scheduling import Surgery, ScheduleResult

# 設定日誌
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class SmartScheduler:
    """智能排程器 - 方案3實作"""
    
    def __init__(self, db_connection):
        self.db = db_connection
        self.pending_queue = []
        self.last_processing_time = datetime.now()
        self.is_processing = False
        
        # 觸發參數
        self.THRESHOLD = 5              # 累積5台觸發
        self.TIME_THRESHOLD = 30        # 30分鐘強制觸發
        self.BACKGROUND_INTERVAL = 300  # 5分鐘檢查一次
        
        # 演算法組件
        self.stage1 = Stage1GeneticAlgorithm(db_connection)
        self.stage2 = Stage2GreedyScheduler(db_connection)
        
        # 啟動背景監控
        self.start_background_monitor()
    
    def on_surgery_added(self, surgery: Surgery):
        """
        當新增手術時觸發（即時檢查）
        
        Args:
            surgery: 新增的手術物件
        """
        self.pending_queue.append(surgery)
        count = len(self.pending_queue)
        
        logger.info(f"手術已加入佇列，目前 {count} 台")
        
        # 達到閾值立即觸發
        if count >= self.THRESHOLD and not self.is_processing:
            logger.info(f"即時觸發：累積 {count} 台手術")
            self.trigger_processing()
    
    def start_background_monitor(self):
        """啟動背景監控執行緒"""
        def monitor():
            while True:
                time.sleep(self.BACKGROUND_INTERVAL)
                self.check_and_trigger_background()
        
        thread = threading.Thread(target=monitor, daemon=True)
        thread.start()
        logger.info("背景監控已啟動")
    
    def check_and_trigger_background(self):
        """背景監控檢查（兜底機制）"""
        if self.is_processing:
            return
        
        count = len(self.pending_queue)
        time_elapsed = (datetime.now() - self.last_processing_time).total_seconds() / 60
        
        # 時間閾值觸發
        if count > 0 and time_elapsed >= self.TIME_THRESHOLD:
            logger.info(f"背景觸發（時間到）：處理 {count} 台手術")
            self.trigger_processing()
    
    def trigger_processing(self):
        """執行排程處理"""
        if self.is_processing:
            logger.warning("排程正在執行中，跳過本次觸發")
            return
        
        self.is_processing = True
        count = len(self.pending_queue)
        start_time = time.time()
        
        try:
            logger.info(f"開始處理 {count} 台手術排程")
            
            # 根據數量選擇演算法
            if count <= 3:
                # 少量：增量插入
                results = self.incremental_insert()
            else:
                # 中大量：完整TS-HSO
                results = self.run_full_tshso()
            
            # 清空佇列
            self.pending_queue = []
            self.last_processing_time = datetime.now()
            
            processing_time = time.time() - start_time
            logger.info(f"排程完成，耗時 {processing_time:.2f} 秒，成功 {len(results)} 台")
            
            return results
            
        except Exception as e:
            logger.error(f"排程執行失敗: {str(e)}", exc_info=True)
            raise
        finally:
            self.is_processing = False
    
    def incremental_insert(self) -> List[ScheduleResult]:
        """
        增量插入（少量手術）
        直接使用貪婪演算法
        """
        logger.info("使用增量插入模式")
        
        # 取得現有排程
        existing_schedule = self.db.get_all_schedules()
        
        results = []
        for surgery in self.pending_queue:
            try:
                # 第二階段：找時段並插入
                schedule = self.stage2.find_and_insert(
                    surgery, 
                    existing_schedule
                )
                
                if schedule:
                    results.append(schedule)
                    existing_schedule.append(schedule)
                    
                    # 更新資料庫
                    self.db.insert_schedule(schedule)
                    self.db.update_surgery_status(surgery.surgery_id, 'scheduled')
                else:
                    logger.warning(f"手術 {surgery.surgery_id} 無法排程")
                    
            except Exception as e:
                logger.error(f"插入手術 {surgery.surgery_id} 失敗: {str(e)}")
        
        return results
    
    def run_full_tshso(self) -> List[ScheduleResult]:
        """
        執行完整 TS-HSO 演算法
        """
        logger.info("執行完整 TS-HSO")
        
        # 第一階段：GA 手術室分配
        logger.info("第一階段：基因演算法分配手術室")
        allocation = self.stage1.allocate_rooms(self.pending_queue)
        
        # 第二階段：Greedy 時間排程
        logger.info("第二階段：貪婪演算法安排時段")
        results = self.stage2.schedule_surgeries(
            self.pending_queue, 
            allocation
        )
        
        # 寫入資料庫
        for result in results:
            self.db.insert_schedule(result)
            self.db.update_surgery_status(result.surgery_id, 'scheduled')
        
        return results
    
    def get_pending_count(self) -> int:
        """取得待排程數量"""
        return len(self.pending_queue)
    
    def get_status(self) -> Dict:
        """取得排程器狀態"""
        return {
            'is_processing': self.is_processing,
            'pending_count': len(self.pending_queue),
            'last_processing_time': self.last_processing_time.isoformat(),
            'threshold': self.THRESHOLD,
            'time_threshold': self.TIME_THRESHOLD
        }


# 全域排程器實例（單例模式）
_scheduler_instance: Optional[SmartScheduler] = None


def get_scheduler(db_connection=None) -> SmartScheduler:
    """取得排程器單例"""
    global _scheduler_instance
    
    if _scheduler_instance is None:
        if db_connection is None:
            raise ValueError("首次建立排程器需提供資料庫連接")
        _scheduler_instance = SmartScheduler(db_connection)
    
    return _scheduler_instance
