"""
Safety Guardrails
Confidence thresholds, content filters, and safety checks
"""

from typing import Dict, Any, Optional, List, Tuple
from enum import Enum
import structlog
import re

logger = structlog.get_logger()


class ConfidenceLevel(Enum):
    """Confidence level categories."""
    HIGH = "high"           # >= 0.85 - proceed automatically
    MEDIUM = "medium"       # >= 0.65 - proceed with confirmation
    LOW = "low"             # >= 0.40 - ask for clarification
    VERY_LOW = "very_low"   # < 0.40 - ask to repeat


class SafetyAction(Enum):
    """Actions to take based on safety checks."""
    ALLOW = "allow"
    CONFIRM = "confirm"
    CLARIFY = "clarify"
    ESCALATE = "escalate"
    BLOCK = "block"


# Confidence thresholds
CONFIDENCE_THRESHOLDS = {
    ConfidenceLevel.HIGH: 0.85,
    ConfidenceLevel.MEDIUM: 0.65,
    ConfidenceLevel.LOW: 0.40,
}

# Intent-specific thresholds (some intents need higher confidence)
INTENT_CONFIDENCE_OVERRIDES = {
    "REGISTER_PATIENT": 0.80,      # Creating records - be more certain
    "BOOK_APPOINTMENT": 0.75,      # Booking - confirm if unsure
    "REPORT_EMERGENCY": 0.50,      # Emergencies - low threshold, better safe
    "REQUEST_BED_ALLOCATION": 0.80,
    "CANCEL_APPOINTMENT": 0.85,    # Destructive action - high confidence
}


class SafetyGuardrails:
    """
    Implements safety checks and confidence-based decision making.
    """
    
    # Keywords that suggest emergency/escalation
    EMERGENCY_KEYWORDS = [
        "emergency", "urgent", "accident", "heart attack", "stroke",
        "bleeding", "unconscious", "chest pain", "breathing problem",
        "seizure", "collapse", "dying", "critical", "ambulance"
    ]
    
    # Keywords that suggest user wants human
    HUMAN_ESCALATION_KEYWORDS = [
        "human", "person", "real person", "speak to someone",
        "transfer", "operator", "receptionist", "manager",
        "not working", "useless", "stupid bot", "talk to human"
    ]
    
    # Sensitive information patterns to detect (not store)
    SENSITIVE_PATTERNS = {
        "aadhaar": r'\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b',
        "credit_card": r'\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b',
        "cvv": r'\bCVV[\s:]?\d{3,4}\b',
        "password": r'\b(password|pwd|pin)[\s:]+\S+',
    }
    
    # Maximum allowed turns before suggesting human
    MAX_TURNS_BEFORE_ESCALATION = 15
    
    # Maximum failed attempts on same intent
    MAX_INTENT_FAILURES = 3
    
    @classmethod
    def get_confidence_level(cls, confidence: float) -> ConfidenceLevel:
        """Categorize confidence score into levels."""
        if confidence >= CONFIDENCE_THRESHOLDS[ConfidenceLevel.HIGH]:
            return ConfidenceLevel.HIGH
        elif confidence >= CONFIDENCE_THRESHOLDS[ConfidenceLevel.MEDIUM]:
            return ConfidenceLevel.MEDIUM
        elif confidence >= CONFIDENCE_THRESHOLDS[ConfidenceLevel.LOW]:
            return ConfidenceLevel.LOW
        else:
            return ConfidenceLevel.VERY_LOW
    
    @classmethod
    def check_intent_confidence(
        cls,
        intent: str,
        confidence: float,
        context: Dict[str, Any]
    ) -> Tuple[SafetyAction, str]:
        """
        Check if confidence is sufficient for the intent.
        
        Returns:
            (action, message)
        """
        # Get intent-specific threshold or default
        threshold = INTENT_CONFIDENCE_OVERRIDES.get(
            intent,
            CONFIDENCE_THRESHOLDS[ConfidenceLevel.MEDIUM]
        )
        
        level = cls.get_confidence_level(confidence)
        
        if level == ConfidenceLevel.HIGH:
            return SafetyAction.ALLOW, ""
        
        elif level == ConfidenceLevel.MEDIUM:
            if confidence >= threshold:
                return SafetyAction.ALLOW, ""
            else:
                return SafetyAction.CONFIRM, "Just to confirm, did you want to " + cls._intent_to_action(intent) + "?"
        
        elif level == ConfidenceLevel.LOW:
            return SafetyAction.CLARIFY, "I'm not quite sure I understood. Could you please tell me again what you'd like to do?"
        
        else:  # VERY_LOW
            return SafetyAction.CLARIFY, "I'm sorry, I didn't catch that. Could you please repeat?"
    
    @classmethod
    def _intent_to_action(cls, intent: str) -> str:
        """Convert intent to human-readable action."""
        intent_actions = {
            "REGISTER_PATIENT": "register as a new patient",
            "FIND_PATIENT": "look up your patient record",
            "BOOK_APPOINTMENT": "book an appointment",
            "RESCHEDULE_APPOINTMENT": "reschedule your appointment",
            "CANCEL_APPOINTMENT": "cancel your appointment",
            "OPD_CHECKIN": "check in for your appointment",
            "CHECK_BED_AVAILABILITY": "check bed availability",
            "REQUEST_BED_ALLOCATION": "request a bed",
            "BOOK_LAB_TEST": "book a lab test",
            "CHECK_LAB_STATUS": "check your lab results",
            "CHECK_BILL_STATUS": "check your bill status",
        }
        return intent_actions.get(intent, "proceed with that")
    
    @classmethod
    def check_for_emergency(cls, text: str) -> Tuple[bool, Optional[str]]:
        """
        Check if text contains emergency indicators.
        
        Returns:
            (is_emergency, emergency_type)
        """
        text_lower = text.lower()
        
        for keyword in cls.EMERGENCY_KEYWORDS:
            if keyword in text_lower:
                logger.warning("Emergency detected", keyword=keyword)
                return True, keyword
        
        return False, None
    
    @classmethod
    def check_for_human_escalation(cls, text: str) -> bool:
        """Check if user wants to talk to a human."""
        text_lower = text.lower()
        
        for keyword in cls.HUMAN_ESCALATION_KEYWORDS:
            if keyword in text_lower:
                logger.info("Human escalation requested", keyword=keyword)
                return True
        
        return False
    
    @classmethod
    def check_sensitive_data(cls, text: str) -> List[str]:
        """
        Check for sensitive data that shouldn't be logged.
        
        Returns:
            List of sensitive data types detected
        """
        detected = []
        
        for data_type, pattern in cls.SENSITIVE_PATTERNS.items():
            if re.search(pattern, text, re.IGNORECASE):
                detected.append(data_type)
                logger.warning("Sensitive data detected", type=data_type)
        
        return detected
    
    @classmethod
    def mask_sensitive_data(cls, text: str) -> str:
        """Mask sensitive data in text for logging."""
        masked = text
        
        # Mask Aadhaar
        masked = re.sub(r'\b(\d{4})[\s-]?(\d{4})[\s-]?(\d{4})\b', r'XXXX-XXXX-\3', masked)
        
        # Mask phone (keep last 4)
        masked = re.sub(r'\b(\d{6})(\d{4})\b', r'XXXXXX\2', masked)
        
        # Mask credit cards
        masked = re.sub(r'\b(\d{4})[\s-]?(\d{4})[\s-]?(\d{4})[\s-]?(\d{4})\b', r'XXXX-XXXX-XXXX-\4', masked)
        
        return masked
    
    @classmethod
    def should_escalate(cls, context: Dict[str, Any]) -> Tuple[bool, str]:
        """
        Check if conversation should be escalated to human.
        
        Returns:
            (should_escalate, reason)
        """
        turn_count = context.get("turn_count", 0)
        failed_intents = context.get("failed_intents", 0)
        
        # Too many turns
        if turn_count >= cls.MAX_TURNS_BEFORE_ESCALATION:
            return True, "long_conversation"
        
        # Too many failures
        if failed_intents >= cls.MAX_INTENT_FAILURES:
            return True, "repeated_failures"
        
        return False, ""
    
    @classmethod
    def validate_before_action(
        cls,
        intent: str,
        entities: Dict[str, Any],
        context: Dict[str, Any]
    ) -> Tuple[SafetyAction, Optional[str]]:
        """
        Final safety check before executing an action.
        
        Returns:
            (action, message)
        """
        # Check for dangerous combinations
        if intent == "CANCEL_APPOINTMENT":
            if not entities.get("appointment_id") and not entities.get("confirmed"):
                return SafetyAction.CONFIRM, "I want to make sure I cancel the right appointment. Could you confirm the appointment details?"
        
        if intent == "REGISTER_PATIENT":
            # Make sure we have minimum required fields
            required = ["first_name", "last_name", "phone"]
            missing = [f for f in required if not entities.get(f)]
            if missing and context.get("confirmed"):
                return SafetyAction.CLARIFY, f"I still need your {', '.join(missing)} to complete registration."
        
        return SafetyAction.ALLOW, None
    
    @classmethod
    def get_safe_response(
        cls,
        intent: str,
        confidence: float,
        raw_text: str,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Central safety check returning action and any modifications needed.
        """
        result = {
            "action": SafetyAction.ALLOW,
            "message": None,
            "intent_override": None,
            "log_text": cls.mask_sensitive_data(raw_text)
        }
        
        # Check for emergency first (overrides everything)
        is_emergency, emergency_type = cls.check_for_emergency(raw_text)
        if is_emergency:
            result["action"] = SafetyAction.ESCALATE
            result["intent_override"] = "REPORT_EMERGENCY"
            result["message"] = None  # Let emergency workflow handle it
            return result
        
        # Check for human escalation
        if cls.check_for_human_escalation(raw_text):
            result["action"] = SafetyAction.ESCALATE
            result["intent_override"] = "ESCALATE_TO_HUMAN"
            return result
        
        # Check confidence
        action, message = cls.check_intent_confidence(intent, confidence, context)
        if action != SafetyAction.ALLOW:
            result["action"] = action
            result["message"] = message
            return result
        
        # Check for auto-escalation
        should_escalate, reason = cls.should_escalate(context)
        if should_escalate:
            result["action"] = SafetyAction.ESCALATE
            result["message"] = "I've been trying to help but it seems complex. Let me connect you with a human receptionist who can assist you better."
            return result
        
        return result
