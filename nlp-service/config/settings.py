"""
NLP Service Configuration
"""
from pydantic_settings import BaseSettings
from typing import List, Dict, Any
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings"""
    
    # Service settings
    service_name: str = "mai-touch-nlp"
    service_version: str = "1.0.0"
    debug: bool = False
    
    # Expanded Model pool settings
    pool_size: int = 10 # Increased from 3
    max_queue_size: int = 200
    health_check_interval: int = 30
    
    # Specialized Model configurations
    model_configs: List[Dict[str, Any]] = [
        {"name": "distilbert-base-uncased", "type": "intent_general", "tier": "high"},
        {"name": "prajjwal1/bert-tiny", "type": "intent_fast", "tier": "tiny"},
        {"name": "distilbert-base-uncased", "type": "sentiment", "tier": "high"},
        {"name": "distilbert-base-uncased", "type": "entity_ner", "tier": "high"},
        {"name": "bert-base-chinese", "type": "intent_zh", "tier": "high"},
        {"name": "text-classification-model", "type": "priority_check", "tier": "tiny"}
    ]
    
    # API settings
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_workers: int = 4
    
    # Request settings
    max_text_length: int = 512
    default_timeout: float = 5.0
    max_batch_size: int = 100
    
    # Cache settings
    enable_cache: bool = True
    cache_ttl: int = 3600  # 1 hour
    redis_url: str = "redis://localhost:6379"
    
    # Monitoring
    enable_metrics: bool = True
    metrics_port: int = 9090
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()
