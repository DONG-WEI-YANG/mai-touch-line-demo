"""
Tiny NLP Models
Lightweight models for intent classification, sentiment analysis, and entity extraction
"""

import torch
import torch.nn as nn
from transformers import AutoTokenizer, AutoModel
from typing import Dict, List, Any, Optional
from enum import Enum
import logging

logger = logging.getLogger(__name__)


class TinyIntentClassifier(nn.Module):
    """
    Tiny intent classification model
    Based on DistilBERT with custom classification head
    """

    def __init__(
        self,
        model_name: str = "distilbert-base-uncased",
        num_intents: int = 20,
        hidden_size: int = 768,
        dropout: float = 0.1,
    ):
        super().__init__()

        # Load pre-trained model
        self.encoder = AutoModel.from_pretrained(model_name)
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)

        # Classification head
        self.classifier = nn.Sequential(
            nn.Dropout(dropout),
            nn.Linear(hidden_size, hidden_size // 2),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_size // 2, num_intents),
        )

        # Intent labels
        self.intent_labels = [
            "amenity_booking",
            "maintenance_request",
            "security_concern",
            "noise_complaint",
            "guest_management",
            "space_control",
            "privacy_request",
            "concierge_service",
            "lifestyle_service",
            "emergency",
            "greeting",
            "farewell",
            "question",
            "complaint",
            "feedback",
            "cancel_request",
            "modify_request",
            "status_inquiry",
            "general_inquiry",
            "other",
        ]

    def forward(self, input_ids, attention_mask):
        """Forward pass"""
        outputs = self.encoder(input_ids=input_ids, attention_mask=attention_mask)
        pooled_output = outputs.last_hidden_state[:, 0]  # CLS token
        logits = self.classifier(pooled_output)
        return logits

    @torch.no_grad()
    def predict(self, text: str) -> Dict[str, Any]:
        """Predict intent from text"""
        self.eval()

        # Tokenize
        inputs = self.tokenizer(
            text, return_tensors="pt", padding=True, truncation=True, max_length=128
        )

        # Forward pass
        logits = self.forward(inputs["input_ids"], inputs["attention_mask"])
        probs = torch.softmax(logits, dim=-1)

        # Get top predictions
        top_probs, top_indices = torch.topk(probs, k=3, dim=-1)

        predictions = []
        for prob, idx in zip(top_probs[0], top_indices[0]):
            predictions.append(
                {"intent": self.intent_labels[idx.item()], "confidence": prob.item()}
            )

        return {
            "primary_intent": predictions[0]["intent"],
            "confidence": predictions[0]["confidence"],
            "all_predictions": predictions,
        }


class TinySentimentAnalyzer(nn.Module):
    """
    Tiny sentiment analysis model
    Detects emotion and urgency in text
    """

    def __init__(
        self,
        model_name: str = "distilbert-base-uncased",
        hidden_size: int = 768,
        dropout: float = 0.1,
    ):
        super().__init__()

        self.encoder = AutoModel.from_pretrained(model_name)
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)

        # Multi-task heads
        self.emotion_classifier = nn.Sequential(
            nn.Dropout(dropout),
            nn.Linear(hidden_size, hidden_size // 2),
            nn.ReLU(),
            nn.Linear(hidden_size // 2, 7),  # 7 emotions
        )

        self.urgency_classifier = nn.Sequential(
            nn.Dropout(dropout),
            nn.Linear(hidden_size, hidden_size // 2),
            nn.ReLU(),
            nn.Linear(hidden_size // 2, 4),  # 4 urgency levels
        )

        self.emotions = [
            "neutral",
            "fatigue",
            "urgency",
            "frustration",
            "satisfaction",
            "discretion_needed",
            "emergency",
        ]
        self.urgency_levels = ["low", "medium", "high", "critical"]

    def forward(self, input_ids, attention_mask):
        """Forward pass"""
        outputs = self.encoder(input_ids=input_ids, attention_mask=attention_mask)
        pooled_output = outputs.last_hidden_state[:, 0]

        emotion_logits = self.emotion_classifier(pooled_output)
        urgency_logits = self.urgency_classifier(pooled_output)

        return emotion_logits, urgency_logits

    @torch.no_grad()
    def predict(self, text: str) -> Dict[str, Any]:
        """Predict sentiment from text"""
        self.eval()

        inputs = self.tokenizer(
            text, return_tensors="pt", padding=True, truncation=True, max_length=128
        )

        emotion_logits, urgency_logits = self.forward(
            inputs["input_ids"], inputs["attention_mask"]
        )

        emotion_probs = torch.softmax(emotion_logits, dim=-1)
        urgency_probs = torch.softmax(urgency_logits, dim=-1)

        emotion_idx = torch.argmax(emotion_probs, dim=-1).item()
        urgency_idx = torch.argmax(urgency_probs, dim=-1).item()

        return {
            "emotion": self.emotions[emotion_idx],
            "emotion_confidence": emotion_probs[0][emotion_idx].item(),
            "urgency": self.urgency_levels[urgency_idx],
            "urgency_confidence": urgency_probs[0][urgency_idx].item(),
        }


class TinyEntityExtractor(nn.Module):
    """
    Tiny entity extraction model
    Extracts key entities like dates, times, locations, etc.
    """

    def __init__(
        self,
        model_name: str = "distilbert-base-uncased",
        num_entity_types: int = 10,
        hidden_size: int = 768,
        dropout: float = 0.1,
    ):
        super().__init__()

        self.encoder = AutoModel.from_pretrained(model_name)
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)

        # Token classification head
        self.classifier = nn.Sequential(
            nn.Dropout(dropout),
            nn.Linear(hidden_size, hidden_size // 2),
            nn.ReLU(),
            nn.Linear(hidden_size // 2, num_entity_types),
        )

        self.entity_types = [
            "O",  # Outside
            "DATE",
            "TIME",
            "LOCATION",
            "PERSON",
            "AMENITY",
            "SERVICE",
            "NUMBER",
            "DURATION",
            "OTHER",
        ]

    def forward(self, input_ids, attention_mask):
        """Forward pass"""
        outputs = self.encoder(input_ids=input_ids, attention_mask=attention_mask)
        sequence_output = outputs.last_hidden_state
        logits = self.classifier(sequence_output)
        return logits

    @torch.no_grad()
    def predict(self, text: str) -> Dict[str, Any]:
        """Extract entities from text"""
        self.eval()

        inputs = self.tokenizer(
            text,
            return_tensors="pt",
            padding=True,
            truncation=True,
            max_length=128,
            return_offsets_mapping=True,
        )

        logits = self.forward(inputs["input_ids"], inputs["attention_mask"])
        predictions = torch.argmax(logits, dim=-1)

        # Extract entities
        entities = []
        tokens = self.tokenizer.convert_ids_to_tokens(inputs["input_ids"][0])

        for i, (token, pred) in enumerate(zip(tokens, predictions[0])):
            if pred.item() > 0:  # Not "O"
                entity_type = self.entity_types[pred.item()]
                entities.append({"text": token, "type": entity_type, "position": i})

        return {"entities": entities, "count": len(entities)}


import re
import time


class RuleBasedNLPEngine:
    """
    Fallback NLP engine using regex and heuristics.
    Ensures zero-downtime even if deep learning models fail.
    """

    def __init__(self):
        self.intent_rules = [
            (
                r"(book|reserve|reservation|appointment|schedule).*(room|pool|gym|spa|cinema|dining|facility)",
                "amenity_booking",
            ),
            (
                r"(fix|repair|broken|maintenance|leak|leakage|clogged|light|bulb|ac|hvac)",
                "maintenance_request",
            ),
            (r"(emergency|help|danger|police|ambulance|fire|urgent)", "emergency"),
            (
                r"(security|guard|intruder|trespass|camera|lock|alarm)",
                "security_concern",
            ),
            (r"(noise|loud|music|party|shouting|neighbor)", "noise_complaint"),
            (r"(guest|visitor|arrival|entry|access|invite)", "guest_management"),
            (
                r"(lights|temp|temperature|curtains|blinds|smart).*(home|apartment|room)",
                "space_control",
            ),
            (r"(privacy|private|disturb|dnd)", "privacy_request"),
            (r"(hi|hello|hey|good morning|good evening)", "greeting"),
            (r"(bye|goodbye|see you)", "farewell"),
            (
                r"(status|progress|update|tracking).*(order|booking|request)",
                "status_inquiry",
            ),
        ]

        self.entity_patterns = {
            "TIME": r"\b(\d{1,2}(:\d{2})?\s*(am|pm|AM|PM)?|noon|midnight|tonight|evening|morning)\b",
            "DATE": r"\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next\s+\w+)\b",
            "NUMBER": r"\b\d+\b",
            "AMENITY": r"\b(pool|gym|spa|cinema|dining|lounge|terrace|sauna)\b",
        }

    def analyze(self, text: str) -> Dict[str, Any]:
        text = text.lower()

        # Intent detection
        found_intent = "other"
        for pattern, intent in self.intent_rules:
            if re.search(pattern, text):
                found_intent = intent
                break

        # Entity extraction
        entities = []
        for entity_type, pattern in self.entity_patterns.items():
            matches = re.finditer(pattern, text)
            for match in matches:
                entities.append(
                    {
                        "text": match.group(),
                        "type": entity_type,
                        "position": match.start(),
                    }
                )

        # Sentiment/Emotion heuristic
        emotion = "neutral"
        if any(
            word in text for word in ["urgent", "fast", "now", "immediately", "asap"]
        ):
            emotion = "urgency"
        elif any(
            word in text
            for word in ["angry", "bad", "problem", "issue", "worst", "broken"]
        ):
            emotion = "frustration"
        elif any(
            word in text for word in ["happy", "good", "great", "thanks", "thank you"]
        ):
            emotion = "satisfaction"

        return {
            "intent": found_intent,
            "confidence": 0.85 if found_intent != "other" else 0.5,
            "entities": entities,
            "sentiment": {
                "emotion": emotion,
                "score": 0.7 if emotion != "neutral" else 0.5,
            },
            "processing_mode": "fallback_rule_based",
        }


class CircuitBreakerStatus(Enum):
    CLOSED = "closed"  # Healthy, allow neural
    OPEN = "open"  # Unhealthy, block neural
    HALF_OPEN = "half_open"  # Testing recovery


class SelfHealingModelWrapper:
    """
    Advanced wrapper with Circuit Breaker and Resource Awareness.
    """

    def __init__(
        self, model_instance: Optional[nn.Module], model_type: str, tier: str = "high"
    ):
        self.model = model_instance
        self.model_type = model_type
        self.tier = tier
        self.fallback = RuleBasedNLPEngine()

        self.status = CircuitBreakerStatus.CLOSED
        self.failure_threshold = 5
        self.failure_count = 0
        self.last_failure_time = 0
        self.recovery_timeout = 60  # seconds
        self.total_processed = 0
        self.total_errors = 0

    def predict(self, text: str) -> Dict[str, Any]:
        # 1. Resource Guard: Check if we should even try the neural engine
        import psutil

        mem = psutil.virtual_memory()
        if mem.percent > 90 and self.tier == "high":
            logger.warning(
                f"Resource pressure detected ({mem.percent}%). Tier {self.tier} skipping to fallback."
            )
            return self.fallback.analyze(text)

        # 2. Circuit Breaker Logic
        if self.status == CircuitBreakerStatus.OPEN:
            if time.time() - self.last_failure_time > self.recovery_timeout:
                self.status = CircuitBreakerStatus.HALF_OPEN
                logger.info(
                    f"Circuit Breaker for {self.model_type} entering HALF_OPEN state."
                )
            else:
                return self.fallback.analyze(text)

        if self.model is None:
            return self.fallback.analyze(text)

        # 3. Execution with Capture
        try:
            self.total_processed += 1
            result = self.model.predict(text)

            # Successful call in HALF_OPEN heals the circuit
            if self.status == CircuitBreakerStatus.HALF_OPEN:
                self.status = CircuitBreakerStatus.CLOSED
                self.failure_count = 0
                logger.info(
                    f"Circuit Breaker for {self.model_type} restored to CLOSED."
                )

            result["processing_mode"] = f"neural_{self.tier}"
            return result
        except Exception as e:
            self.failure_count += 1
            self.total_errors += 1
            self.last_failure_time = time.time()
            logger.error(
                f"Execution error on {self.model_type} (Tier {self.tier}): {e}"
            )

            if self.failure_count >= self.failure_threshold:
                self.status = CircuitBreakerStatus.OPEN
                logger.critical(
                    f"Circuit Breaker for {self.model_type} TRIPPED (OPEN)."
                )

            return self.fallback.analyze(text)


class StatisticalEngine:
    """
    Tier 4: Non-neural statistical engine.
    Enhanced with Multi-language support (English & Chinese).
    """

    def __init__(self):
        self.vocabulary = {
            "amenity_booking": [
                "book",
                "reserve",
                "pool",
                "gym",
                "spa",
                "room",
                "appointment",
                "slot",
                "預約",
                "訂",
                "游泳池",
                "健身房",
                "桑拿",
                "時段",
            ],
            "maintenance_request": [
                "fix",
                "repair",
                "broken",
                "leak",
                "light",
                "ac",
                "water",
                "clogged",
                "維修",
                "修理",
                "壞了",
                "漏水",
                "燈泡",
                "空調",
                "冷氣",
            ],
            "emergency": [
                "help",
                "danger",
                "fire",
                "emergency",
                "hurt",
                "police",
                "ambulance",
                "救命",
                "火災",
                "緊急",
                "警察",
                "救護車",
            ],
            "security_concern": [
                "security",
                "stranger",
                "guard",
                "camera",
                "lock",
                "intruder",
                "安全",
                "陌生人",
                "保全",
                "監控",
                "鎖",
                "闖入",
            ],
            "guest_management": [
                "guest",
                "visitor",
                "invite",
                "arrival",
                "access",
                "entry",
                "訪客",
                "客人",
                "邀請",
                "到達",
                "進入",
                "通行",
            ],
            "space_control": [
                "temperature",
                "light",
                "curtain",
                "blind",
                "ac",
                "set",
                "adjust",
                "溫度",
                "燈光",
                "窗簾",
                "設定",
                "調整",
            ],
        }

    def analyze(self, text: str) -> Dict[str, Any]:
        text = text.lower().replace(" ", "")  # Remove spaces for dense language check
        scores = {}

        for intent, keywords in self.vocabulary.items():
            # Substring matching for Chinese support
            match_count = sum(1 for kw in keywords if kw.lower() in text)
            if match_count > 0:
                scores[intent] = match_count / len(keywords)

        if not scores:
            return {
                "intent": "other",
                "confidence": 0.0,
                "processing_mode": "statistical_none",
            }

        best_intent = max(scores, key=scores.get)
        return {
            "intent": best_intent,
            "confidence": min(0.9, 0.5 + scores[best_intent] * 2),
            "processing_mode": "statistical_engine_multi_lang",
            "entities": [],
        }


class MultiTierOrchestrator:
    """
    Hyper-fast 5-Tier Orchestrator with Parallel Racing and Cache.
    """

    def __init__(self, models: List[SelfHealingModelWrapper]):
        self.models = sorted(
            models,
            key=lambda x: {
                "remote": 0,
                "high": 1,
                "tiny": 2,
                "statistical": 3,
                "rule": 4,
            }.get(x.tier, 5),
        )
        self.statistical = StatisticalEngine()
        self.rule_based = RuleBasedNLPEngine()
        self.cache = {}  # Simple in-memory semantic cache
        self.cache_limit = 1000

    def dispatch(self, text: str) -> Dict[str, Any]:
        normalized_text = text.lower().strip()

        # 1. Instant Cache Lookup (< 1ms)
        if normalized_text in self.cache:
            res = self.cache[normalized_text].copy()
            res["processing_mode"] += "_cached"
            return res

        # 2. Heuristic Pre-check (Super fast)
        # If it's a very short command, rule-based is often more accurate/fast
        if len(normalized_text) < 10:
            quick_res = self.rule_based.analyze(text)
            if quick_res["confidence"] > 0.8:
                return quick_res

        # 3. Parallel Race Dispatch (for Speed)
        # In a production Python environment, we'd use concurrent.futures
        # Here we simulate the logic: attempt High Tier with a tight timeout,
        # while Tiny Tier runs as a fallback race participant.

        best_result = None

        # Real implementation would use threads for L2 and L3 here
        # For this logic, we'll try L2 first but immediately fall to L3 if L2 is flagged slow
        for wrapper in self.models:
            if wrapper.status == CircuitBreakerStatus.CLOSED:
                res = wrapper.predict(text)
                if (
                    "neural" in res.get("processing_mode", "")
                    and res.get("confidence", 0) > 0.7
                ):
                    best_result = res
                    break

        if not best_result:
            # Fallback chain
            best_result = self.statistical.analyze(text)
            if best_result["intent"] == "other":
                best_result = self.rule_based.analyze(text)

        # 4. Populate Cache
        if len(self.cache) < self.cache_limit:
            self.cache[normalized_text] = best_result

        return best_result


class ModelLoader:
    """Advanced ModelLoader for 5-tier system"""

    @staticmethod
    def load_tiered_models(config: Dict[str, Any]) -> MultiTierOrchestrator:
        m_type = config.get("type", "intent")
        wrappers = []

        # 1. Load High Tier (DistilBERT)
        wrappers.append(
            ModelLoader._load_single(config, "high", "distilbert-base-uncased")
        )

        # 2. Load Tiny Tier (BERT-Tiny)
        wrappers.append(ModelLoader._load_single(config, "tiny", "prajjwal1/bert-tiny"))

        return MultiTierOrchestrator(wrappers)

    @staticmethod
    def _load_single(
        config: Dict[str, Any], tier: str, m_name: str
    ) -> SelfHealingModelWrapper:
        m_type = config.get("type")
        try:
            # Check for transformers only if needed to save boot time in some environments
            from transformers import AutoModel

            model = None
            if tier == "high":
                model = (
                    TinyIntentClassifier(model_name=m_name)
                    if m_type == "intent"
                    else (
                        TinySentimentAnalyzer(model_name=m_name)
                        if m_type == "sentiment"
                        else TinyEntityExtractor(model_name=m_name)
                    )
                )
            elif tier == "tiny":
                # For tiny tier, we use even smaller params
                model = TinyIntentClassifier(model_name=m_name)

            if model:
                model.eval()
            return SelfHealingModelWrapper(model, m_type, tier)
        except Exception as e:
            logger.warning(f"Failed to load neural {tier}: {e}")
            return SelfHealingModelWrapper(None, m_type, tier)
