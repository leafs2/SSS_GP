"""
Float Nurse Assignment Algorithm

流動護士排班演算法
"""

from typing import List, Dict, Set, Tuple, Optional
from collections import defaultdict
import random


class FloatNurseScheduler:
    """
    流動護士排班器
    
    在固定護士分配完成後，計算每日空缺並分配流動護士
    """
    
    def __init__(self):
        self.weekdays = ['mon', 'tues', 'wed', 'thu', 'fri', 'sat', 'sun']
        self.weekday_chinese = ['週一', '週二', '週三', '週四', '週五', '週六', '週日']
    
    def calculate_daily_vacancies(
        self,
        fixed_assignments: Dict[str, List[Dict]],
        room_requirements: Dict[str, int]
    ) -> Dict[str, Dict[str, int]]:
        """
        計算每日每間手術室的空缺數量
        
        Args:
            fixed_assignments: 固定護士分配結果
                {
                    'RSU01': [
                        {'employee_id': 'NOT0001', 'day_off': [6]},  # 週日休假
                        {'employee_id': 'NOT0002', 'day_off': [5, 6]},
                    ]
                }
            room_requirements: 每間手術室需要的護士數量
                {'RSU01': 3, 'RSU02': 3, ...}
        
        Returns:
            每日空缺情況
                {
                    'RSU01': {'mon': 0, 'tues': 0, ..., 'sun': 2},  # 週日缺2人
                    'RSU02': {'mon': 1, 'tues': 0, ...}
                }
        """
        vacancies = defaultdict(lambda: {day: 0 for day in self.weekdays})
        
        for room_id, nurses in fixed_assignments.items():
            required = room_requirements.get(room_id, 0)
            
            # 計算每天實際在崗人數
            for day_idx, day_name in enumerate(self.weekdays):
                present_count = sum(
                    1 for nurse in nurses 
                    if day_idx not in self._get_day_off(nurse)
                )
                
                # 空缺 = 需求 - 實際在崗
                vacancies[room_id][day_name] = max(0, required - present_count)
        
        return dict(vacancies)
    
    def _get_day_off(self, nurse):
        """
        安全地獲取護士的休假日
        
        支援字典和 Pydantic 模型
        """
        if isinstance(nurse, dict):
            return nurse.get('day_off', [])
        else:
            # Pydantic 模型
            return getattr(nurse, 'day_off', [])
    
    def assign_float_nurses(
        self,
        float_nurses: List[Dict],
        vacancies: Dict[str, Dict[str, int]],
        strategy: str = 'balanced'
    ) -> Dict[str, Dict[str, Optional[str]]]:
        """
        分配流動護士到有空缺的手術室
        
        Args:
            float_nurses: 流動護士列表
                [
                    {'employee_id': 'NOT0061', 'day_off': [5, 6]},
                    {'employee_id': 'NOT0066', 'day_off': [6]},
                ]
            vacancies: 每日空缺情況（from calculate_daily_vacancies）
            strategy: 分配策略
                - 'balanced': 平衡分配（每位流動護士工作天數盡量相同）
                - 'room_priority': 優先填補手術室（優先補滿一間手術室）
        
        Returns:
            流動護士的每日分配
                {
                    'NOT0061': {'mon': 'RSU01', 'tues': 'RSU02', ..., 'sat': null},
                    'NOT0066': {'mon': 'RSU04', 'tues': null, ...}
                }
        """
        assignments = {
            self._get_employee_id(nurse): {day: None for day in self.weekdays}
            for nurse in float_nurses
        }
        
        # 複製空缺情況（避免修改原始資料）
        remaining_vacancies = {
            room: dict(days) for room, days in vacancies.items()
        }
        
        if strategy == 'balanced':
            return self._balanced_assignment(
                float_nurses, remaining_vacancies, assignments
            )
        elif strategy == 'room_priority':
            return self._room_priority_assignment(
                float_nurses, remaining_vacancies, assignments
            )
        else:
            raise ValueError(f"Unknown strategy: {strategy}")
    
    def _get_employee_id(self, nurse):
        """安全地獲取護士的 employee_id"""
        if isinstance(nurse, dict):
            return nurse.get('employee_id') or nurse.get('id')
        else:
            return getattr(nurse, 'employee_id', None)
    
    def _balanced_assignment(
        self,
        float_nurses: List[Dict],
        vacancies: Dict[str, Dict[str, int]],
        assignments: Dict[str, Dict[str, Optional[str]]]
    ) -> Dict[str, Dict[str, Optional[str]]]:
        """
        平衡分配策略：每位流動護士工作天數盡量相同
        """
        # 計算每位護士可工作的天數
        nurse_available_days = {}
        for nurse in float_nurses:
            employee_id = self._get_employee_id(nurse)
            day_off = self._get_day_off(nurse)
            available = [
                day_idx for day_idx in range(7) 
                if day_idx not in day_off
            ]
            nurse_available_days[employee_id] = available
        
        # 對每一天進行分配
        for day_idx, day_name in enumerate(self.weekdays):
            # 收集這一天有空缺的手術室
            rooms_with_vacancy = [
                room_id for room_id, days in vacancies.items()
                if days[day_name] > 0
            ]
            
            # 收集這一天可工作的流動護士
            available_nurses = [
                self._get_employee_id(nurse) for nurse in float_nurses
                if day_idx in nurse_available_days[self._get_employee_id(nurse)]
            ]
            
            # 隨機打亂順序（避免總是同一批護士優先）
            random.shuffle(available_nurses)
            
            # 逐一分配
            nurse_idx = 0
            for room_id in rooms_with_vacancy:
                while vacancies[room_id][day_name] > 0 and nurse_idx < len(available_nurses):
                    employee_id = available_nurses[nurse_idx]
                    
                    # 分配這位護士到這間手術室
                    assignments[employee_id][day_name] = room_id
                    vacancies[room_id][day_name] -= 1
                    
                    nurse_idx += 1
        
        return assignments
    
    def _room_priority_assignment(
        self,
        float_nurses: List[Dict],
        vacancies: Dict[str, Dict[str, int]],
        assignments: Dict[str, Dict[str, Optional[str]]]
    ) -> Dict[str, Dict[str, Optional[str]]]:
        """
        手術室優先策略：優先補滿一間手術室
        """
        # 類似實作，但優先順序不同
        # 這裡簡化實作，可根據需求調整
        return self._balanced_assignment(float_nurses, vacancies, assignments)
    
    def format_float_schedule(
        self,
        assignments: Dict[str, Dict[str, Optional[str]]]
    ) -> List[Dict]:
        """
        格式化流動護士排班結果為資料庫格式
        
        Args:
            assignments: 流動護士分配結果
        
        Returns:
            資料庫記錄列表
                [
                    {
                        'employee_id': 'NOT0061',
                        'mon': 'RSU01',
                        'tues': 'RSU02',
                        ...
                    }
                ]
        """
        return [
            {
                'employee_id': employee_id,
                **{day: room_id for day, room_id in days.items()}
            }
            for employee_id, days in assignments.items()
        ]
    
    def generate_float_schedule_report(
        self,
        assignments: Dict[str, Dict[str, Optional[str]]],
        float_nurses: List[Dict]
    ) -> Dict:
        """
        生成流動護士排班報告
        
        Returns:
            {
                'total_float_nurses': 10,
                'total_assignments': 35,  # 總分配次數
                'nurses': [
                    {
                        'employee_id': 'NOT0061',
                        'name': '張三',
                        'work_days': 5,
                        'schedule': {'mon': 'RSU01', ...}
                    }
                ]
            }
        """
        # 建立護士查找字典
        nurse_dict = {}
        for n in float_nurses:
            employee_id = self._get_employee_id(n)
            nurse_dict[employee_id] = n
        
        report_nurses = []
        total_assignments = 0
        
        for employee_id, schedule in assignments.items():
            work_days = sum(1 for room in schedule.values() if room is not None)
            total_assignments += work_days
            
            nurse_data = nurse_dict.get(employee_id, {})
            nurse_name = self._get_name(nurse_data)
            
            report_nurses.append({
                'employee_id': employee_id,
                'name': nurse_name,
                'work_days': work_days,
                'schedule': schedule
            })
        
        return {
            'total_float_nurses': len(float_nurses),
            'total_assignments': total_assignments,
            'nurses': report_nurses
        }
    
    def _get_name(self, nurse):
        """安全地獲取護士姓名"""
        if isinstance(nurse, dict):
            return nurse.get('name', '')
        else:
            return getattr(nurse, 'name', '')