"""
Cost Calculator

計算護士分配到手術室的成本
"""

import numpy as np
from typing import List, Dict, Tuple
from ...models.nurse import NurseInput
from ...models.room import SurgeryRoomInput


class CostCalculator:
    """
    成本計算器
    
    計算護士分配到手術室職位的成本矩陣
    """
    
    def __init__(
        self,
        familiarity_weight: float = 0.5,
        workload_weight: float = 0.3,
        experience_weight: float = 0.2
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
        self.experience_weight = experience_weight
    
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
        nurse: NurseInput
    ) -> float:
        """
        計算工作負荷成本
        
        工作天數越多，成本越高（鼓勵負荷平衡）
        
        Args:
            nurse: 護士資料
            
        Returns:
            工作負荷成本 (0.0-10.0)
        """
        workload = nurse.workload_this_week or 0
        
        # 線性增加：0天=0成本, 5天=10成本
        return min(workload * 2.0, 10.0)
    
    def calculate_experience_cost(
        self,
        nurse: NurseInput,
        room: SurgeryRoomInput
    ) -> float:
        """
        計算資歷匹配成本
        
        資深護士適合複雜手術室，新手適合簡單手術室
        
        Args:
            nurse: 護士資料
            room: 手術室資料
            
        Returns:
            資歷匹配成本 (0.0-10.0)
        """
        experience = nurse.experience_years or 0
        complexity = room.complexity or "medium"
        
        # 定義資歷等級
        if experience >= 5:
            nurse_level = "senior"  # 資深
        elif experience >= 2:
            nurse_level = "mid"     # 中等
        else:
            nurse_level = "junior"  # 新手
        
        # 定義最佳配對
        optimal_matches = {
            ("senior", "high"): 0.0,      # 資深 + 複雜 = 最佳
            ("senior", "medium"): 3.0,    # 資深 + 中等 = 良好
            ("senior", "low"): 5.0,       # 資深 + 簡單 = 浪費
            ("mid", "high"): 5.0,         # 中等 + 複雜 = 勉強
            ("mid", "medium"): 0.0,       # 中等 + 中等 = 最佳
            ("mid", "low"): 3.0,          # 中等 + 簡單 = 良好
            ("junior", "high"): 10.0,     # 新手 + 複雜 = 不佳
            ("junior", "medium"): 5.0,    # 新手 + 中等 = 勉強
            ("junior", "low"): 0.0,       # 新手 + 簡單 = 最佳
        }
        
        return optimal_matches.get((nurse_level, complexity), 5.0)
    
    def calculate_total_cost(
        self,
        nurse: NurseInput,
        room: SurgeryRoomInput,
        room_id: str
    ) -> Tuple[float, Dict[str, float]]:
        """
        計算總成本（加權組合）
        
        Args:
            nurse: 護士資料
            room: 手術室資料
            room_id: 手術室編號
            
        Returns:
            (總成本, 成本明細字典)
        """
        familiarity_cost = self.calculate_familiarity_cost(nurse, room_id)
        workload_cost = self.calculate_workload_cost(nurse)
        experience_cost = self.calculate_experience_cost(nurse, room)
        
        total_cost = (
            self.familiarity_weight * familiarity_cost +
            self.workload_weight * workload_cost +
            self.experience_weight * experience_cost
        )
        
        breakdown = {
            "familiarity": familiarity_cost,
            "workload": workload_cost,
            "experience": experience_cost,
            "total": total_cost
        }
        
        return total_cost, breakdown
    
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