"""
第一階段：基因演算法手術室分配 - 修正版
"""

import random
import numpy as np
from typing import List, Dict, Tuple
from datetime import datetime, timedelta
import logging

from app.models.scheduling import Surgery
from .fitness import calculate_allocation_score, calculate_fitness
from .constraints import check_daily_overload, get_candidate_rooms

logger = logging.getLogger(__name__)


class Stage1GeneticAlgorithm:
    """第一階段：GA手術室分配 - 修正版"""
    
    def __init__(self, db_connection):
        self.db = db_connection
        
        # GA參數（平衡速度與品質）
        self.POPULATION_SIZE = 50
        self.GENERATIONS = 100
        self.CROSSOVER_RATE = 0.8
        self.MUTATION_RATE = 0.2  # 提高突變率，增加多樣性
        self.ELITISM_RATE = 0.1
    
    def allocate_rooms(self, surgeries: List[Surgery]) -> Dict[str, Dict]:
        """
        為手術分配手術室
        
        Args:
            surgeries: 待分配的手術列表
            
        Returns:
            分配結果 {surgery_id: {'room_id': ..., 'suggested_shift': ...}}
        """
        if not surgeries:
            return {}
        
        # 建構啟發式產生初始解
        logger.info("建構啟發式產生初始解")
        initial_solution = self.constructive_heuristic(surgeries)
        
        # 執行GA優化
        logger.info(f"執行GA優化: {self.GENERATIONS}世代, {self.POPULATION_SIZE}族群")
        optimized_solution = self.genetic_algorithm(surgeries, initial_solution)
        
        return optimized_solution
    
    def constructive_heuristic(self, surgeries: List[Surgery]) -> Dict[str, Dict]:
        """
        建構啟發式：按時長排序，採用 Round-Robin 分配策略
        
        修正重點：不再只選「最佳」手術室，而是輪流分配到多個手術室
        """
        allocation = {}
        
        # 按手術時長排序（短→長）
        sorted_surgeries = sorted(surgeries, key=lambda s: s.duration)
        
        # [修正] 先收集所有可用手術室，準備輪流分配
        room_pool = {}  # {room_type: [room_list]}
        
        for surgery in sorted_surgeries:
            room_type = surgery.surgery_room_type
            
            # 如果該類型手術室還沒收集，先收集
            if room_type not in room_pool:
                candidate_rooms = get_candidate_rooms(
                    self.db,
                    room_type,
                    surgery.nurse_count,
                    exclude_emergency=True
                )
                room_pool[room_type] = candidate_rooms if candidate_rooms else []
            
            if not room_pool[room_type]:
                logger.warning(f"手術 {surgery.surgery_id} 無可用手術室")
                continue
            
            # [修正] Round-Robin 分配：輪流選擇手術室
            # 選擇當前負載最低的手術室
            room_loads = {}
            for room in room_pool[room_type]:
                # 計算該手術室已分配的手術時長
                load = sum(
                    (s.duration + 0.5) for s_id, alloc in allocation.items()
                    if alloc['room_id'] == room['id']
                    for s in surgeries if s.surgery_id == s_id
                )
                room_loads[room['id']] = load
            
            # 選擇負載最小的手術室
            best_room_id = min(room_loads, key=room_loads.get)
            best_room = next(r for r in room_pool[room_type] if r['id'] == best_room_id)
            
            allocation[surgery.surgery_id] = {
                'room_id': best_room['id'],
                'suggested_shift': 'morning',
                'score': 0
            }
        
        logger.info(f"啟發式分配完成，使用 {len(set(a['room_id'] for a in allocation.values()))} 間手術室")
        return allocation
    
    def genetic_algorithm(
        self, 
        surgeries: List[Surgery], 
        initial_solution: Dict
    ) -> Dict[str, Dict]:
        """
        基因演算法優化
        
        Args:
            surgeries: 手術列表
            initial_solution: 初始解
            
        Returns:
            優化後的分配方案
        """
        # 建立初始族群
        population = self.initialize_population(surgeries, initial_solution)
        
        best_solution = None
        best_fitness = -float('inf')
        no_improvement_count = 0
        
        for generation in range(self.GENERATIONS):
            # 計算適應度
            fitness_scores = [
                calculate_fitness(individual, surgeries, None)
                for individual in population
            ]
            
            # 記錄最佳解
            gen_best_idx = np.argmax(fitness_scores)
            if fitness_scores[gen_best_idx] > best_fitness:
                best_fitness = fitness_scores[gen_best_idx]
                best_solution = population[gen_best_idx].copy()
                no_improvement_count = 0
                
                # 計算當前最佳解使用的手術室數量
                used_rooms = len(set(alloc['room_id'] for alloc in best_solution.values()))
                logger.debug(
                    f"世代 {generation}: 適應度={best_fitness:.2f}, "
                    f"使用手術室={used_rooms}"
                )
            else:
                no_improvement_count += 1
            
            # 早停機制：如果連續20代沒改進，提前結束
            if no_improvement_count >= 20:
                logger.info(f"連續 {no_improvement_count} 代無改進，提前結束")
                break
            
            # 選擇
            selected = self.selection(population, fitness_scores)
            
            # 交叉
            offspring = self.crossover(selected, surgeries)
            
            # 突變
            offspring = self.mutation(offspring, surgeries)
            
            # 菁英保留
            elite_size = int(self.POPULATION_SIZE * self.ELITISM_RATE)
            elite_indices = np.argsort(fitness_scores)[-elite_size:]
            elite = [population[i] for i in elite_indices]
            
            # 產生新族群
            population = elite + offspring[:self.POPULATION_SIZE - elite_size]
        
        used_rooms = len(set(alloc['room_id'] for alloc in best_solution.values()))
        logger.info(f"GA完成，最佳適應度={best_fitness:.2f}, 使用手術室={used_rooms}")
        return best_solution
    
    def initialize_population(
        self, 
        surgeries: List[Surgery], 
        initial_solution: Dict
    ) -> List[Dict]:
        """初始化族群 - 增加多樣性"""
        population = [initial_solution]  # 包含初始解
        
        # 產生隨機個體
        for _ in range(self.POPULATION_SIZE - 1):
            individual = {}
            
            # 收集所有可用手術室
            room_pools = {}
            for surgery in surgeries:
                room_type = surgery.surgery_room_type
                if room_type not in room_pools:
                    candidate_rooms = get_candidate_rooms(
                        self.db,
                        room_type,
                        surgery.nurse_count,
                        exclude_emergency=True
                    )
                    room_pools[room_type] = candidate_rooms if candidate_rooms else []
            
            # 隨機分配
            for surgery in surgeries:
                room_type = surgery.surgery_room_type
                if room_pools.get(room_type):
                    # 隨機選擇一個手術室
                    room = random.choice(room_pools[room_type])
                    individual[surgery.surgery_id] = {
                        'room_id': room['id'],
                        'suggested_shift': random.choice(['morning', 'night']),
                        'score': 0
                    }
            
            population.append(individual)
        
        return population
    
    def selection(self, population: List[Dict], fitness_scores: List[float]) -> List[Dict]:
        """錦標賽選擇"""
        selected = []
        tournament_size = 3
        
        for _ in range(len(population)):
            # 隨機選取錦標賽參賽者
            tournament_idx = random.sample(range(len(population)), tournament_size)
            tournament_fitness = [fitness_scores[i] for i in tournament_idx]
            
            # 選擇最佳者
            winner_idx = tournament_idx[np.argmax(tournament_fitness)]
            selected.append(population[winner_idx].copy())
        
        return selected
    
    def crossover(self, parents: List[Dict], surgeries: List[Surgery]) -> List[Dict]:
        """單點交叉"""
        offspring = []
        
        for i in range(0, len(parents) - 1, 2):
            if random.random() < self.CROSSOVER_RATE:
                parent1 = parents[i]
                parent2 = parents[i + 1]
                
                # 隨機選擇交叉點
                surgery_ids = list(parent1.keys())
                if len(surgery_ids) > 1:
                    crossover_point = random.randint(1, len(surgery_ids) - 1)
                    
                    child1 = {}
                    child2 = {}
                    
                    for idx, surgery_id in enumerate(surgery_ids):
                        if idx < crossover_point:
                            child1[surgery_id] = parent1.get(surgery_id, {}).copy()
                            child2[surgery_id] = parent2.get(surgery_id, {}).copy()
                        else:
                            child1[surgery_id] = parent2.get(surgery_id, {}).copy()
                            child2[surgery_id] = parent1.get(surgery_id, {}).copy()
                    
                    offspring.extend([child1, child2])
                else:
                    offspring.extend([parent1, parent2])
            else:
                offspring.extend([parents[i], parents[i + 1]])
        
        return offspring
    
    def mutation(self, population: List[Dict], surgeries: List[Surgery]) -> List[Dict]:
        """
        突變：隨機改變手術室分配
        
        [修正] 提高突變率，並鼓勵分配到不同手術室
        """
        for individual in population:
            for surgery in surgeries:
                if random.random() < self.MUTATION_RATE:
                    # 重新隨機分配手術室
                    candidate_rooms = get_candidate_rooms(
                        self.db,
                        surgery.surgery_room_type,
                        surgery.nurse_count,
                        exclude_emergency=True
                    )
                    
                    if candidate_rooms:
                        # [修正] 優先選擇當前個體中負載較低的手術室
                        room_loads = {}
                        for room in candidate_rooms:
                            load = sum(
                                1 for s_id, alloc in individual.items()
                                if alloc['room_id'] == room['id']
                            )
                            room_loads[room['id']] = load
                        
                        # 有50%機率選最低負載，50%隨機選
                        if random.random() < 0.5:
                            new_room_id = min(room_loads, key=room_loads.get)
                            new_room = next(r for r in candidate_rooms if r['id'] == new_room_id)
                        else:
                            new_room = random.choice(candidate_rooms)
                        
                        individual[surgery.surgery_id] = {
                            'room_id': new_room['id'],
                            'suggested_shift': random.choice(['morning', 'night']),
                            'score': 0
                        }
        
        return population