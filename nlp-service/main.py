"""
NLP Service Main API
FastAPI service with model pooling and load balancing
"""
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
import asyncio
import logging
from contextlib import asynccontextmanager

from pool.model_pool import ModelPool
from config.settings import get_settings
from models.model_registry import model_registry
from mlops.model_monitor import model_monitor

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Global model pool
model_pool: Optional[ModelPool] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown"""
    global model_pool
    
    # Startup
    logger.info("Starting NLP Service...")
    settings = get_settings()
    
    model_pool = ModelPool(
        model_configs=settings.model_configs,
        pool_size=settings.pool_size,
        max_queue_size=settings.max_queue_size
    )
    
    await model_pool.initialize()
    logger.info("NLP Service started successfully")
    
    yield
    
    # Shutdown
    logger.info("Shutting down NLP Service...")
    if model_pool:
        await model_pool.shutdown()
    logger.info("NLP Service shutdown complete")


# Create FastAPI app
app = FastAPI(
    title="m'AI Touch NLP Service",
    description="Tiny NLP models with pooling and load balancing",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request/Response models
class NLPRequest(BaseModel):
    text: str = Field(..., description="Input text to analyze")
    task: str = Field(
        default="intent",
        description="NLP task: intent, sentiment, entity, or all"
    )
    language: Optional[str] = Field(
        default="en",
        description="Language code (en, zh, etc.)"
    )
    timeout: Optional[float] = Field(
        default=5.0,
        description="Request timeout in seconds"
    )


class IntentResult(BaseModel):
    primary_intent: str
    confidence: float
    sub_intent: Optional[str] = None
    all_predictions: List[Dict[str, Any]]


class SentimentResult(BaseModel):
    emotion: str
    emotion_confidence: float
    urgency: str
    urgency_confidence: float


class EntityResult(BaseModel):
    entities: List[Dict[str, Any]]
    count: int


class NLPResponse(BaseModel):
    success: bool
    task: str
    language: str
    processing_time_ms: float
    model_id: str
    processing_mode: str = "neural"
    intent: Optional[IntentResult] = None
    sentiment: Optional[SentimentResult] = None
    entities: Optional[EntityResult] = None
    error: Optional[str] = None


# API Endpoints
@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "m'AI Touch NLP Service (Self-Healing)",
        "version": "1.1.0",
        "features": ["Neural Engine", "Rule-based Fallback", "Auto-Heal"],
        "status": "running"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    if not model_pool:
        raise HTTPException(status_code=503, detail="Model pool not initialized")
    
    stats = model_pool.get_stats()
    # Check if any neural engine is actually running
    neural_healthy = any(inst.get("status") == "idle" for inst in stats.get("instances", []))
    
    return {
        "status": "healthy" if neural_healthy else "degraded",
        "mode": "full" if neural_healthy else "fallback_only",
        "pool_stats": stats
    }


@app.get("/stats")
async def get_stats():
    """Get detailed statistics"""
    if not model_pool:
        raise HTTPException(status_code=503, detail="Model pool not initialized")
    
    return model_pool.get_stats()


@app.post("/analyze", response_model=NLPResponse)
async def analyze_text(request: NLPRequest):
    """
    Analyze text using Self-Healing NLP models
    """
    if not model_pool:
        raise HTTPException(status_code=503, detail="Model pool not initialized")
    
    import time
    start_time = time.time()
    
    try:
        # Process request through model pool
        result = await model_pool.process_request(
            text=request.text,
            task=request.task,
            timeout=request.timeout
        )
        
        processing_time = (time.time() - start_time) * 1000
        
        # Log to MLOps monitor
        model_monitor.log_prediction(
            model_name=result.get("model_name", "unknown"),
            latency_ms=processing_time,
            input_length=len(request.text),
            output_length=len(str(result)),
            success=True
        )
        
        # Update model registry usage
        model_registry.update_usage(
            result.get("model_name", "unknown"),
            processing_time
        )
        
        # Format response based on task
        response_data = {
            "success": True,
            "task": request.task,
            "language": request.language,
            "processing_time_ms": processing_time,
            "model_id": result.get("model_id", "unknown"),
            "processing_mode": result.get("processing_mode", "neural")
        }
        
        # Mapping enhanced structure
        if request.task in ["intent", "all"]:
            intent_data = {
                "primary_intent": result.get("intent", result.get("primary_intent", "unknown")),
                "confidence": result.get("confidence", 0.0),
                "sub_intent": result.get("sub_intent"),
                "all_predictions": result.get("all_predictions", [{"label": result.get("intent", "unknown"), "score": result.get("confidence", 0.0)}])
            }
            response_data["intent"] = IntentResult(**intent_data)
        
        if request.task in ["sentiment", "all"]:
            sent_data = result.get("sentiment", {})
            sentiment_data = {
                "emotion": sent_data.get("emotion", "neutral"),
                "emotion_confidence": sent_data.get("score", sent_data.get("emotion_confidence", 0.0)),
                "urgency": result.get("urgency", "medium"),
                "urgency_confidence": result.get("urgency_confidence", 0.0)
            }
            response_data["sentiment"] = SentimentResult(**sentiment_data)
        
        if request.task in ["entity", "all"]:
            response_data["entities"] = EntityResult(
                entities=result.get("entities", []),
                count=len(result.get("entities", []))
            )
        
        return NLPResponse(**response_data)
        
    except asyncio.TimeoutError:
        # Log timeout error
        model_monitor.log_prediction(
            model_name="unknown",
            latency_ms=(time.time() - start_time) * 1000,
            input_length=len(request.text),
            output_length=0,
            success=False,
            error="Request timeout"
        )
        raise HTTPException(
            status_code=408,
            detail=f"Request timeout after {request.timeout}s"
        )
    
    except Exception as e:
        # Log error
        model_monitor.log_prediction(
            model_name="unknown",
            latency_ms=(time.time() - start_time) * 1000,
            input_length=len(request.text),
            output_length=0,
            success=False,
            error=str(e)
        )
        logger.error(f"Analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/batch-analyze")
async def batch_analyze(requests: List[NLPRequest]):
    """
    Batch analyze multiple texts
    """
    if not model_pool:
        raise HTTPException(status_code=503, detail="Model pool not initialized")
    
    if len(requests) > 100:
        raise HTTPException(
            status_code=400,
            detail="Batch size exceeds maximum of 100"
        )
    
    # Process all requests concurrently
    tasks = [analyze_text(req) for req in requests]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Format results
    responses = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            responses.append({
                "success": False,
                "error": str(result),
                "index": i
            })
        else:
            responses.append(result)
    
    return {
        "total": len(requests),
        "successful": sum(1 for r in responses if r.get("success", False)),
        "failed": sum(1 for r in responses if not r.get("success", False)),
        "results": responses
    }


@app.get("/models")
async def list_models(
    task: Optional[str] = None,
    language: Optional[str] = None,
    size: Optional[str] = None,
    downloaded_only: bool = False
):
    """List available models"""
    models = model_registry.list_models(
        task=task,
        language=language,
        size=size,
        downloaded_only=downloaded_only
    )
    
    return {
        "total": len(models),
        "models": [
            {
                "name": m.name,
                "version": m.version,
                "task": m.task,
                "language": m.language,
                "size": m.size,
                "downloaded": m.downloaded,
                "usage_count": m.usage_count,
                "latency_ms": m.latency_ms
            }
            for m in models
        ]
    }


@app.get("/models/stats")
async def get_model_stats():
    """Get model registry statistics"""
    return model_registry.get_statistics()


@app.post("/models/{model_name}/download")
async def download_model(model_name: str, background_tasks: BackgroundTasks):
    """Download a specific model"""
    model = model_registry.get_model(model_name)
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    
    if model.downloaded:
        return {
            "success": True,
            "message": "Model already downloaded",
            "model": model_name
        }
    
    # Download in background
    background_tasks.add_task(model_registry.download_model, model_name)
    
    return {
        "success": True,
        "message": "Model download started",
        "model": model_name
    }


@app.get("/mlops/health")
async def mlops_health():
    """Get MLOps health status for all models"""
    health_data = model_monitor.get_all_health()
    
    return {
        "timestamp": health_data[0].last_check if health_data else None,
        "total_models": len(health_data),
        "models": [
            {
                "name": h.model_name,
                "status": h.status,
                "avg_latency_ms": h.avg_latency_ms,
                "p95_latency_ms": h.p95_latency_ms,
                "success_rate": h.success_rate,
                "total_requests": h.total_requests,
                "error_count": h.error_count
            }
            for h in health_data
        ]
    }


@app.get("/mlops/dashboard")
async def mlops_dashboard():
    """Get MLOps dashboard data"""
    return model_monitor.get_dashboard_data()


@app.get("/mlops/model/{model_name}")
async def get_model_health(model_name: str):
    """Get health status for a specific model"""
    health = model_monitor.get_model_health(model_name)
    
    return {
        "model_name": health.model_name,
        "status": health.status,
        "metrics": {
            "avg_latency_ms": health.avg_latency_ms,
            "p95_latency_ms": health.p95_latency_ms,
            "p99_latency_ms": health.p99_latency_ms,
            "success_rate": health.success_rate,
            "total_requests": health.total_requests,
            "error_count": health.error_count
        },
        "last_error": health.last_error,
        "last_check": health.last_check
    }


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
