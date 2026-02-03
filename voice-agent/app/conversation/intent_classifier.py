"""
Intent Classifier
Uses LLM to classify user intent and extract entities
"""

import json
import re
from typing import Optional, Dict, Any, Literal
import structlog

from app.models.responses import IntentResult
from app.conversation.prompts import SYSTEM_PROMPT, INTENT_CLASSIFICATION_PROMPT

logger = structlog.get_logger()


class IntentClassifier:
    """
    LLM-based intent classifier.
    Converts natural language to structured intent + entities.
    """
    
    def __init__(
        self,
        provider: Literal["gemini", "openai", "ollama", "openrouter"] = "openrouter",
        api_key: Optional[str] = None,
        model: Optional[str] = None
    ):
        """
        Initialize intent classifier.
        
        Args:
            provider: LLM provider (gemini, openai, ollama)
            api_key: API key for the provider
            model: Model name override
        """
        self.provider = provider
        self.api_key = api_key
        self.model = model or self._default_model()
        self._client = None
        
        self._initialize_client()
    
    def _default_model(self) -> str:
        """Get default model for provider."""
        defaults = {
            "gemini": "gemini-2.0-flash",
            "openai": "gpt-4o-mini",
            "openrouter": "openai/gpt-4o-mini",
            "ollama": "llama3.1"
        }
        return defaults.get(self.provider, "openai/gpt-4o-mini")
    
    def _initialize_client(self):
        """Initialize LLM client based on provider."""
        try:
            if self.provider == "gemini":
                import google.generativeai as genai
                genai.configure(api_key=self.api_key)
                # Try with system_instruction for newer versions, fallback for older
                try:
                    self._client = genai.GenerativeModel(
                        self.model,
                        system_instruction=SYSTEM_PROMPT
                    )
                except TypeError:
                    # Older version without system_instruction support
                    self._client = genai.GenerativeModel(self.model)
                    self._use_system_prompt_in_message = True
                    logger.info("Gemini using legacy mode (no system_instruction)")
                else:
                    self._use_system_prompt_in_message = False
                logger.info("Gemini client initialized", model=self.model)
                
            elif self.provider == "openai":
                from openai import AsyncOpenAI
                self._client = AsyncOpenAI(api_key=self.api_key)
                logger.info("OpenAI client initialized", model=self.model)
                
            elif self.provider == "openrouter":
                # OpenRouter uses OpenAI-compatible API with custom base URL
                self._client = "openrouter"  # Flag for httpx usage
                logger.info("OpenRouter client initialized", model=self.model)
                
            elif self.provider == "ollama":
                # For Ollama, we'll use httpx
                self._client = None  # Will use direct HTTP
                logger.info("Ollama mode initialized", model=self.model)
                
        except Exception as e:
            logger.error("Failed to initialize LLM client", 
                        provider=self.provider, 
                        error=str(e))
            self._client = None
    
    async def classify(
        self,
        text: str,
        context: Optional[Dict[str, Any]] = None
    ) -> IntentResult:
        """
        Classify user intent and extract entities.
        
        Args:
            text: User's utterance
            context: Current conversation context
            
        Returns:
            IntentResult with intent, confidence, entities
        """
        logger.info("=" * 60)
        logger.info("INTENT_CLASSIFIER: Classifying input",
                   text_preview=text[:50] if text else None,
                   provider=self.provider,
                   current_workflow=context.get("current_workflow") if context else None)
        
        if not self._client:
            logger.warning("INTENT_CLASSIFIER: LLM client not available, using fallback")
            return self._fallback_classification(text)
        
        try:
            # Format the prompt
            prompt = INTENT_CLASSIFICATION_PROMPT.format(
                context=json.dumps(context or {}, indent=2),
                workflow_state=context.get("current_workflow", "None") if context else "None",
                user_input=text
            )
            
            # Call LLM based on provider
            if self.provider == "gemini":
                response = await self._classify_gemini(prompt)
            elif self.provider == "openai":
                response = await self._classify_openai(prompt)
            elif self.provider == "openrouter":
                response = await self._classify_openrouter(prompt)
            else:
                response = await self._classify_ollama(prompt)
            
            # Parse response
            result = self._parse_llm_response(response)
            
            logger.info("INTENT_CLASSIFIER: Classification complete",
                       intent=result.intent,
                       confidence=result.confidence,
                       entities=list(result.entities.keys()))
            
            return result
            
        except Exception as e:
            logger.error("INTENT_CLASSIFIER: Classification failed", error=str(e))
            return self._fallback_classification(text)
    
    async def _classify_gemini(self, prompt: str) -> str:
        """Classify using Google Gemini."""
        # For legacy mode, prepend system prompt to the message
        if getattr(self, '_use_system_prompt_in_message', False):
            full_prompt = f"{SYSTEM_PROMPT}\n\n{prompt}"
        else:
            full_prompt = prompt
        response = self._client.generate_content(full_prompt)
        return response.text
    
    async def _classify_openai(self, prompt: str) -> str:
        """Classify using OpenAI."""
        response = await self._client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"}
        )
        return response.choices[0].message.content
    
    async def _classify_openrouter(self, prompt: str) -> str:
        """Classify using OpenRouter (OpenAI-compatible API)."""
        import httpx
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "http://localhost:5003",  # Required by OpenRouter
                    "X-Title": "HIS Voice Agent"  # Optional, shows in OpenRouter dashboard
                },
                json={
                    "model": self.model,
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": prompt}
                    ],
                    "response_format": {"type": "json_object"}
                },
                timeout=30.0
            )
            
            if response.status_code != 200:
                error_text = response.text
                logger.error("OpenRouter API error", status=response.status_code, error=error_text)
                raise Exception(f"OpenRouter API error: {response.status_code}")
            
            data = response.json()
            return data["choices"][0]["message"]["content"]
    
    async def _classify_ollama(self, prompt: str) -> str:
        """Classify using Ollama (local LLM)."""
        import httpx
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "http://localhost:11434/api/generate",
                json={
                    "model": self.model,
                    "prompt": f"{SYSTEM_PROMPT}\n\n{prompt}",
                    "stream": False,
                    "format": "json"
                },
                timeout=60.0
            )
            data = response.json()
            return data.get("response", "{}")
    
    def _parse_llm_response(self, response: str) -> IntentResult:
        """
        Parse LLM response to IntentResult.
        
        Args:
            response: Raw LLM response text
            
        Returns:
            Parsed IntentResult
        """
        try:
            # Extract JSON from response (handle markdown code blocks)
            json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', response)
            if json_match:
                json_str = json_match.group(1)
            else:
                json_str = response
            
            # Parse JSON
            data = json.loads(json_str)
            
            return IntentResult(
                intent=data.get("intent", "UNCLEAR"),
                confidence=float(data.get("confidence", 0.5)),
                entities=data.get("entities", {}),
                required_missing_fields=data.get("required_missing_fields", [])
            )
            
        except json.JSONDecodeError as e:
            logger.warning("Failed to parse LLM response as JSON", 
                          error=str(e),
                          response=response[:200])
            return IntentResult(
                intent="UNCLEAR",
                confidence=0.3,
                entities={},
                required_missing_fields=[]
            )
    
    def _fallback_classification(self, text: str) -> IntentResult:
        """
        Rule-based fallback when LLM is unavailable.
        
        Args:
            text: User utterance
            
        Returns:
            Basic IntentResult
        """
        text_lower = text.lower().strip()
        
        # Simple keyword matching
        if any(word in text_lower for word in ["hello", "hi", "good morning", "good afternoon"]):
            return IntentResult(intent="GREETING", confidence=0.8, entities={})
        
        if any(word in text_lower for word in ["bye", "goodbye", "thank you", "thanks"]):
            return IntentResult(intent="GOODBYE", confidence=0.8, entities={})
        
        if any(word in text_lower for word in ["emergency", "urgent", "accident", "heart attack"]):
            return IntentResult(intent="REPORT_EMERGENCY", confidence=0.9, entities={})
        
        # Status queries - check BEFORE booking intents
        if any(word in text_lower for word in ["status", "check my", "where is", "result", "report"]):
            return IntentResult(intent="CHECK_STATUS", confidence=0.7, entities={})
        
        if any(word in text_lower for word in ["appointment", "book", "schedule"]):
            return IntentResult(intent="BOOK_APPOINTMENT", confidence=0.7, entities={})
        
        if any(word in text_lower for word in ["register", "new patient"]):
            return IntentResult(intent="REGISTER_PATIENT", confidence=0.7, entities={})
        
        if any(word in text_lower for word in ["check in", "arrived", "here for"]):
            return IntentResult(intent="OPD_CHECKIN", confidence=0.7, entities={})
        
        if any(word in text_lower for word in ["bed", "room", "admission"]):
            return IntentResult(intent="CHECK_BED_AVAILABILITY", confidence=0.6, entities={})
        
        if any(word in text_lower for word in ["lab", "test", "blood"]) and "result" not in text_lower:
            return IntentResult(intent="BOOK_LAB_TEST", confidence=0.6, entities={})
        
        if any(word in text_lower for word in ["bill", "payment", "owe"]):
            return IntentResult(intent="CHECK_BILL_STATUS", confidence=0.6, entities={})
        
        if any(word in text_lower for word in ["speak to", "human", "person", "transfer"]):
            return IntentResult(intent="ESCALATE_TO_HUMAN", confidence=0.8, entities={})
        
        # Department names - treat as providing information
        departments = ["general medicine", "cardiology", "orthopedics", "ent", "dermatology", 
                       "neurology", "pediatrics", "gynecology", "ophthalmology", "psychiatry",
                       "surgery", "urology", "gastroenterology", "pulmonology", "nephrology"]
        if text_lower in departments or any(dept in text_lower for dept in departments):
            return IntentResult(
                intent="PROVIDE_INFORMATION",
                confidence=0.85,
                entities={"department": text.strip()}
            )
        
        # Common single-word affirmations
        if text_lower in ["yes", "yeah", "yep", "correct", "right", "ok", "okay", "sure"]:
            return IntentResult(intent="CONFIRM_YES", confidence=0.85, entities={})
        
        if text_lower in ["no", "nope", "cancel", "wrong", "incorrect"]:
            return IntentResult(intent="CONFIRM_NO", confidence=0.85, entities={})
        
        # Try to extract phone number - normalize by removing spaces/dashes
        normalized_text = re.sub(r'[\s\-\.]', '', text)  # Remove spaces, dashes, dots
        phone_match = re.search(r'\b(\d{10})\b', normalized_text)
        if phone_match:
            return IntentResult(
                intent="PROVIDE_INFORMATION",
                confidence=0.8,
                entities={"phone": phone_match.group(1)}
            )
        
        # Names (capitalized words that aren't common words)
        common_words = {"i", "a", "the", "is", "my", "for", "to", "and", "or", "in", "on", "at"}
        words = text.split()
        if len(words) <= 3 and all(w[0].isupper() for w in words if w.lower() not in common_words):
            # Likely a name being provided
            return IntentResult(
                intent="PROVIDE_INFORMATION",
                confidence=0.7,
                entities={"name": text.strip()}
            )
        
        # Short responses during conversation likely providing info
        if len(text.split()) <= 3:
            return IntentResult(
                intent="PROVIDE_INFORMATION",
                confidence=0.5,
                entities={"value": text.strip()}
            )
        
        return IntentResult(intent="UNCLEAR", confidence=0.3, entities={})
