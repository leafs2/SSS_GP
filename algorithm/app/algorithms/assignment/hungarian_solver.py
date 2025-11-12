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
    
    將護士最佳化分配到手術室職位
    """
    
    def __init__(
        self,
        familiarity_weight: float = 0.5,
        workload_weight: float = 0.3,
        experience_weight: float = 0.2
    ):
        """
        初始化求解器
        
        Args:
            familiarity_weight: 熟悉度權重
            workload_weight: 工作負荷權重
            experience_weight: 資歷匹配權重
        """
        self.cost_calculator = CostCalculator(
            familiarity_weight=familiarity_weight,
            workload_weight=workload_weight,
            experience_weight=experience_weight
        )
    
    def expand_positions(
        self,
        rooms: List[SurgeryRoomInput]
    ) -> List[Tuple[str, int]]:
        """
        將手術室需求展開成職位列表
        
        例如：RSU01 需要 3 人 → [(RSU01, 1), (RSU01, 2), (RSU01, 3)]
        
        Args:
            rooms: 手術室列表
            
        Returns:
            職位列表 [(room_id, position), ...]
        """
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
        """
        執行匈牙利演算法求解
        
        Args:
            nurses: 護士列表
            rooms: 手術室列表
            
        Returns:
            (分配結果, 成本矩陣, 成本明細)
        """
        # 1. 展開職位
        positions = self.expand_positions(rooms)
        
        # 2. 創建成本矩陣
        cost_matrix, cost_details = self.cost_calculator.create_cost_matrix(
            nurses, rooms, positions
        )
        
        # 3. 補齊矩陣（處理護士數 ≠ 職位數）
        n_nurses = len(nurses)
        n_positions = len(positions)
        
        padded_matrix = self.cost_calculator.pad_cost_matrix(
            cost_matrix, n_nurses, n_positions
        )
        
        # 4. 執行匈牙利演算法
        row_indices, col_indices = linear_sum_assignment(padded_matrix)
        
        # 5. 過濾掉虛擬配對
        assignments = []
        for row, col in zip(row_indices, col_indices):
            # 只保留真實的護士和職位
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
        """
        格式化回應資料
        
        Args:
            nurses: 護士列表
            rooms: 手術室列表
            assignments: 分配結果 [(nurse_idx, position_idx), ...]
            cost_matrix: 成本矩陣
            cost_details: 成本明細
            execution_time: 執行時間
            
        Returns:
            格式化的回應物件
        """
        # 展開職位
        positions = self.expand_positions(rooms)
        
        # 建立護士分配結果
        nurse_assignments: List[NurseAssignment] = []
        room_assignments_dict: Dict[str, List[str]] = {}
        total_cost = 0.0
        
        for nurse_idx, position_idx in assignments:
            nurse = nurses[nurse_idx]
            room_id, position = positions[position_idx]
            cost = cost_matrix[nurse_idx, position_idx]
            
            # 建立分配結果
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
            
            # 紀錄手術室分配
            if room_id not in room_assignments_dict:
                room_assignments_dict[room_id] = []
            room_assignments_dict[room_id].append(nurse.employee_id)
            
            total_cost += cost
        
        # 建立手術室分配摘要
        room_summaries = {}
        for room_id, nurse_ids in room_assignments_dict.items():
            # 計算該手術室的總成本
            room_cost = sum(
                assignment.cost 
                for assignment in nurse_assignments 
                if assignment.assigned_room == room_id
            )
            
            room_summaries[room_id] = RoomAssignmentSummary(
                room_id=room_id,
                nurses=nurse_ids,
                total_cost=room_cost,
                experience_mix=self._analyze_experience_mix(nurses, nurse_ids)
            )
        
        # 建立元資料
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
        """
        獲取分配原因
        
        Args:
            nurse: 護士資料
            room_id: 手術室編號
            cost_details: 成本明細
            
        Returns:
            原因列表
        """
        reasons = []
        
        # 從成本明細中找出該配對的資訊
        for key, detail in cost_details.items():
            if nurse.employee_id in key and room_id in key:
                if detail["familiarity"] == 0.0:
                    reasons.append("high_familiarity")
                elif detail["familiarity"] <= 5.0:
                    reasons.append("moderate_familiarity")
                
                if detail["workload"] <= 4.0:
                    reasons.append("balanced_workload")
                
                if detail["experience"] == 0.0:
                    reasons.append("optimal_experience_match")
                
                break
        
        if not reasons:
            reasons.append("acceptable_match")
        
        return reasons
    
    def _analyze_experience_mix(
        self,
        all_nurses: List[NurseInput],
        assigned_nurse_ids: List[str]
    ) -> str:
        """
        分析手術室的資歷組合
        
        Args:
            all_nurses: 所有護士列表
            assigned_nurse_ids: 分配到該手術室的護士編號
            
        Returns:
            資歷組合描述 (balanced/senior/junior)
        """
        # 找出分配的護士
        assigned_nurses = [
            nurse for nurse in all_nurses 
            if nurse.employee_id in assigned_nurse_ids
        ]
        
        if not assigned_nurses:
            return "unknown"
        
        # 計算平均年資
        avg_experience = sum(
            nurse.experience_years or 0 
            for nurse in assigned_nurses
        ) / len(assigned_nurses)
        
        if avg_experience >= 4:
            return "senior"
        elif avg_experience >= 2:
            return "balanced"
        else:
            return "junior"
    
    def assign(
        self,
        nurses: List[NurseInput],
        rooms: List[SurgeryRoomInput]
    ) -> HungarianAssignmentResponse:
        """
        主要入口：執行完整的分配流程
        
        Args:
            nurses: 護士列表
            rooms: 手術室列表
            
        Returns:
            分配結果
        """
        start_time = time.time()
        
        # 執行匈牙利演算法
        assignments, cost_matrix, cost_details = self.solve(nurses, rooms)
        
        # 計算執行時間
        execution_time = time.time() - start_time
        
        # 格式化回應
        response = self.format_response(
            nurses=nurses,
            rooms=rooms,
            assignments=assignments,
            cost_matrix=cost_matrix,
            cost_details=cost_details,
            execution_time=execution_time
        )
        
        return response