"""
Float Nurse Assignment Algorithm

流動護士排班演算法 (貪婪成本 + 動態調整)
"""

from typing import List, Dict, Optional
from collections import defaultdict
from .cost_calculator import CostCalculator

class FloatNurseScheduler:
    """
    流動護士排班器
    """
    
    def __init__(self):
        self.weekdays = ['mon', 'tues', 'wed', 'thu', 'fri', 'sat', 'sun']
        # 初始化計算器
        self.cost_calculator = CostCalculator(
            familiarity_weight=0.2,
            workload_weight=0.3,
            role_fairness_weight=0.5
        )
    
    def calculate_daily_vacancies(
        self,
        fixed_assignments: Dict[str, List[Dict]],
        room_requirements: Dict[str, int]
    ) -> Dict[str, Dict[str, int]]:
        """計算每日每間手術室的空缺數量 (維持不變)"""
        vacancies = defaultdict(lambda: {day: 0 for day in self.weekdays})
        for room_id, nurses in fixed_assignments.items():
            required = room_requirements.get(room_id, 0)
            for day_idx, day_name in enumerate(self.weekdays):
                present_count = sum(
                    1 for nurse in nurses 
                    if day_idx not in self._get_day_off(nurse)
                )
                vacancies[room_id][day_name] = max(0, required - present_count)
        return dict(vacancies)
    
    def _get_day_off(self, nurse):
        if isinstance(nurse, dict):
            return nurse.get('day_off', [])
        return getattr(nurse, 'day_off', [])
    
    def assign_float_nurses(
        self,
        float_nurses: List[Dict],
        vacancies: Dict[str, Dict[str, int]]
        # 【移除】 strategy 參數已移除，因為現在統一使用貪婪演算法
    ) -> Dict[str, Dict[str, Optional[str]]]:
        """
        分配流動護士 (使用貪婪演算法 + 動態工作量更新)
        """
        # 初始化分配表
        assignments = {
            self._get_employee_id(n): {day: None for day in self.weekdays}
            for n in float_nurses
        }
        
        # 1. 建立動態工作量追蹤
        current_workloads = {
            self._get_employee_id(n): n.get('workload_this_week', 0)
            for n in float_nurses
        }

        # 複製空缺表以免修改原始資料
        remaining_vacancies = {r: dict(d) for r, d in vacancies.items()}

        for day in self.weekdays:
            # 找出當天所有缺口
            gaps = []
            for room_id, v_map in remaining_vacancies.items():
                for _ in range(v_map[day]):
                    gaps.append(room_id)
            
            if not gaps: continue

            # 找出當天可用護士
            candidates = []
            for nurse in float_nurses:
                nid = self._get_employee_id(nurse)
                day_off = self._get_day_off(nurse) # 使用 helper function
                
                # 簡單判斷：若 day (如 'mon') 對應的 index 不在 day_off 中
                # 這裡假設 day_off 是 [0, 1] 格式，需將 'mon' 轉為 0
                day_idx = self.weekdays.index(day)
                
                if day_idx not in day_off and assignments[nid][day] is None:
                    candidates.append(nurse)

            # 對每個缺口進行貪婪分配
            for room_id in gaps:
                if not candidates: break

                scored = []
                for nurse in candidates:
                    nid = self._get_employee_id(nurse)
                    
                    # 簡單轉接器，讓 CostCalculator 可以讀取 dict
                    class NurseAdapter:
                        def __init__(self, d): 
                            self.__dict__.update(d)
                            # 確保有歷史數據欄位，若 dict 沒有則補 0
                            self.history_fixed_count = d.get('history_fixed_count', 0)
                            self.history_float_count = d.get('history_float_count', 0)
                            self.last_assigned_room = d.get('last_assigned_room')
                            # workload 由動態參數傳入，這裡不用設

                    n_obj = NurseAdapter(nurse)
                    
                    # 計算成本 (Role Fairness: target='float')
                    cost, _ = self.cost_calculator.calculate_total_cost(
                        nurse=n_obj,
                        room_id=room_id,
                        target_role='float',
                        current_workload=current_workloads[nid]
                    )
                    scored.append((cost, nurse))

                # 選成本最低者
                scored.sort(key=lambda x: x[0])
                best_nurse = scored[0][1]
                best_nid = self._get_employee_id(best_nurse)

                # 指派
                assignments[best_nid][day] = room_id
                
                # 更新動態工作量 (變貴)
                current_workloads[best_nid] += 1
                
                # 從候選人移除
                candidates = [n for n in candidates if self._get_employee_id(n) != best_nid]

        return assignments
    
    def _get_employee_id(self, nurse):
        if isinstance(nurse, dict):
            return nurse.get('employee_id') or nurse.get('id')
        return getattr(nurse, 'employee_id', None)

    # 【刪除】 _balanced_assignment 和 _room_priority_assignment 已刪除

    def format_float_schedule(self, assignments):
        """格式化流動護士排班結果"""
        return [
            {
                'employee_id': employee_id,
                **{day: room_id for day, room_id in days.items()}
            }
            for employee_id, days in assignments.items()
        ]
    
    def generate_float_schedule_report(self, assignments, float_nurses):
        """生成報告"""
        nurse_dict = {self._get_employee_id(n): n for n in float_nurses}
        report_nurses = []
        total_assignments = 0
        
        for employee_id, schedule in assignments.items():
            work_days = sum(1 for r in schedule.values() if r is not None)
            total_assignments += work_days
            nurse_data = nurse_dict.get(employee_id, {})
            
            report_nurses.append({
                'employee_id': employee_id,
                'name': self._get_name(nurse_data),
                'work_days': work_days,
                'schedule': schedule
            })
        
        return {
            'total_float_nurses': len(float_nurses),
            'total_assignments': total_assignments,
            'nurses': report_nurses
        }
    
    def _get_name(self, nurse):
        if isinstance(nurse, dict):
            return nurse.get('name', '')
        return getattr(nurse, 'name', '')