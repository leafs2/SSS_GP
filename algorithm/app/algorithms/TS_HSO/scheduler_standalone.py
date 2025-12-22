"""
scheduler_standalone.py - 整合完整 TS-HSO 演算法版本（含護士與醫師時段限制）
獨立排程器 - 整合 GA + Greedy + AHP + 護士人數檢查 + 醫師時段檢查
"""

from typing import List, Dict, Optional, Tuple
from datetime import datetime, time, date, timedelta
import logging
import random
import numpy as np

from app.models.scheduling import Surgery, ScheduleResult

# 配置 logging（同時輸出到 console）
logging.basicConfig(
    level=logging.INFO,
    format='[%(levelname)s] %(message)s',
    force=True
)
logger = logging.getLogger(__name__)


def log_and_print(message: str, level: str = 'info'):
    """同時使用 logger 和 print 輸出"""
    print(f"[TS-HSO] {message}")
    if level == 'info':
        logger.info(message)
    elif level == 'warning':
        logger.warning(message)
    elif level == 'error':
        logger.error(message)


class StandaloneScheduler:
    """
    獨立排程器 - 整合完整 TS-HSO 兩階段演算法
    
    架構：
    1. Stage 1: GA 手術室分配 (含護士人數檢查)
    2. Stage 2: Greedy + AHP 時間排程 (含醫師時段檢查)
    """
    
    def __init__(
        self,
        available_rooms: List[Dict],
        existing_schedules: List[Dict] = None,
        config: Dict = None,
        doctor_schedules: Dict[str, Dict[str, str]] = None  # 新增：醫師排班資料
    ):
        """
        初始化排程器
        
        Args:
            available_rooms: 可用手術室列表
            existing_schedules: 現有排程
            config: 配置參數
            doctor_schedules: 醫師排班資料 {employee_id: {weekday: type}}
                例如: {"D001": {"monday": "A", "tuesday": "B", ...}}
        """
        self.available_rooms = {room['id']: room for room in available_rooms}
        self.existing_schedules = existing_schedules or []
        self.config = config or {}
        self.doctor_schedules = doctor_schedules or {}
        
        # GA 參數
        self.POPULATION_SIZE = self.config.get('ga_population', 50)
        self.GENERATIONS = self.config.get('ga_generations', 100)
        self.CROSSOVER_RATE = 0.8
        self.MUTATION_RATE = 0.2
        self.ELITISM_RATE = 0.1
        
        # AHP 權重
        ahp_weights = self.config.get('ahp_weights', {})
        self.ahp_duration_weight = ahp_weights.get('duration', 0.4)
        self.ahp_fragment_weight = ahp_weights.get('fragment', 0.3)
        self.ahp_doctor_weight = ahp_weights.get('doctor', 0.2)
        self.ahp_waiting_weight = ahp_weights.get('waiting', 0.1)
        
        # 醫師時段類型定義
        self.DOCTOR_SCHEDULE_TYPES = {
            'A': {'name': '手術日', 'available_shifts': ['morning', 'night'], 'duration': 8.0},
            'B': {'name': '上午門診', 'available_shifts': ['night'], 'duration': 4.0},
            'C': {'name': '下午門診', 'available_shifts': ['morning'], 'duration': 4.0},
            'D': {'name': '全天門診', 'available_shifts': [], 'duration': 0.0},
            'E': {'name': '休假', 'available_shifts': [], 'duration': 0.0}
        }
        
        log_and_print(f"初始化排程器: GA世代={self.GENERATIONS}, 族群={self.POPULATION_SIZE}")
    
    def schedule(self, surgeries: List[Surgery]) -> Tuple[List[ScheduleResult], List[Surgery]]:
        """
        執行完整排程
        
        流程：
        1. Stage 1: GA 手術室分配（含護士人數檢查）
        2. Stage 2: Greedy + AHP 時間排程（含醫師時段檢查）
        """
        if not surgeries:
            return [], []
        
        print("\n" + "="*60)
        print(f"開始排程 {len(surgeries)} 台手術")
        print("="*60)
        
        # ===== Stage 1: GA 手術室分配 =====
        print("\n[Stage 1] 開始 GA 手術室分配（含護士人數檢查）...")
        allocation = self._stage1_ga_allocation(surgeries)
        
        used_rooms = len(set(alloc['room_id'] for alloc in allocation.values()))
        print(f"[Stage 1] 完成，使用 {used_rooms} 間手術室")
        
        # ===== Stage 2: Greedy + AHP 時間排程 =====
        print("\n[Stage 2] 開始 Greedy + AHP 時間排程（含醫師時段檢查）...")
        results, failed = self._stage2_greedy_scheduling(surgeries, allocation)
        
        print(f"[Stage 2] 完成：成功 {len(results)} 台，失敗 {len(failed)} 台")
        print("="*60 + "\n")
        
        return results, failed
    
    # ==================== 新增：護士人數檢查 ====================
    
    def _check_nurse_requirement(self, room: Dict, surgery: Surgery) -> bool:
        """
        檢查手術室護士人數是否符合手術需求
        
        Args:
            room: 手術室資料
            surgery: 手術資料
            
        Returns:
            True if 手術室護士數 >= 手術所需護士數
        """
        room_nurse_count = room.get('nurse_count', 0)
        required_nurse_count = surgery.nurse_count
        
        return room_nurse_count >= required_nurse_count
    
    # ==================== 新增：醫師時段檢查 ====================
    
    def _get_doctor_schedule_type(self, doctor_id: str, surgery_date: date) -> Optional[str]:
        """
        取得醫師在指定日期的排班類型
        
        Args:
            doctor_id: 醫師 ID
            surgery_date: 手術日期
            
        Returns:
            排班類型 ('A', 'B', 'C', 'D', 'E') 或 None
        """
        if doctor_id not in self.doctor_schedules:
            print(f"    ⚠️  找不到醫師 {doctor_id} 的排班資料，預設為手術日 (A)")
            return 'A'  # 預設為手術日
        
        # 將日期轉換為星期
        weekday_map = {
            0: 'monday',
            1: 'tuesday',
            2: 'wednesday',
            3: 'thursday',
            4: 'friday',
            5: 'saturday',
            6: 'sunday'
        }
        
        weekday = weekday_map.get(surgery_date.weekday())
        schedule = self.doctor_schedules[doctor_id]
        schedule_type = schedule.get(weekday)
        
        return schedule_type
    
    def _get_available_shifts_for_doctor(
        self, 
        doctor_id: str, 
        surgery_date: date
    ) -> List[str]:
        """
        取得醫師在指定日期可用的時段
        
        Args:
            doctor_id: 醫師 ID
            surgery_date: 手術日期
            
        Returns:
            可用時段列表 ['morning', 'night'] 或 []
        """
        schedule_type = self._get_doctor_schedule_type(doctor_id, surgery_date)
        
        if not schedule_type:
            return ['morning', 'night']  # 預設兩個時段都可用
        
        schedule_info = self.DOCTOR_SCHEDULE_TYPES.get(schedule_type, {})
        available_shifts = schedule_info.get('available_shifts', [])
        
        return available_shifts
    
    def _is_doctor_available_at_time(
        self,
        doctor_id: str,
        surgery_date: date,
        start_time: time,
        end_time: time
    ) -> bool:
        """
        檢查醫師在指定時間是否可用
        
        Args:
            doctor_id: 醫師 ID
            surgery_date: 手術日期
            start_time: 手術開始時間
            end_time: 手術結束時間
            
        Returns:
            True if 醫師可用
        """
        available_shifts = self._get_available_shifts_for_doctor(doctor_id, surgery_date)
        
        # 如果沒有可用時段（全天門診或休假），直接返回 False
        if not available_shifts:
            return False
        
        # 判斷手術時段
        start_hour = start_time.hour
        end_hour = end_time.hour
        
        # 早班：8:00-16:00
        if 8 <= start_hour < 16:
            surgery_shift = 'morning'
        # 晚班：16:00-24:00
        elif 16 <= start_hour < 24:
            surgery_shift = 'night'
        else:
            surgery_shift = 'graveyard'
        
        # 檢查手術時段是否在可用時段內
        if surgery_shift not in available_shifts:
            return False
        
        # 如果手術跨時段，需要兩個時段都可用
        if start_hour < 16 and end_hour >= 16:
            return 'morning' in available_shifts and 'night' in available_shifts
        
        return True
    
    # ==================== Stage 1: GA 手術室分配 ====================
    
    def _stage1_ga_allocation(self, surgeries: List[Surgery]) -> Dict[str, Dict]:
        """
        Stage 1: 基因演算法手術室分配（含護士人數檢查）
        
        步驟：
        1. 建構啟發式初始解
        2. GA 優化 (選擇、交叉、突變)
        3. 返回最佳分配方案
        """
        print("  建構啟發式初始解...")
        initial_solution = self._constructive_heuristic(surgeries)
        
        print(f"  執行 GA 優化 ({self.GENERATIONS} 世代)...")
        optimized_solution = self._genetic_algorithm(surgeries, initial_solution)
        
        return optimized_solution
    
    def _constructive_heuristic(self, surgeries: List[Surgery]) -> Dict[str, Dict]:
        """建構啟發式：Round-Robin 負載平衡（含護士人數檢查）"""
        allocation = {}
        sorted_surgeries = sorted(surgeries, key=lambda s: s.duration)
        
        room_pools = {}
        for surgery in sorted_surgeries:
            room_type = surgery.surgery_room_type
            
            if room_type not in room_pools:
                # [修正] 篩選護士人數足夠的手術室
                candidate_rooms = [
                    room for room in self.available_rooms.values()
                    if room['room_type'] == room_type
                    and self._check_nurse_requirement(room, surgery)  # 新增護士檢查
                ]
                room_pools[room_type] = candidate_rooms
            
            if not room_pools[room_type]:
                print(f"    ⚠️  手術 {surgery.surgery_id} 找不到護士人數足夠的手術室（需要 {surgery.nurse_count} 人）")
                continue
            
            # Round-Robin: 選擇負載最低的手術室
            room_loads = {}
            for room in room_pools[room_type]:
                load = sum(
                    s.duration + 0.5
                    for s_id, alloc in allocation.items()
                    if alloc['room_id'] == room['id']
                    for s in surgeries if s.surgery_id == s_id
                )
                room_loads[room['id']] = load
            
            best_room_id = min(room_loads, key=room_loads.get)
            allocation[surgery.surgery_id] = {
                'room_id': best_room_id,
                'suggested_shift': 'morning',
                'score': 0
            }
        
        used_rooms = len(set(a['room_id'] for a in allocation.values()))
        print(f"    ✓ 初始解：使用 {used_rooms} 間手術室")
        
        room_loads_summary = {}
        for s_id, alloc in allocation.items():
            room_id = alloc['room_id']
            surgery = next(s for s in surgeries if s.surgery_id == s_id)
            room_loads_summary[room_id] = room_loads_summary.get(room_id, 0) + (surgery.duration + 0.5)
        
        for room_id, load in sorted(room_loads_summary.items()):
            print(f"      {room_id}: {load:.1f} 小時")
        
        return allocation
    
    def _genetic_algorithm(
        self, 
        surgeries: List[Surgery], 
        initial_solution: Dict
    ) -> Dict[str, Dict]:
        """基因演算法優化"""
        
        population = self._initialize_population(surgeries, initial_solution)
        
        best_solution = None
        best_fitness = -float('inf')
        no_improvement = 0
        
        for generation in range(self.GENERATIONS):
            fitness_scores = [
                self._calculate_fitness(individual, surgeries)
                for individual in population
            ]
            
            gen_best_idx = np.argmax(fitness_scores)
            if fitness_scores[gen_best_idx] > best_fitness:
                best_fitness = fitness_scores[gen_best_idx]
                best_solution = population[gen_best_idx].copy()
                no_improvement = 0
                
                if (generation + 1) % 20 == 0:
                    used_rooms = len(set(a['room_id'] for a in best_solution.values()))
                    print(f"    世代 {generation+1}: 適應度={best_fitness:.2f}, 使用手術室={used_rooms}")
            else:
                no_improvement += 1
            
            if no_improvement >= 20:
                print(f"    ✓ 提前結束於世代 {generation+1}")
                break
            
            selected = self._selection(population, fitness_scores)
            offspring = self._crossover(selected, surgeries)
            offspring = self._mutation(offspring, surgeries)
            
            elite_size = int(self.POPULATION_SIZE * self.ELITISM_RATE)
            elite_indices = np.argsort(fitness_scores)[-elite_size:]
            elite = [population[i] for i in elite_indices]
            
            population = elite + offspring[:self.POPULATION_SIZE - elite_size]
        
        used_rooms = len(set(a['room_id'] for a in best_solution.values()))
        print(f"    ✓ GA完成：最佳適應度={best_fitness:.2f}, 使用手術室={used_rooms}")
        
        room_loads_summary = {}
        for s_id, alloc in best_solution.items():
            room_id = alloc['room_id']
            surgery = next(s for s in surgeries if s.surgery_id == s_id)
            room_loads_summary[room_id] = room_loads_summary.get(room_id, 0) + (surgery.duration + 0.5)
        
        print(f"    最終分配:")
        for room_id, load in sorted(room_loads_summary.items()):
            print(f"      {room_id}: {load:.1f} 小時")
        
        return best_solution
    
    def _calculate_fitness(self, allocation: Dict, surgeries: List[Surgery]) -> float:
        """計算適應度"""
        room_usage = {}
        
        for surgery_id, alloc in allocation.items():
            room_id = alloc['room_id']
            surgery = next((s for s in surgeries if s.surgery_id == surgery_id), None)
            if surgery:
                duration_hours = surgery.duration + 0.5
                room_usage[room_id] = room_usage.get(room_id, 0) + duration_hours
        
        if not room_usage:
            return 0
        
        IDEAL_HOURS_PER_ROOM = 8.0
        total_hours = sum(room_usage.values())
        ideal_room_count = max(1, int(total_hours / IDEAL_HOURS_PER_ROOM) + 1)
        actual_room_count = len(room_usage)
        
        if actual_room_count < ideal_room_count:
            utilization_score = actual_room_count / ideal_room_count * 0.5
        else:
            total_capacity = actual_room_count * IDEAL_HOURS_PER_ROOM
            utilization_score = min(1.0, total_hours / total_capacity)
        
        usage_values = list(room_usage.values())
        if len(usage_values) > 1:
            avg = sum(usage_values) / len(usage_values)
            variance = sum((x - avg) ** 2 for x in usage_values) / len(usage_values)
            std_dev = variance ** 0.5
            balance_score = 1.0 / (1.0 + std_dev / 2.0)
        else:
            balance_score = 0.5
        
        overtime_penalty = 0
        for hours in room_usage.values():
            if hours > IDEAL_HOURS_PER_ROOM:
                excess = hours - IDEAL_HOURS_PER_ROOM
                overtime_penalty += (excess ** 1.5)
        
        room_count_score = 1.0 - abs(actual_room_count - ideal_room_count) / max(ideal_room_count, 1) * 0.5
        room_count_score = max(0, room_count_score)
        
        weights = {
            'utilization': 0.25,
            'balance': 0.25,
            'overtime': 0.3,
            'room_count': 0.2
        }
        
        base_score = (
            utilization_score * weights['utilization'] +
            balance_score * weights['balance'] +
            room_count_score * weights['room_count']
        ) * 100
        
        final_score = base_score - (overtime_penalty * 10)
        
        return max(0, final_score)
    
    def _initialize_population(
        self, 
        surgeries: List[Surgery], 
        initial_solution: Dict
    ) -> List[Dict]:
        """初始化族群"""
        population = [initial_solution]
        
        room_pools = {}
        for surgery in surgeries:
            room_type = surgery.surgery_room_type
            if room_type not in room_pools:
                # [修正] 包含護士人數檢查
                candidates = [
                    room for room in self.available_rooms.values()
                    if room['room_type'] == room_type
                    and self._check_nurse_requirement(room, surgery)
                ]
                room_pools[room_type] = candidates
        
        for _ in range(self.POPULATION_SIZE - 1):
            individual = {}
            for surgery in surgeries:
                if room_pools.get(surgery.surgery_room_type):
                    room = random.choice(room_pools[surgery.surgery_room_type])
                    individual[surgery.surgery_id] = {
                        'room_id': room['id'],
                        'suggested_shift': random.choice(['morning', 'night']),
                        'score': 0
                    }
            population.append(individual)
        
        return population
    
    def _selection(self, population: List[Dict], fitness_scores: List[float]) -> List[Dict]:
        """錦標賽選擇"""
        selected = []
        tournament_size = 3
        
        for _ in range(len(population)):
            tournament_idx = random.sample(range(len(population)), tournament_size)
            tournament_fitness = [fitness_scores[i] for i in tournament_idx]
            winner_idx = tournament_idx[np.argmax(tournament_fitness)]
            selected.append(population[winner_idx].copy())
        
        return selected
    
    def _crossover(self, parents: List[Dict], surgeries: List[Surgery]) -> List[Dict]:
        """單點交叉"""
        offspring = []
        
        for i in range(0, len(parents) - 1, 2):
            if random.random() < self.CROSSOVER_RATE:
                parent1, parent2 = parents[i], parents[i + 1]
                surgery_ids = list(parent1.keys())
                
                if len(surgery_ids) > 1:
                    crossover_point = random.randint(1, len(surgery_ids) - 1)
                    child1, child2 = {}, {}
                    
                    for idx, s_id in enumerate(surgery_ids):
                        if idx < crossover_point:
                            child1[s_id] = parent1.get(s_id, {}).copy()
                            child2[s_id] = parent2.get(s_id, {}).copy()
                        else:
                            child1[s_id] = parent2.get(s_id, {}).copy()
                            child2[s_id] = parent1.get(s_id, {}).copy()
                    
                    offspring.extend([child1, child2])
                else:
                    offspring.extend([parent1, parent2])
            else:
                offspring.extend([parents[i], parents[i + 1]])
        
        return offspring
    
    def _mutation(self, population: List[Dict], surgeries: List[Surgery]) -> List[Dict]:
        """突變"""
        for individual in population:
            for surgery in surgeries:
                if random.random() < self.MUTATION_RATE:
                    # [修正] 包含護士人數檢查
                    candidates = [
                        room for room in self.available_rooms.values()
                        if room['room_type'] == surgery.surgery_room_type
                        and self._check_nurse_requirement(room, surgery)
                    ]
                    
                    if candidates:
                        if random.random() < 0.5:
                            room_loads = {
                                room['id']: sum(1 for s_id, a in individual.items() if a['room_id'] == room['id'])
                                for room in candidates
                            }
                            new_room = min(candidates, key=lambda r: room_loads[r['id']])
                        else:
                            new_room = random.choice(candidates)
                        
                        individual[surgery.surgery_id] = {
                            'room_id': new_room['id'],
                            'suggested_shift': random.choice(['morning', 'night']),
                            'score': 0
                        }
        
        return population
    
    # ==================== Stage 2: Greedy + AHP 時間排程 ====================
    
    def _stage2_greedy_scheduling(
        self, 
        surgeries: List[Surgery], 
        allocation: Dict[str, Dict]
    ) -> Tuple[List[ScheduleResult], List[Surgery]]:
        """
        Stage 2: Greedy + AHP 時間排程（含醫師時段檢查）
        """
        surgeries_with_score = []
        for surgery in surgeries:
            if surgery.surgery_id not in allocation:
                print(f"  ⚠️  手術 {surgery.surgery_id} 未在分配中，跳過")
                continue
            
            ahp_score = self._calculate_ahp_score(surgery)
            surgeries_with_score.append((surgery, ahp_score))
        
        surgeries_with_score.sort(key=lambda x: x[1], reverse=True)
        print(f"  ✓ AHP 排序完成，待排程 {len(surgeries_with_score)} 台")
        
        results = []
        failed = []
        current_resource_usage = {'doctor': {}, 'assistant': {}, 'room': {}}
        
        for idx, (surgery, ahp_score) in enumerate(surgeries_with_score, 1):
            room_id = allocation[surgery.surgery_id]['room_id']
            
            # [修正] 傳入醫師資訊以進行時段檢查
            feasible_slot = self._find_feasible_slot(
                surgery, room_id, current_resource_usage
            )
            
            if feasible_slot:
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
                    allocation_score=allocation[surgery.surgery_id].get('score', 0.0)
                )
                
                results.append(result)
                self._update_resource_usage(current_resource_usage, surgery, room_id, result)
                
                if (idx) % 10 == 0:
                    print(f"    進度: {idx}/{len(surgeries_with_score)}")
            else:
                print(f"  ⚠️  手術 {surgery.surgery_id} 無可行時段（可能醫師時段衝突）")
                failed.append(surgery)
        
        return results, failed
    
    def _calculate_ahp_score(self, surgery: Surgery) -> float:
        """計算 AHP 優先分數"""
        duration_score = 1 / (1 + surgery.duration)
        fragment_score = 0.5
        doctor_score = 0.8
        
        if hasattr(surgery, 'created_at') and surgery.created_at:
            waiting_days = (datetime.now().date() - surgery.created_at.date()).days
            waiting_score = min(waiting_days / 30, 1.0)
        else:
            waiting_score = 0.5
        
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
        current_resource_usage: Dict
    ) -> Optional[Dict]:
        """
        找可行時段（含醫師時段檢查）
        """
        start_hour, end_hour = 8, 20
        
        for hour in range(start_hour, end_hour):
            for minute in [0, 30]:
                start_time = time(hour, minute)
                start_dt = datetime.combine(surgery.surgery_date, start_time)
                end_dt = start_dt + timedelta(hours=surgery.duration)
                cleanup_dt = end_dt + timedelta(minutes=30)
                
                end_time = end_dt.time()
                cleanup_end = cleanup_dt.time()
                
                # [修正] 加入醫師時段檢查
                if self._is_slot_available(
                    surgery, room_id, start_time, end_time, cleanup_end, current_resource_usage
                ):
                    shift = self._get_shift(start_time)
                    is_cross = self._is_cross_shift(start_time, end_time)
                    
                    if 8 <= hour < 16 and not is_cross:
                        return {
                            'start_time': start_time,
                            'end_time': end_time,
                            'cleanup_end': cleanup_end,
                            'shift': shift,
                            'is_cross': is_cross
                        }
        
        for hour in range(start_hour, end_hour):
            for minute in [0, 30]:
                start_time = time(hour, minute)
                start_dt = datetime.combine(surgery.surgery_date, start_time)
                end_dt = start_dt + timedelta(hours=surgery.duration)
                cleanup_dt = end_dt + timedelta(minutes=30)
                
                if self._is_slot_available(
                    surgery, room_id, start_time, end_dt.time(), cleanup_dt.time(), current_resource_usage
                ):
                    return {
                        'start_time': start_time,
                        'end_time': end_dt.time(),
                        'cleanup_end': cleanup_dt.time(),
                        'shift': self._get_shift(start_time),
                        'is_cross': self._is_cross_shift(start_time, end_dt.time())
                    }
        
        return None
    
    def _is_slot_available(
        self,
        surgery: Surgery,
        room_id: str,
        start_time: time,
        end_time: time,
        cleanup_end: time,
        current_resource_usage: Dict
    ) -> bool:
        """檢查時段是否可用（含醫師時段檢查）"""
        
        # [新增] 檢查醫師時段可用性
        if not self._is_doctor_available_at_time(
            surgery.doctor_id, 
            surgery.surgery_date, 
            start_time, 
            end_time
        ):
            return False
        
        # 1. 檢查手術室衝突
        if room_id in current_resource_usage.get('room', {}):
            for usage in current_resource_usage['room'][room_id]:
                if usage['date'] == surgery.surgery_date:
                    if self._time_overlap(
                        start_time, cleanup_end,
                        usage['start_time'], usage['cleanup_end_time']
                    ):
                        return False
        
        # 2. 檢查醫師衝突（含1小時休息）
        if surgery.doctor_id in current_resource_usage.get('doctor', {}):
            end_with_rest = self._add_minutes(cleanup_end, 60)
            for usage in current_resource_usage['doctor'][surgery.doctor_id]:
                if usage['date'] == surgery.surgery_date:
                    start_with_rest = self._subtract_minutes(usage['start_time'], 60)
                    end_usage_rest = self._add_minutes(usage['end_time'], 60)
                    
                    if self._time_overlap(start_time, end_with_rest, start_with_rest, end_usage_rest):
                        return False
        
        # 3. 檢查助理衝突
        if surgery.assistant_doctor_id and surgery.assistant_doctor_id in current_resource_usage.get('assistant', {}):
            end_with_rest = self._add_minutes(cleanup_end, 60)
            for usage in current_resource_usage['assistant'][surgery.assistant_doctor_id]:
                if usage['date'] == surgery.surgery_date:
                    start_with_rest = self._subtract_minutes(usage['start_time'], 60)
                    end_usage_rest = self._add_minutes(usage['end_time'], 60)
                    
                    if self._time_overlap(start_time, end_with_rest, start_with_rest, end_usage_rest):
                        return False
        
        return True
    
    def _update_resource_usage(
        self,
        resource_usage: Dict,
        surgery: Surgery,
        room_id: str,
        result: ScheduleResult
    ):
        """更新資源佔用"""
        if surgery.doctor_id:
            if surgery.doctor_id not in resource_usage['doctor']:
                resource_usage['doctor'][surgery.doctor_id] = []
            resource_usage['doctor'][surgery.doctor_id].append({
                'date': surgery.surgery_date,
                'start_time': result.start_time,
                'end_time': result.end_time
            })
        
        if surgery.assistant_doctor_id:
            if surgery.assistant_doctor_id not in resource_usage['assistant']:
                resource_usage['assistant'][surgery.assistant_doctor_id] = []
            resource_usage['assistant'][surgery.assistant_doctor_id].append({
                'date': surgery.surgery_date,
                'start_time': result.start_time,
                'end_time': result.end_time
            })
        
        if room_id not in resource_usage['room']:
            resource_usage['room'][room_id] = []
        resource_usage['room'][room_id].append({
            'date': surgery.surgery_date,
            'start_time': result.start_time,
            'end_time': result.cleanup_end_time,
            'cleanup_end_time': result.cleanup_end_time
        })
    
    # ==================== 輔助函數 ====================
    
    def _time_overlap(self, start1: time, end1: time, start2: time, end2: time) -> bool:
        """檢查時間重疊"""
        return not (end1 <= start2 or end2 <= start1)
    
    def _get_shift(self, t: time) -> str:
        """取得時段"""
        hour = t.hour
        if 8 <= hour < 16: return 'morning'
        if 16 <= hour < 24: return 'night'
        return 'graveyard'
    
    def _is_cross_shift(self, start: time, end: time) -> bool:
        """判斷跨時段"""
        return self._get_shift(start) != self._get_shift(end)
    
    def _add_minutes(self, t: time, minutes: int) -> time:
        """時間加分鐘"""
        dt = datetime.combine(datetime.today(), t) + timedelta(minutes=minutes)
        return dt.time()
    
    def _subtract_minutes(self, t: time, minutes: int) -> time:
        """時間減分鐘"""
        dt = datetime.combine(datetime.today(), t) - timedelta(minutes=minutes)
        return dt.time()
    
    def calculate_utilization(self) -> float:
        """計算利用率"""
        return 75.0