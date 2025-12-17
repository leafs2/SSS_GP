"""
Hungarian Algorithm Solver

使用 scipy 實作匈牙利演算法進行最佳護士分配
"""

import time
import numpy as np
from scipy.optimize import linear_sum_assignment
from typing import List, Dict, Tuple
from ...models.nurse import NurseInput, NurseAssignment
from ...models.room import SurgeryRoomInput, RoomAssignmentSummary
from ...models.assignment import HungarianAssignmentResponse, AssignmentMetadata
from .cost_calculator import CostCalculator


class HungarianSolver:
    """
    匈牙利演算法求解器
    
    將護士最佳化分配到手術室職位 (針對固定護士)
    """
    
    def __init__(
        self,
        familiarity_weight: float = 0.2, 
        workload_weight: float = 0.3,
        role_fairness_weight: float = 0.5 
    ):
        """
        初始化求解器
        """
        # 【修正】傳遞正確的參數名稱給 CostCalculator
        self.cost_calculator = CostCalculator(
            familiarity_weight=familiarity_weight,
            workload_weight=workload_weight,
            role_fairness_weight=role_fairness_weight
        )
    
    def expand_positions(
        self,
        rooms: List[SurgeryRoomInput]
    ) -> List[Tuple[str, int]]:
        """將手術室需求展開成職位列表"""
        positions = []
        for room in rooms:
            for pos in range(1, room.require_nurses + 1):
                positions.append((room.room_id, pos))
        return positions
    
    def solve(
        self,
        nurses: List[NurseInput],
        rooms: List[SurgeryRoomInput]
    ) -> Tuple[List[Tuple[int, int]], np.ndarray, Dict]:
        """執行匈牙利演算法求解"""
        # 1. 展開職位
        positions = self.expand_positions(rooms)
        
        # 2. 創建成本矩陣
        # CostCalculator 會自動處理 target_role='fixed'
        cost_matrix, cost_details = self.cost_calculator.create_cost_matrix(
            nurses, rooms, positions
        )
        
        # 3. 補齊矩陣
        n_nurses = len(nurses)
        n_positions = len(positions)
        padded_matrix = self.cost_calculator.pad_cost_matrix(
            cost_matrix, n_nurses, n_positions
        )
        
        # 4. 執行
        row_indices, col_indices = linear_sum_assignment(padded_matrix)
        
        # 5. 過濾
        assignments = []
        for row, col in zip(row_indices, col_indices):
            if row < n_nurses and col < n_positions:
                assignments.append((row, col))
        
        return assignments, cost_matrix, cost_details
    
    def format_response(
        self,
        nurses: List[NurseInput],
        rooms: List[SurgeryRoomInput],
        assignments: List[Tuple[int, int]],
        cost_matrix: np.ndarray,
        cost_details: Dict,
        execution_time: float
    ) -> HungarianAssignmentResponse:
        """格式化回應資料"""
        positions = self.expand_positions(rooms)
        nurse_assignments: List[NurseAssignment] = []
        room_assignments_dict: Dict[str, List[str]] = {}
        total_cost = 0.0
        
        for nurse_idx, position_idx in assignments:
            nurse = nurses[nurse_idx]
            room_id, position = positions[position_idx]
            cost = cost_matrix[nurse_idx, position_idx]
            
            assignment = NurseAssignment(
                employee_id=nurse.employee_id,
                nurse_name=nurse.name,
                assigned_room=room_id,
                position=position,
                cost=float(cost),
                reasons=self._get_assignment_reasons(
                    nurse, room_id, cost_details
                )
            )
            
            nurse_assignments.append(assignment)
            
            if room_id not in room_assignments_dict:
                room_assignments_dict[room_id] = []
            room_assignments_dict[room_id].append(nurse.employee_id)
            total_cost += cost
        
        room_summaries = {}
        for room_id, nurse_ids in room_assignments_dict.items():
            room_cost = sum(
                a.cost for a in nurse_assignments 
                if a.assigned_room == room_id
            )
            
            # 【修正】移除 experience_mix 分析，因為已無資歷資料
            # 若 RoomAssignmentSummary 模型是 Optional，這裡可以省略
            # 若必須傳值，建議修改 RoomAssignmentSummary 模型移除該欄位，或傳入 "N/A"
            room_summaries[room_id] = RoomAssignmentSummary(
                room_id=room_id,
                nurses=nurse_ids,
                total_cost=room_cost,
                experience_mix="N/A" # 或改為 role_mix，視您模型定義而定
            )
        
        metadata = AssignmentMetadata(
            algorithm="hungarian",
            execution_time=execution_time,
            optimal_solution=True,
            total_nurses=len(nurses),
            total_positions=len(positions)
        )
        
        return HungarianAssignmentResponse(
            success=True,
            assignments=nurse_assignments,
            room_assignments=room_summaries,
            total_cost=total_cost,
            metadata=metadata
        )
    
    def _get_assignment_reasons(
        self,
        nurse: NurseInput,
        room_id: str,
        cost_details: Dict
    ) -> List[str]:
        """獲取分配原因"""
        reasons = []
        for key, detail in cost_details.items():
            if nurse.employee_id in key and room_id in key:
                if detail["familiarity"] == 0.0:
                    reasons.append("high_familiarity")
                
                if detail["workload"] <= 4.0:
                    reasons.append("balanced_workload")
                
                # 【修正】檢查 role_fairness 而非 experience
                # 若成本高，代表該員過去當太多次固定，這次不該選他（但若選了可能沒更好選擇）
                # 若成本低，代表該員適合當固定
                if detail.get("role_fairness", 10.0) < 5.0:
                    reasons.append("good_role_balance")
                
                break
        
        if not reasons:
            reasons.append("acceptable_match")
        
        return reasons

    # 【刪除】 _analyze_experience_mix 函式已刪除，因為不再有 experience_years
    
    def assign(
        self,
        nurses: List[NurseInput],
        rooms: List[SurgeryRoomInput]
    ) -> HungarianAssignmentResponse:
        """主要入口"""
        start_time = time.time()
        assignments, cost_matrix, cost_details = self.solve(nurses, rooms)
        execution_time = time.time() - start_time
        
        response = self.format_response(
            nurses=nurses,
            rooms=rooms,
            assignments=assignments,
            cost_matrix=cost_matrix,
            cost_details=cost_details,
            execution_time=execution_time
        )
        return response