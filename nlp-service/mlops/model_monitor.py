"""
MLOps - Model Monitoring
模型性能監控和追蹤系統
"""

import time
import json
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from pathlib import Path
from collections import defaultdict, deque

@dataclass
class ModelMetrics:
    """模型指標"""
    model_name: str
    timestamp: str
    latency_ms: float
    input_length: int
    output_length: int
    success: bool
    error: Optional[str] = None
    confidence: Optional[float] = None
    
@dataclass
class ModelHealth:
    """模型健康狀態"""
    model_name: str
    status: str  # healthy, degraded, unhealthy
    avg_latency_ms: float
    p95_latency_ms: float
    p99_latency_ms: float
    success_rate: float
    total_requests: int
    error_count: int
    last_check: str
    last_error: Optional[str] = None

class ModelMonitor:
    """模型監控器"""
    
    def __init__(self, metrics_dir: str = "./mlops/metrics"):
        self.metrics_dir = Path(metrics_dir)
        self.metrics_dir.mkdir(parents=True, exist_ok=True)
        
        # 內存中的指標緩存（最近1000條）
        self.metrics_cache: Dict[str, deque] = defaultdict(lambda: deque(maxlen=1000))
        
        # 性能閾值
        self.latency_threshold_ms = 1000  # 1秒
        self.success_rate_threshold = 0.95  # 95%
        
    def log_prediction(
        self,
        model_name: str,
        latency_ms: float,
        input_length: int,
        output_length: int,
        success: bool,
        error: Optional[str] = None,
        confidence: Optional[float] = None
    ):
        """記錄預測指標"""
        metrics = ModelMetrics(
            model_name=model_name,
            timestamp=datetime.now().isoformat(),
            latency_ms=latency_ms,
            input_length=input_length,
            output_length=output_length,
            success=success,
            error=error,
            confidence=confidence
        )
        
        # 添加到緩存
        self.metrics_cache[model_name].append(metrics)
        
        # 定期寫入磁盤
        if len(self.metrics_cache[model_name]) % 100 == 0:
            self._flush_metrics(model_name)
            
    def _flush_metrics(self, model_name: str):
        """將指標寫入磁盤"""
        if not self.metrics_cache[model_name]:
            return
            
        date_str = datetime.now().strftime("%Y%m%d")
        metrics_file = self.metrics_dir / f"{model_name}_{date_str}.jsonl"
        
        with open(metrics_file, 'a', encoding='utf-8') as f:
            for metrics in self.metrics_cache[model_name]:
                f.write(json.dumps(asdict(metrics)) + '\n')
                
    def get_model_health(self, model_name: str) -> ModelHealth:
        """獲取模型健康狀態"""
        metrics_list = list(self.metrics_cache[model_name])
        
        if not metrics_list:
            return ModelHealth(
                model_name=model_name,
                status="unknown",
                avg_latency_ms=0,
                p95_latency_ms=0,
                p99_latency_ms=0,
                success_rate=0,
                total_requests=0,
                error_count=0,
                last_check=datetime.now().isoformat()
            )
            
        # 計算指標
        latencies = [m.latency_ms for m in metrics_list]
        successes = [m.success for m in metrics_list]
        errors = [m.error for m in metrics_list if m.error]
        
        avg_latency = sum(latencies) / len(latencies)
        sorted_latencies = sorted(latencies)
        p95_latency = sorted_latencies[int(len(sorted_latencies) * 0.95)]
        p99_latency = sorted_latencies[int(len(sorted_latencies) * 0.99)]
        success_rate = sum(successes) / len(successes)
        
        # 判斷健康狀態
        if success_rate < 0.9 or avg_latency > self.latency_threshold_ms * 2:
            status = "unhealthy"
        elif success_rate < self.success_rate_threshold or avg_latency > self.latency_threshold_ms:
            status = "degraded"
        else:
            status = "healthy"
            
        return ModelHealth(
            model_name=model_name,
            status=status,
            avg_latency_ms=avg_latency,
            p95_latency_ms=p95_latency,
            p99_latency_ms=p99_latency,
            success_rate=success_rate,
            total_requests=len(metrics_list),
            error_count=len(errors),
            last_error=errors[-1] if errors else None,
            last_check=datetime.now().isoformat()
        )
        
    def get_all_health(self) -> List[ModelHealth]:
        """獲取所有模型健康狀態"""
        return [
            self.get_model_health(model_name)
            for model_name in self.metrics_cache.keys()
        ]
        
    def get_dashboard_data(self) -> Dict[str, Any]:
        """獲取儀表板數據"""
        all_health = self.get_all_health()
        
        total_requests = sum(h.total_requests for h in all_health)
        total_errors = sum(h.error_count for h in all_health)
        
        healthy_models = [h for h in all_health if h.status == "healthy"]
        degraded_models = [h for h in all_health if h.status == "degraded"]
        unhealthy_models = [h for h in all_health if h.status == "unhealthy"]
        
        return {
            "timestamp": datetime.now().isoformat(),
            "summary": {
                "total_models": len(all_health),
                "healthy": len(healthy_models),
                "degraded": len(degraded_models),
                "unhealthy": len(unhealthy_models),
                "total_requests": total_requests,
                "total_errors": total_errors,
                "overall_success_rate": (total_requests - total_errors) / total_requests if total_requests > 0 else 0
            },
            "models": [asdict(h) for h in all_health],
            "alerts": [
                {
                    "model": h.model_name,
                    "status": h.status,
                    "reason": f"Success rate: {h.success_rate:.2%}, Latency: {h.avg_latency_ms:.0f}ms"
                }
                for h in all_health
                if h.status in ["degraded", "unhealthy"]
            ]
        }
        
    def cleanup_old_metrics(self, days: int = 7):
        """清理舊指標"""
        cutoff_date = datetime.now() - timedelta(days=days)
        
        for metrics_file in self.metrics_dir.glob("*.jsonl"):
            # 從文件名提取日期
            try:
                date_str = metrics_file.stem.split('_')[-1]
                file_date = datetime.strptime(date_str, "%Y%m%d")
                
                if file_date < cutoff_date:
                    metrics_file.unlink()
                    print(f"[ModelMonitor] Deleted old metrics: {metrics_file.name}")
            except Exception as e:
                print(f"[ModelMonitor] Error processing {metrics_file.name}: {e}")

# 全局監控器實例
model_monitor = ModelMonitor()