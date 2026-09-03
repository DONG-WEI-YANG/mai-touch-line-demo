"""
Model Loader
實際加載和管理 HuggingFace 模型
"""

import logging
from typing import Dict, Any, Optional, List
from pathlib import Path
import torch

logger = logging.getLogger(__name__)


class ModelLoader:
    """模型加載器"""

    def __init__(self, models_dir: str = "./models/pretrained"):
        self.models_dir = Path(models_dir)
        self.models_dir.mkdir(parents=True, exist_ok=True)
        self.loaded_models: Dict[str, Any] = {}

        # 檢查是否有 GPU
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info(f"Using device: {self.device}")

    def load_model(self, model_name: str, task: str) -> Optional[Dict[str, Any]]:
        """加載模型"""

        # 如果已經加載，直接返回
        if model_name in self.loaded_models:
            logger.info(f"Model {model_name} already loaded")
            return self.loaded_models[model_name]

        model_path = self.models_dir / model_name

        if not model_path.exists():
            logger.warning(f"Model path {model_path} does not exist")
            return None

        try:
            from transformers import (
                AutoTokenizer,
                AutoModel,
                AutoModelForSequenceClassification,
                AutoModelForTokenClassification,
                AutoModelForQuestionAnswering,
                pipeline,
            )

            # 檢查是否有實際的模型文件
            has_model = (
                (model_path / "pytorch_model.bin").exists()
                or (model_path / "model.safetensors").exists()
                or (model_path / "tf_model.h5").exists()
            )

            if not has_model:
                logger.warning(f"No model files found in {model_path}")
                return None

            logger.info(f"Loading model {model_name} for task {task}")

            # 根據任務類型加載不同的模型
            if task in ["classification", "sentiment", "intent"]:
                tokenizer = AutoTokenizer.from_pretrained(str(model_path))
                model = AutoModelForSequenceClassification.from_pretrained(
                    str(model_path),
                    device_map=self.device if self.device == "cuda" else None,
                )

                if self.device == "cpu":
                    model = model.to(self.device)

                pipe = pipeline(
                    "text-classification",
                    model=model,
                    tokenizer=tokenizer,
                    device=0 if self.device == "cuda" else -1,
                )

                model_obj = {
                    "name": model_name,
                    "task": task,
                    "type": "classification",
                    "pipeline": pipe,
                    "tokenizer": tokenizer,
                    "model": model,
                    "device": self.device,
                }

            elif task in ["ner", "entity"]:
                tokenizer = AutoTokenizer.from_pretrained(str(model_path))
                model = AutoModelForTokenClassification.from_pretrained(
                    str(model_path),
                    device_map=self.device if self.device == "cuda" else None,
                )

                if self.device == "cpu":
                    model = model.to(self.device)

                pipe = pipeline(
                    "ner",
                    model=model,
                    tokenizer=tokenizer,
                    device=0 if self.device == "cuda" else -1,
                    aggregation_strategy="simple",
                )

                model_obj = {
                    "name": model_name,
                    "task": task,
                    "type": "ner",
                    "pipeline": pipe,
                    "tokenizer": tokenizer,
                    "model": model,
                    "device": self.device,
                }

            elif task == "qa":
                tokenizer = AutoTokenizer.from_pretrained(str(model_path))
                model = AutoModelForQuestionAnswering.from_pretrained(
                    str(model_path),
                    device_map=self.device if self.device == "cuda" else None,
                )

                if self.device == "cpu":
                    model = model.to(self.device)

                pipe = pipeline(
                    "question-answering",
                    model=model,
                    tokenizer=tokenizer,
                    device=0 if self.device == "cuda" else -1,
                )

                model_obj = {
                    "name": model_name,
                    "task": task,
                    "type": "qa",
                    "pipeline": pipe,
                    "tokenizer": tokenizer,
                    "model": model,
                    "device": self.device,
                }

            elif task in ["embedding", "encode"]:
                tokenizer = AutoTokenizer.from_pretrained(str(model_path))
                model = AutoModel.from_pretrained(
                    str(model_path),
                    device_map=self.device if self.device == "cuda" else None,
                )

                if self.device == "cpu":
                    model = model.to(self.device)

                model_obj = {
                    "name": model_name,
                    "task": task,
                    "type": "embedding",
                    "tokenizer": tokenizer,
                    "model": model,
                    "device": self.device,
                }

            else:
                # 默認加載基礎模型
                tokenizer = AutoTokenizer.from_pretrained(str(model_path))
                model = AutoModel.from_pretrained(
                    str(model_path),
                    device_map=self.device if self.device == "cuda" else None,
                )

                if self.device == "cpu":
                    model = model.to(self.device)

                model_obj = {
                    "name": model_name,
                    "task": task,
                    "type": "base",
                    "tokenizer": tokenizer,
                    "model": model,
                    "device": self.device,
                }

            # 緩存模型
            self.loaded_models[model_name] = model_obj

            logger.info(f"Successfully loaded model {model_name}")
            return model_obj

        except Exception as e:
            logger.error(f"Error loading model {model_name}: {e}")
            return None

    def unload_model(self, model_name: str):
        """卸載模型"""
        if model_name in self.loaded_models:
            model_obj = self.loaded_models[model_name]

            # 清理模型
            if "model" in model_obj:
                del model_obj["model"]
            if "tokenizer" in model_obj:
                del model_obj["tokenizer"]
            if "pipeline" in model_obj:
                del model_obj["pipeline"]

            del self.loaded_models[model_name]

            # 清理 GPU 緩存
            if torch.cuda.is_available():
                torch.cuda.empty_cache()

            logger.info(f"Unloaded model {model_name}")

    def get_loaded_models(self) -> List[str]:
        """獲取已加載的模型列表"""
        return list(self.loaded_models.keys())

    def inference(
        self, model_name: str, text: str, task: str, **kwargs
    ) -> Dict[str, Any]:
        """執行推理"""

        model_obj = self.loaded_models.get(model_name)

        if not model_obj:
            raise ValueError(f"Model {model_name} not loaded")

        try:
            if "pipeline" in model_obj:
                # 使用 pipeline
                result = model_obj["pipeline"](text, **kwargs)
                return {"success": True, "result": result}

            else:
                # 使用基礎模型
                tokenizer = model_obj["tokenizer"]
                model = model_obj["model"]

                inputs = tokenizer(
                    text,
                    return_tensors="pt",
                    truncation=True,
                    max_length=512,
                    padding=True,
                )

                # 移動到正確的設備
                inputs = {k: v.to(model_obj["device"]) for k, v in inputs.items()}

                with torch.no_grad():
                    outputs = model(**inputs)

                return {
                    "success": True,
                    "result": {
                        "logits": (
                            outputs.logits.cpu().tolist()
                            if hasattr(outputs, "logits")
                            else None
                        ),
                        "last_hidden_state": (
                            outputs.last_hidden_state.shape
                            if hasattr(outputs, "last_hidden_state")
                            else None
                        ),
                    },
                }

        except Exception as e:
            logger.error(f"Error in inference: {e}")
            return {"success": False, "error": str(e)}


# 全局模型加載器實例
model_loader = ModelLoader()
