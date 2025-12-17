"""
Cost Calculator

計算護士分配到手術室的成本
"""

import numpy as np
from typing import List, Dict, Tuple, Optional
from ...models.nurse import NurseInput
from ...models.room import SurgeryRoomInput


class CostCalculator:
    """
    成本計算器
    
    計算護士分配到手術室職位的成本矩陣
    """
    
    def __init__(
        self,
        familiarity_weight: float = 0.2,
        workload_weight: float = 0.3,
        role_fairness_weight: float = 0.5
    ):
        """
        初始化成本計算器
        
        Args:
            familiarity_weight: 熟悉度權重
            workload_weight: 工作負荷權重
            experience_weight: 資歷匹配權重
        """
        self.familiarity_weight = familiarity_weight
        self.workload_weight = workload_weight
        self.role_fairness_weight = role_fairness_weight
    
    def calculate_familiarity_cost(
        self,
        nurse: NurseInput,
        room_id: str
    ) -> float:
        """
        計算熟悉度成本
        
        成本越低表示越熟悉
        
        Args:
            nurse: 護士資料
            room_id: 手術室編號
            
        Returns:
            熟悉度成本 (0.0-10.0)
        """
        if nurse.last_assigned_room == room_id:
            # 上次就在這間手術室 - 最低成本
            return 0.0
        elif nurse.last_assigned_room and nurse.last_assigned_room[:3] == room_id[:3]:
            # 在同類型其他手術室工作過 - 中等成本
            return 5.0
        else:
            # 從未在此類型工作過 - 最高成本
            return 10.0
    
    def calculate_workload_cost(
        self,
        workload_val: int
    ) -> float:
        """
        計算工作負荷成本
        
        工作天數越多，成本越高（鼓勵負荷平衡）
        
        Args:
            nurse: 護士資料
            
        Returns:
            工作負荷成本 (0.0-10.0)
        """
        
        # 線性增加：0天=0成本, 5天=10成本
        return min(workload_val * 2.0, 10.0)
    
    # 計算角色公平性成本
    def calculate_role_fairness_cost(self, nurse, target_role: str) -> float:
        """
        target_role: 'fixed' (固定) 或 'float' (流動)
        """
        # 讀取模型中的歷史數據
        h_fixed = getattr(nurse, 'history_fixed_count', 0)
        h_float = getattr(nurse, 'history_float_count', 0)
        total = h_fixed + h_float
        
        # 防止除以零
        if total == 0:
            return 0.0
            
        epsilon = 1e-6 # 避免浮點數誤差
        
        if target_role == 'fixed':
            # 如果這次要排固定，過去當過越多次固定，成本越高 (不公平)
            ratio = h_fixed / (total + epsilon)
        else: # target_role == 'float'
            # 如果這次要排流動，過去當過越多次流動，成本越高
            ratio = h_float / (total + epsilon)
            
        return ratio * 10.0

    
    def calculate_total_cost(
        self,
        nurse,
        room_id: str,
        target_role: str = 'fixed', # 預設為固定，流動排班時需傳入 'float'
        current_workload: Optional[int] = None
    ) -> Tuple[float, Dict[str, float]]:
        
        # 1. 熟悉度
        fam_cost = self.calculate_familiarity_cost(nurse, room_id)
        
        # 2. 工作負荷 (支援動態傳入)
        w_val = current_workload if current_workload is not None else getattr(nurse, 'workload_this_week', 0)
        work_cost = self.calculate_workload_cost(w_val)
        
        # 3. 【修改】角色公平性
        fair_cost = self.calculate_role_fairness_cost(nurse, target_role)
        
        # 計算總分
        total = (
            self.familiarity_weight * fam_cost +
            self.workload_weight * work_cost +
            self.role_fairness_weight * fair_cost
        )
        
        return total, {
            "familiarity": fam_cost,
            "workload": work_cost,
            "role_fairness": fair_cost,
            "total": total
        }
    
    def create_cost_matrix(
        self,
        nurses: List[NurseInput],
        rooms: List[SurgeryRoomInput],
        positions: List[Tuple[str, int]]
    ) -> Tuple[np.ndarray, Dict]:
        """
        創建成本矩陣
        
        將手術室需求「展開」成職位，建立 N×M 的成本矩陣
        
        Args:
            nurses: 護士列表
            rooms: 手術室列表
            positions: 職位列表 [(room_id, position_number), ...]
            
        Returns:
            (成本矩陣 numpy array, 成本明細字典)
        """
        n_nurses = len(nurses)
        n_positions = len(positions)
        
        # 初始化成本矩陣
        cost_matrix = np.zeros((n_nurses, n_positions))
        cost_details = {}
        
        # 建立手術室查找字典
        room_dict = {room.room_id: room for room in rooms}
        
        # 計算每個護士到每個職位的成本
        for i, nurse in enumerate(nurses):
            for j, (room_id, position) in enumerate(positions):
                room = room_dict[room_id]
                
                # 計算成本
                total_cost, breakdown = self.calculate_total_cost(
                    nurse, room, room_id
                )
                
                cost_matrix[i, j] = total_cost
                
                # 儲存成本明細
                cost_details[f"{nurse.employee_id}-{room_id}-pos{position}"] = breakdown
        
        return cost_matrix, cost_details
    
    def pad_cost_matrix(
        self,
        cost_matrix: np.ndarray,
        n_nurses: int,
        n_positions: int
    ) -> np.ndarray:
        """
        補齊成本矩陣（處理護士數 ≠ 職位數的情況）
        
        Args:
            cost_matrix: 原始成本矩陣
            n_nurses: 護士數量
            n_positions: 職位數量
            
        Returns:
            補齊後的方陣
        """
        size = max(n_nurses, n_positions)
        
        if n_nurses == n_positions:
            return cost_matrix
        
        # 創建方陣
        padded_matrix = np.full((size, size), 9999.0)  # 填充高成本
        
        # 複製原始成本
        padded_matrix[:n_nurses, :n_positions] = cost_matrix
        
        return padded_matrix