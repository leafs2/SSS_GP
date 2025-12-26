"""
scheduler_standalone.py - TS-HSO 最終旗艦修正版 (含詳細原因分析)
修正重點：
1. [新增] 詳細失敗原因分析：在搜尋時段時，記錄所有被拒絕的原因 (醫師忙碌、房間滿...等)。
2. [優化] 延遲手術標註：若手術被迫排在較晚時段，會顯示「為何前面時段不行」。
3. [優化] 失敗手術標註：若手術完全排不進去，會顯示「整天失敗的主因」。
4. [保留] 醫師跨房懲罰、Packing 策略、防延遲救援機制。
"""

from typing import List, Dict, Optional, Tuple, Set
from datetime import datetime, time, date, timedelta
import logging
import random
import numpy as np

from app.models.scheduling import Surgery, ScheduleResult

# 配置 logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(levelname)s] %(message)s',
    force=True
)
logger = logging.getLogger(__name__)

def log_and_print(message: str, level: str = 'info'):
    print(f"[TS-HSO] {message}")
    if level == 'info': logger.info(message)
    elif level == 'warning': logger.warning(message)
    elif level == 'error': logger.error(message)

class StandaloneScheduler:
    def __init__(
        self,
        available_rooms: List[Dict],
        existing_schedules: List[Dict] = None,
        config: Dict = None,
        doctor_schedules: Dict[str, Dict[str, str]] = None
    ):
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
        
        # 權重
        ahp_weights = self.config.get('ahp_weights', {})
        self.ahp_duration_weight = ahp_weights.get('duration', 0.4)
        
        # 醫師緩衝時間 (分鐘)
        self.DOCTOR_BUFFER_MINUTES = 30
        
        self.DOCTOR_SCHEDULE_TYPES = {
            'A': {'name': '手術日', 'available_shifts': ['morning', 'night'], 'duration': 8.0},
            'B': {'name': '上午門診', 'available_shifts': ['night'], 'duration': 4.0},
            'C': {'name': '下午門診', 'available_shifts': ['morning'], 'duration': 4.0},
            'D': {'name': '全天門診', 'available_shifts': [], 'duration': 0.0},
            'E': {'name': '休假', 'available_shifts': [], 'duration': 0.0}
        }
        
        log_and_print(f"初始化排程器: GA世代={self.GENERATIONS}, 醫師緩衝={self.DOCTOR_BUFFER_MINUTES}min")
    
    def schedule(self, surgeries: List[Surgery]) -> Tuple[List[ScheduleResult], List[Surgery]]:
        if not surgeries: return [], []
        
        print("\n" + "="*80)
        print(f"開始排程 {len(surgeries)} 台手術")
        print("="*80)
        
        # Stage 1
        print("\n[Stage 1] 開始 GA 手術室分配...")
        allocation = self._stage1_ga_allocation(surgeries)
        
        # 顯示詳情與統計
        self._print_stage1_details(allocation, surgeries)
        self._print_daily_stats(allocation, surgeries)
        
        # Stage 2
        print("\n[Stage 2] 開始 Greedy + AHP 時間排程 (含防延遲救援)...")
        results, failed = self._stage2_greedy_scheduling(surgeries, allocation)
        
        # 顯示 Stage 2 結果
        self._print_stage2_details(results, failed)

        print("="*80 + "\n")
        return results, failed
    
    # ==================== 核心工具 ====================
    
    def _get_room_max_hours(self, room: Dict) -> float:
        max_hours = 0.0
        if room.get('morning_shift', False): max_hours += 8.0
        if room.get('night_shift', False): max_hours += 8.0
        if room.get('graveyard_shift', False): max_hours += 8.0
        return max_hours

    def _get_current_load(self, room_id: str, date: date, allocation: Dict, surgeries: List[Surgery]) -> float:
        load = 0.0
        for s_id, alloc in allocation.items():
            if alloc.get('room_id') == room_id:
                s = next((surg for surg in surgeries if surg.surgery_id == s_id), None)
                if s and s.surgery_date == date:
                    load += (s.duration + 0.5)
        return load
    
    def _check_nurse_requirement(self, room: Dict, surgery: Surgery) -> bool:
        return room.get('nurse_count', 0) >= surgery.nurse_count
    
    def _check_shift_availability(self, room: Dict, surgery: Surgery, start_time: time) -> bool:
        hour = start_time.hour
        if 8 <= hour < 16: return room.get('morning_shift', False)
        elif 16 <= hour < 24: return room.get('night_shift', False)
        else: return room.get('graveyard_shift', False)

    # ==================== Stage 1: GA 手術室分配 ====================
    
    def _stage1_ga_allocation(self, surgeries: List[Surgery]) -> Dict[str, Dict]:
        print("  建構啟發式初始解 (目標平均 6.5~7.5h 策略)...")
        initial_solution = self._constructive_heuristic(surgeries)
        
        print(f"  執行 GA 優化 ({self.GENERATIONS} 世代)...")
        optimized_solution = self._genetic_algorithm(surgeries, initial_solution)
        
        return optimized_solution
    
    def _constructive_heuristic(self, surgeries: List[Surgery]) -> Dict[str, Dict]:
        allocation = {}
        sorted_surgeries = sorted(surgeries, key=lambda s: s.duration, reverse=True)
        debug_msg_shown = set()

        for surgery in sorted_surgeries:
            room_type = surgery.surgery_room_type
            candidates = []
            
            for room in self.available_rooms.values():
                if room['room_type'] != room_type: continue
                if not self._check_nurse_requirement(room, surgery):
                    check_key = (room['id'], surgery.nurse_count)
                    if check_key not in debug_msg_shown:
                        print(f"  [DEBUG] 手術 {surgery.surgery_id} (需{surgery.nurse_count}人) 跳過 {room['id']} (僅{room.get('nurse_count')}人)")
                        debug_msg_shown.add(check_key)
                    continue
                candidates.append(room)
            
            if not candidates:
                fallback = [r for r in self.available_rooms.values() if r['room_type'] == room_type]
                if fallback:
                    allocation[surgery.surgery_id] = {'room_id': fallback[0]['id'], 'score': -999}
                continue

            surgery_date = surgery.surgery_date
            room_status = []
            
            for room in candidates:
                current_load = self._get_current_load(room['id'], surgery_date, allocation, surgeries)
                max_phys_limit = self._get_room_max_hours(room)
                new_load = current_load + surgery.duration + 0.5
                
                room_status.append({
                    'room': room,
                    'current_load': current_load,
                    'new_load': new_load,
                    'max_limit': max_phys_limit,
                    'has_night': room.get('night_shift', False)
                })
            
            # Packing 策略
            ideal_fill = [x for x in room_status if x['current_load'] > 0 and x['new_load'] <= 7.5]
            empty_rooms = [x for x in room_status if x['current_load'] == 0]
            limit_fill = [x for x in room_status if x['current_load'] > 0 and x['new_load'] <= 8.0]
            overload_rooms = [x for x in room_status if x['new_load'] <= x['max_limit']]
            
            selected_status = None
            if ideal_fill:
                selected_status = max(ideal_fill, key=lambda x: x['new_load'])
            elif empty_rooms:
                selected_status = empty_rooms[0]
            elif limit_fill:
                selected_status = max(limit_fill, key=lambda x: x['new_load'])
            elif overload_rooms:
                night_rooms = [x for x in overload_rooms if x['has_night']]
                if night_rooms:
                    selected_status = min(night_rooms, key=lambda x: x['current_load'])
                else:
                    selected_status = min(overload_rooms, key=lambda x: x['current_load'])
            else:
                selected_status = min(room_status, key=lambda x: x['current_load'])

            allocation[surgery.surgery_id] = {
                'room_id': selected_status['room']['id'],
                'suggested_shift': 'morning',
                'score': 0
            }
        return allocation

    def _genetic_algorithm(self, surgeries: List[Surgery], initial_solution: Dict) -> Dict[str, Dict]:
        population = self._initialize_population(surgeries, initial_solution)
        best_solution = initial_solution.copy()
        best_fitness = self._calculate_fitness(initial_solution, surgeries)
        no_improvement = 0
        
        for generation in range(self.GENERATIONS):
            fitness_scores = [self._calculate_fitness(ind, surgeries) for ind in population]
            gen_best_idx = np.argmax(fitness_scores)
            
            if fitness_scores[gen_best_idx] > best_fitness:
                best_fitness = fitness_scores[gen_best_idx]
                best_solution = population[gen_best_idx].copy()
                no_improvement = 0
            else:
                no_improvement += 1
            
            if no_improvement >= 30:
                print(f"    ✓ GA 提前收斂於世代 {generation+1}, Fitness={best_fitness:.2f}")
                break
                
            selected = self._selection(population, fitness_scores)
            offspring = self._crossover(selected)
            offspring = self._mutation(offspring, surgeries)
            elite_size = max(1, int(self.POPULATION_SIZE * self.ELITISM_RATE))
            elite_indices = np.argsort(fitness_scores)[-elite_size:]
            elite = [population[i] for i in elite_indices]
            population = elite + offspring[:self.POPULATION_SIZE - elite_size]
            
        return best_solution

    def _initialize_population(self, surgeries: List[Surgery], initial_solution: Dict) -> List[Dict]:
        population = [initial_solution]
        for _ in range(self.POPULATION_SIZE - 1):
            individual = {}
            for surgery in surgeries:
                room_type = surgery.surgery_room_type
                candidates = [r for r in self.available_rooms.values() if r['room_type'] == room_type and self._check_nurse_requirement(r, surgery)]
                if not candidates: continue
                selected = random.choice(candidates)
                individual[surgery.surgery_id] = {'room_id': selected['id'], 'suggested_shift': 'morning'}
            population.append(individual)
        return population

    def _calculate_fitness(self, allocation: Dict, surgeries: List[Surgery]) -> float:
        room_usage = {} 
        doctor_rooms_map = {}
        nurse_waste = 0
        penalty = 0
        
        allocated_count = 0
        for s_id, alloc in allocation.items():
            if 'room_id' not in alloc: continue
            s = next((x for x in surgeries if x.surgery_id == s_id), None)
            if not s: continue
            allocated_count += 1
            room_id = alloc['room_id']
            hours = s.duration + 0.5
            key = (room_id, s.surgery_date)
            room_usage[key] = room_usage.get(key, 0) + hours
            
            room = self.available_rooms.get(room_id)
            if room:
                diff = room.get('nurse_count', 0) - s.nurse_count
                if diff > 0: nurse_waste += diff * hours
            
            if s.doctor_id:
                doc_key = (s.doctor_id, s.surgery_date)
                if doc_key not in doctor_rooms_map: doctor_rooms_map[doc_key] = set()
                doctor_rooms_map[doc_key].add(room_id)

        score = (allocated_count / len(surgeries)) * 1000
        
        for (r_id, date), hours in room_usage.items():
            room = self.available_rooms.get(r_id)
            max_limit = self._get_room_max_hours(room)
            
            if hours > max_limit: penalty += (hours - max_limit) * 500
            
            if 0 < hours < 3.0: score -= 50 
            elif 6.0 <= hours <= 7.8: score += 60 
            elif hours > 8.5: score -= (hours - 8.5) * 50
            
        for (doc_id, date), rooms in doctor_rooms_map.items():
            if len(rooms) > 1: penalty += (len(rooms) - 1) * 200
            
        score -= penalty
        score -= nurse_waste * 2
        return max(0, score)
    
    def _selection(self, population, fitness_scores):
        selected = []
        for _ in range(len(population)):
            candidates = random.sample(range(len(population)), 3)
            best_idx = max(candidates, key=lambda i: fitness_scores[i])
            selected.append(population[best_idx].copy())
        return selected

    def _crossover(self, parents):
        offspring = []
        for i in range(0, len(parents)-1, 2):
            if random.random() < self.CROSSOVER_RATE:
                p1, p2 = parents[i], parents[i+1]
                keys = list(p1.keys())
                if not keys: 
                    offspring.extend([p1, p2])
                    continue
                point = random.randint(0, len(keys)-1)
                c1, c2 = p1.copy(), p2.copy()
                for k in keys[point:]:
                    if k in p2: c1[k] = p2[k]
                    if k in p1: c2[k] = p1[k]
                offspring.extend([c1, c2])
            else:
                offspring.extend([parents[i], parents[i+1]])
        return offspring

    def _mutation(self, population, surgeries):
        for ind in population:
            if random.random() < self.MUTATION_RATE:
                s = random.choice(surgeries)
                curr = ind.get(s.surgery_id, {}).get('room_id')
                candidates = [
                    r for r in self.available_rooms.values()
                    if r['room_type'] == s.surgery_room_type 
                    and r['id'] != curr
                    and self._check_nurse_requirement(r, s)
                ]
                if candidates:
                    ind[s.surgery_id] = {'room_id': random.choice(candidates)['id'], 'suggested_shift': 'morning'}
        return population

    # ==================== Stage 2: Greedy + AHP + 救援 + 詳細原因 ====================

    def _stage2_greedy_scheduling(self, surgeries, allocation):
        surgeries_with_score = []
        for s in surgeries:
            if s.surgery_id in allocation:
                score = self._calculate_ahp_score(s)
                surgeries_with_score.append((s, score))
        surgeries_with_score.sort(key=lambda x: x[1], reverse=True)
        
        results = []
        failed = []
        resources = {'doctor': {}, 'assistant': {}, 'room': {}}
        
        for s, score in surgeries_with_score:
            original_room_id = allocation[s.surgery_id]['room_id']
            room = self.available_rooms[original_room_id]
            
            # 1. 嘗試排入原分配房間
            slot, reason = self._find_feasible_slot(s, room, resources)
            
            is_delayed = False
            if slot:
                if slot['end'].hour >= 17 or slot['shift'] == 'night':
                    is_delayed = True
            
            # 2. 救援機制 (Rescue)
            if not slot or is_delayed:
                target_end_time = slot['end'] if slot else time(23, 59)
                alternative_rooms = [
                    r for r in self.available_rooms.values()
                    if r['room_type'] == s.surgery_room_type 
                    and r['id'] != original_room_id
                    and self._check_nurse_requirement(r, s)
                ]
                
                best_alt_slot = None
                best_alt_room = None
                
                for alt_room in alternative_rooms:
                    alt_slot, alt_reason = self._find_feasible_slot(s, alt_room, resources)
                    
                    if alt_slot:
                        if not slot: # 救援成功
                            best_alt_slot = alt_slot
                            best_alt_room = alt_room
                            break 
                        
                        if is_delayed and alt_slot['end'] < target_end_time: # 找到更早的
                            best_alt_slot = alt_slot
                            best_alt_room = alt_room
                            target_end_time = alt_slot['end']
                
                if best_alt_slot:
                    slot = best_alt_slot
                    room = best_alt_room
                elif is_delayed:
                    # 無法找到更早，必須使用原延遲方案，並附上原因
                    reason = f"無更早空位(受限於: {reason})"
            
            # 3. 最終結果處理
            if slot:
                # 判斷是否為延遲手術，若有 reason (代表有前置阻礙) 則標註
                note = ""
                if is_delayed or "受限於" in reason:
                     note = reason if "Success" not in reason else "延遲但成功"

                res = ScheduleResult(
                    surgery_id=s.surgery_id, room_id=room['id'], scheduled_date=s.surgery_date,
                    start_time=slot['start'], end_time=slot['end'], cleanup_end_time=slot['cleanup'],
                    primary_shift=slot['shift'], is_cross_shift=slot['cross'], ahp_score=score, allocation_score=0
                )
                # Hack: 將原因暫存於物件以便列印，雖然這欄位不在標準模型內，但 Python 允許動態屬性
                res.delay_reason = note
                
                results.append(res)
                self._update_resources(resources, s, room['id'], res)
            else:
                s.failure_reason = reason
                failed.append(s)
                
        return results, failed

    def _find_feasible_slot(self, surgery: Surgery, room: Dict, resources: Dict) -> Tuple[Optional[Dict], str]:
        search_start = 8
        search_end = 24 if room.get('night_shift') else 16
        duration = int(surgery.duration * 60)
        cleanup = 30
        
        last_reason = "無合適時段"
        # 收集所有失敗原因 (Set 去重)
        rejection_reasons = set()

        for hour in range(search_start, 24):
            for minute in [0, 30]:
                current_time = datetime.combine(surgery.surgery_date, time(hour, minute))
                end_time = current_time + timedelta(minutes=duration)
                cleanup_time = end_time + timedelta(minutes=cleanup)
                
                t_start, t_end = current_time.time(), end_time.time()
                
                # Check 1: Shift limit
                if not self._check_shift_availability(room, surgery, t_start): continue
                if t_end.hour >= 16 and not room.get('night_shift'):
                     if not (t_end.hour == 16 and t_end.minute == 0): 
                         last_reason = "超過營業時間"
                         continue
                
                # Check 2: Doctor
                is_doc_avail, doc_reason = self._check_doctor_availability_verbose(surgery, t_start, t_end)
                if not is_doc_avail: 
                    rejection_reasons.add(doc_reason)
                    last_reason = doc_reason
                    continue
                
                # Check 3: Resource Conflict
                is_conflict, conflict_reason = self._check_resource_conflict_verbose(surgery, room['id'], t_start, t_end, cleanup_time.time(), resources)
                if is_conflict: 
                    rejection_reasons.add(conflict_reason)
                    last_reason = conflict_reason
                    continue
                
                # Success Found!
                # 總結前面失敗的原因
                delay_note = "Success"
                if rejection_reasons:
                    # 優先顯示醫師原因，因為那是不可抗力
                    if any("醫師" in r for r in rejection_reasons):
                        delay_note = "醫師時段衝突/無排班"
                    elif "房間時段衝突" in rejection_reasons:
                        delay_note = "前方時段房間已滿"
                    else:
                        delay_note = ",".join(list(rejection_reasons)[:2])
                
                return {'start': t_start, 'end': t_end, 'cleanup': cleanup_time.time(), 
                        'shift': 'morning' if t_start.hour < 16 else 'night', 
                        'cross': (t_start.hour < 16 and t_end.hour >= 16)}, delay_note
        
        # Completely Failed
        if rejection_reasons:
            summary = ",".join(list(rejection_reasons)[:2])
            return None, f"{last_reason} (曾遇: {summary})"
        return None, last_reason

    def _check_resource_conflict_verbose(self, surgery, room_id, start, end, cleanup, resources):
        date = surgery.surgery_date
        for r in resources['room'].get(room_id, []):
            if r['date'] == date and self._overlap(start, cleanup, r['start'], r['cleanup']): 
                return True, "房間時段衝突"
        
        buffer_time = timedelta(minutes=self.DOCTOR_BUFFER_MINUTES)
        
        if surgery.doctor_id:
            for r in resources['doctor'].get(surgery.doctor_id, []):
                if r['date'] == date:
                    busy_start = (datetime.combine(date, r['start']) - buffer_time).time()
                    busy_end = (datetime.combine(date, r['end']) + buffer_time).time()
                    if self._overlap(start, end, busy_start, busy_end): 
                        return True, "醫師時段衝突"
        
        if surgery.assistant_doctor_id:
            for r in resources['assistant'].get(surgery.assistant_doctor_id, []):
                if r['date'] == date:
                    busy_start = (datetime.combine(date, r['start']) - buffer_time).time()
                    busy_end = (datetime.combine(date, r['end']) + buffer_time).time()
                    if self._overlap(start, end, busy_start, busy_end): 
                         return True, "助手時段衝突"
                         
        return False, ""

    def _overlap(self, s1, e1, s2, e2): return not (e1 <= s2 or e2 <= s1)

    def _update_resources(self, resources, surgery, room_id, res):
        d = surgery.surgery_date
        if surgery.doctor_id:
            if surgery.doctor_id not in resources['doctor']: resources['doctor'][surgery.doctor_id] = []
            resources['doctor'][surgery.doctor_id].append({'date': d, 'start': res.start_time, 'end': res.end_time})
        if surgery.assistant_doctor_id:
            if surgery.assistant_doctor_id not in resources['assistant']: resources['assistant'][surgery.assistant_doctor_id] = []
            resources['assistant'][surgery.assistant_doctor_id].append({'date': d, 'start': res.start_time, 'end': res.end_time})
        if room_id not in resources['room']: resources['room'][room_id] = []
        resources['room'][room_id].append({'date': d, 'start': res.start_time, 'end': res.end_time, 'cleanup': res.cleanup_end_time})
    
    def _check_doctor_availability_verbose(self, surgery: Surgery, start_time: time, end_time: time) -> Tuple[bool, str]:
        if not surgery.doctor_id: return True, ""
        available_shifts = self._get_available_shifts_for_doctor(surgery.doctor_id, surgery.surgery_date)
        if not available_shifts: return False, "醫師當日無排班"
        
        start_hour = start_time.hour
        surgery_shift = 'morning' if 8 <= start_hour < 16 else ('night' if 16 <= start_hour < 24 else 'graveyard')
        
        if surgery_shift not in available_shifts: return False, f"醫師無{surgery_shift}班"
        if start_hour < 16 and end_time.hour >= 16:
             if not ('morning' in available_shifts and 'night' in available_shifts):
                 return False, "跨班但醫師缺班"
        return True, ""
    
    def _check_doctor_availability(self, surgery, start, end):
        res, _ = self._check_doctor_availability_verbose(surgery, start, end)
        return res

    def _get_doctor_schedule_type(self, doctor_id: str, surgery_date: date) -> Optional[str]:
        if doctor_id not in self.doctor_schedules: return 'A'
        weekday_map = {0: 'monday', 1: 'tuesday', 2: 'wednesday', 3: 'thursday', 4: 'friday', 5: 'saturday', 6: 'sunday'}
        return self.doctor_schedules[doctor_id].get(weekday_map.get(surgery_date.weekday()), 'A')

    def _get_available_shifts_for_doctor(self, doctor_id: str, surgery_date: date) -> List[str]:
        stype = self._get_doctor_schedule_type(doctor_id, surgery_date)
        return self.DOCTOR_SCHEDULE_TYPES.get(stype, {}).get('available_shifts', ['morning', 'night'])

    def _calculate_ahp_score(self, surgery): return (1/(1+surgery.duration))*0.4 + 0.5*0.3 + 0.8*0.2

    def calculate_utilization(self): return 75.0

    # ==================== 統計輸出 ====================

    def _print_stage1_details(self, allocation, surgeries):
        print("\n" + "-"*30 + " [Stage 1] 分配詳情 " + "-"*30)
        print(f"{'手術ID':<12} | {'日期':<10} | {'需求人數':<4} | {'分配房間':<8} | {'房內人數':<4}")
        print("-" * 60)
        sorted_alloc = sorted(allocation.items(), key=lambda x: x[0])
        for s_id, alloc in sorted_alloc:
            s = next((x for x in surgeries if x.surgery_id == s_id), None)
            if not s: continue
            room_id = alloc.get('room_id', 'N/A')
            room = self.available_rooms.get(room_id)
            room_n = room.get('nurse_count', 0) if room else 0
            print(f"{s_id:<12} | {str(s.surgery_date):<10} | {s.nurse_count:<8} | {room_id:<8} | {room_n:<4}")
        print("-" * 60 + "\n")

    def _print_daily_stats(self, allocation, surgeries):
        print("\n" + "-"*30 + " [Stage 1] 每日統計 " + "-"*30)
        print(f"{'日期':<12} | {'開啟房間數':<10} | {'平均時數(hr)':<12}")
        print("-" * 50)
        daily_data = {} 
        for s_id, alloc in allocation.items():
            s = next((x for x in surgeries if x.surgery_id == s_id), None)
            if not s: continue
            d_str = str(s.surgery_date)
            if d_str not in daily_data: daily_data[d_str] = {'rooms': set(), 'total_hours': 0.0}
            daily_data[d_str]['rooms'].add(alloc['room_id'])
            daily_data[d_str]['total_hours'] += (s.duration + 0.5)
        for d_str in sorted(daily_data.keys()):
            data = daily_data[d_str]
            room_count = len(data['rooms'])
            avg_hours = data['total_hours'] / room_count if room_count > 0 else 0
            print(f"{d_str:<12} | {room_count:<10} | {avg_hours:.1f}")
        print("-" * 50 + "\n")

    def _print_stage2_details(self, results, failed):
        print("\n" + "-"*30 + " [Stage 2] 最終排程結果 " + "-"*30)
        # 列出延遲但成功的手術
        delayed = [r for r in results if hasattr(r, 'delay_reason') and r.delay_reason]
        if delayed:
            print(f"⚠️ 共有 {len(delayed)} 筆手術延遲 (已排入較晚時段)：")
            for r in delayed:
                print(f"  - {r.surgery_id} ({r.room_id}) : {r.delay_reason}")
            print("-" * 70)

        if failed:
            print(f"❌ 共有 {len(failed)} 筆排程失敗：")
            for f in failed:
                 reason = getattr(f, 'failure_reason', '未知')
                 print(f"  - {f.surgery_id} (Duration: {f.duration}h) - 原因: {reason}")
        else:
            print("🎉 所有手術均已成功排程！")
        print("\n")