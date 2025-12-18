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
        # 1. 完全匹配 (上次就在這間) -> 0.0
        if nurse.last_assigned_room == room_id:
            return 0.0
            
        # 2. 同類型匹配 (上次在同類型房間，或是流動護理師 NULL)
        # 假設 room_id 前綴代表類型 (例如 "RSU01" 的前綴 "RSU")
        # 或者我們可以直接判斷 nurse.room_type 是否符合
        
        # 這裡利用 user 的知識：只要能進來排班的，都是同類型
        # 因此，如果是 NULL (流動)，給予中等成本 5.0，而不是完全陌生的 10.0
        if nurse.last_assigned_room is None:
            return 5.0 
            
        # 如果有上次房間，但不同間，檢查前綴是否相同
        if nurse.last_assigned_room and nurse.last_assigned_room[:3] == room_id[:3]:
            return 5.0
            
        # 3. 完全不同類型 -> 10.0
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
        # 如果模型中只有 history_fixed_count，這裡可以用 getattr 嘗試兩種可能
        h_fixed = getattr(nurse, 'total_fixed_count', getattr(nurse, 'history_fixed_count', 0))
        h_float = getattr(nurse, 'total_float_count', getattr(nurse, 'history_float_count', 0))
        
        total = h_fixed + h_float
        
        if total == 0:
            return 0.0
            
        epsilon = 1e-6
        
        # 這裡邏輯不變
        if target_role == 'fixed':
            ratio = h_fixed / (total + epsilon)
        else:
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
        """
        n_nurses = len(nurses)
        n_positions = len(positions)
        
        # 初始化成本矩陣
        cost_matrix = np.zeros((n_nurses, n_positions))
        cost_details = {}
        
        # 計算每個護士到每個職位的成本
        for i, nurse in enumerate(nurses):
            for j, (room_id, position) in enumerate(positions):
                
                total_cost, breakdown = self.calculate_total_cost(
                    nurse, 
                    room_id,         # 傳入 ID 字串
                    target_role='fixed' # 明確指定為固定護士排班
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