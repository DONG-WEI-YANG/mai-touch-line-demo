"""
Model Pool Manager
Manages multiple tiny NLP models with task-aware tiered orchestration and self-healing
"""
import asyncio
import time
from typing import List, Dict, Optional, Any
from dataclasses import dataclass
from enum import Enum
import logging

logger = logging.getLogger(__name__)

class ModelStatus(Enum):
    IDLE = "idle"
    BUSY = "busy"
    ERROR = "error"
    LOADING = "loading"

@dataclass
class ModelInstance:
    """Represents a single tiered model orchestrator instance"""
    id: str
    model_name: str
    task_type: str # 'intent', 'sentiment', 'entity'
    status: ModelStatus
    last_used: float
    request_count: int
    error_count: int
    avg_latency: float
    model: Optional[Any] = None # Holds MultiTierOrchestrator

class ModelPool:
    """
    Advanced Task-Aware Pool Manager.
    Directs traffic to specialized orchestrators (Intent/Sentiment/Entity).
    """
    
    def __init__(
        self,
        model_configs: List[Dict[str, Any]],
        pool_size: int = 10,
        max_queue_size: int = 200,
        health_check_interval: int = 30
    ):
        self.model_configs = model_configs
        self.pool_size = pool_size
        self.instances: List[ModelInstance] = []
        self.lock = asyncio.Lock()
        self._running = False
        self._health_check_task: Optional[asyncio.Task] = None
    
    async def initialize(self):
        logger.info(f"Initializing Task-Aware Model Pool ({self.pool_size} slots)")
        
        for i in range(self.pool_size):
            config = self.model_configs[i % len(self.model_configs)]
            m_type = config.get("type", "intent")
            
            instance = ModelInstance(
                id=f"orch-{m_type}-{i}",
                model_name=config["name"],
                task_type=m_type,
                status=ModelStatus.LOADING,
                last_used=time.time(),
                request_count=0,
                error_count=0,
                avg_latency=0.0
            )
            
            try:
                instance.model = await self._load_model(config)
                instance.status = ModelStatus.IDLE
                self.instances.append(instance)
                logger.info(f"Loaded {m_type} orchestrator: {instance.id}")
            except Exception as e:
                logger.error(f"Failed to load {instance.id}: {e}")
                instance.status = ModelStatus.ERROR
        
        self._running = True
        self._health_check_task = asyncio.create_task(self._health_check_loop())
    
    async def _load_model(self, config: Dict[str, Any]) -> Any:
        from models.tiny_nlp import ModelLoader
        return await asyncio.to_thread(ModelLoader.load_tiered_models, config)

    async def get_available_instance(self, task: str) -> Optional[ModelInstance]:
        """Get specialized idle instance with least-busy logic"""
        # Map API task to internal type keywords
        target = "intent"
        if "sentiment" in task.lower(): target = "sentiment"
        if "entity" in task.lower() or "ner" in task.lower(): target = "entity"

        async with self.lock:
            # 1. Try to find a specialized IDLE instance
            matching = [i for i in self.instances if i.status == ModelStatus.IDLE and target in i.task_type.lower()]
            
            # 2. Fallback to any IDLE general intent instance
            if not matching:
                matching = [i for i in self.instances if i.status == ModelStatus.IDLE and "intent" in i.task_type.lower()]
            
            if not matching: return None
            
            instance = min(matching, key=lambda x: x.request_count)
            instance.status = ModelStatus.BUSY
            return instance

    async def process_request(self, text: str, task: str = "intent", timeout: float = 10.0) -> Dict[str, Any]:
        start_time = time.time()
        instance = None
        try:
            wait_start = time.time()
            while time.time() - wait_start < timeout:
                instance = await self.get_available_instance(task)
                if instance: break
                await asyncio.sleep(0.05)
            
            if not instance:
                from models.tiny_nlp import RuleBasedNLPEngine
                return {**RuleBasedNLPEngine().analyze(text), "processing_mode": "timeout_fallback"}

            # Execute via specialized orchestrator (5-tier logic inside)
            result = await asyncio.to_thread(instance.model.dispatch, text)
            
            latency = time.time() - start_time
            instance.request_count += 1
            instance.avg_latency = (instance.avg_latency * 0.9) + (latency * 0.1)
            
            return {
                "model_id": instance.id,
                "model_name": instance.model_name,
                "task": task,
                "processing_time_s": latency,
                **result
            }
        except Exception as e:
            if instance: instance.error_count += 1
            logger.error(f"Pool failure for {task}: {e}")
            from models.tiny_nlp import RuleBasedNLPEngine
            return RuleBasedNLPEngine().analyze(text)
        finally:
            if instance:
                async with self.lock: instance.status = ModelStatus.IDLE

    async def _health_check_loop(self):
        while self._running:
            await asyncio.sleep(self.health_check_interval)
            for inst in self.instances:
                if inst.model and hasattr(inst.model, 'models'):
                    from models.tiny_nlp import CircuitBreakerStatus
                    any_unhealthy = False
                    for wrapper in inst.model.models:
                        if wrapper.status == CircuitBreakerStatus.OPEN:
                            if time.time() - wrapper.last_failure_time > wrapper.recovery_timeout:
                                wrapper.status = CircuitBreakerStatus.HALF_OPEN
                        if wrapper.status == CircuitBreakerStatus.OPEN:
                            any_unhealthy = True
                    inst.status = ModelStatus.ERROR if any_unhealthy else ModelStatus.IDLE

    def get_stats(self) -> Dict[str, Any]:
        return {
            "total_slots": len(self.instances),
            "status_map": {i.id: i.status.value for i in self.instances},
            "metrics": [
                {"id": i.id, "type": i.task_type, "reqs": i.request_count, "lat": i.avg_latency}
                for i in self.instances
            ]
        }

    async def shutdown(self):
        self._running = False
        if self._health_check_task: self._health_check_task.cancel()
