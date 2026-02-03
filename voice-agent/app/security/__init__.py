"""
Security Module
Implements security, compliance, and audit functionality
"""

import hashlib
import hmac
import time
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
import structlog
import json
from enum import Enum
import secrets

logger = structlog.get_logger()


class AuditEventType(Enum):
    """Types of audit events."""
    SESSION_START = "session_start"
    SESSION_END = "session_end"
    INTENT_CLASSIFIED = "intent_classified"
    API_CALL = "api_call"
    PATIENT_LOOKUP = "patient_lookup"
    PATIENT_CREATE = "patient_create"
    APPOINTMENT_BOOK = "appointment_book"
    EMERGENCY_REPORTED = "emergency_reported"
    HUMAN_ESCALATION = "human_escalation"
    AUTH_FAILURE = "auth_failure"
    SENSITIVE_DATA_DETECTED = "sensitive_data_detected"


class VoiceDataPolicy:
    """
    Enforces voice data retention policies.
    Ensures no voice audio is stored permanently.
    """
    
    # Maximum time voice data can exist in memory (seconds)
    MAX_VOICE_RETENTION_SECONDS = 30
    
    # Audio data is never written to disk
    ALLOW_DISK_STORAGE = False
    
    @classmethod
    def validate_retention(cls, created_at: datetime) -> bool:
        """Check if voice data has exceeded retention period."""
        age = (datetime.now() - created_at).total_seconds()
        return age <= cls.MAX_VOICE_RETENTION_SECONDS
    
    @classmethod
    def scrub_audio_from_request(cls, request_data: Dict) -> Dict:
        """Remove audio data from request before logging."""
        scrubbed = request_data.copy()
        
        audio_fields = ['audio_base64', 'audio', 'voice_data', 'audio_content']
        for field in audio_fields:
            if field in scrubbed:
                scrubbed[field] = "[AUDIO_SCRUBBED]"
        
        return scrubbed
    
    @classmethod
    def verify_no_persistence(cls, data: Any) -> bool:
        """Verify data structure doesn't contain persistent audio."""
        if isinstance(data, dict):
            for key, value in data.items():
                if 'audio' in key.lower() and isinstance(value, str) and len(value) > 1000:
                    logger.warning("Large audio-like data detected in persistent storage check")
                    return False
                if not cls.verify_no_persistence(value):
                    return False
        elif isinstance(data, list):
            for item in data:
                if not cls.verify_no_persistence(item):
                    return False
        return True


class TranscriptEncryption:
    """
    Handles encryption of conversation transcripts.
    Uses AES-256-GCM for encryption.
    """
    
    def __init__(self, encryption_key: Optional[str] = None):
        """
        Initialize encryption.
        
        Args:
            encryption_key: Base64-encoded 32-byte key. If None, generates new key.
        """
        if encryption_key:
            import base64
            self.key = base64.b64decode(encryption_key)
        else:
            self.key = secrets.token_bytes(32)
        
        self._cipher_available = self._check_crypto_available()
    
    def _check_crypto_available(self) -> bool:
        """Check if cryptography library is available."""
        try:
            from cryptography.hazmat.primitives.ciphers.aead import AESGCM
            return True
        except ImportError:
            logger.warning("Cryptography library not available, using fallback")
            return False
    
    def encrypt(self, plaintext: str) -> Dict[str, str]:
        """
        Encrypt transcript text.
        
        Returns:
            Dict with 'ciphertext' and 'nonce' (both base64)
        """
        import base64
        
        if not self._cipher_available:
            # Fallback: simple obfuscation (NOT secure - for demo only)
            obfuscated = base64.b64encode(plaintext.encode()).decode()
            return {"ciphertext": obfuscated, "nonce": "", "method": "base64_fallback"}
        
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        
        nonce = secrets.token_bytes(12)
        aesgcm = AESGCM(self.key)
        ciphertext = aesgcm.encrypt(nonce, plaintext.encode(), None)
        
        return {
            "ciphertext": base64.b64encode(ciphertext).decode(),
            "nonce": base64.b64encode(nonce).decode(),
            "method": "AES-256-GCM"
        }
    
    def decrypt(self, encrypted_data: Dict[str, str]) -> str:
        """
        Decrypt transcript.
        
        Args:
            encrypted_data: Dict with 'ciphertext' and 'nonce'
            
        Returns:
            Decrypted plaintext
        """
        import base64
        
        method = encrypted_data.get("method", "")
        
        if method == "base64_fallback":
            return base64.b64decode(encrypted_data["ciphertext"]).decode()
        
        if not self._cipher_available:
            raise RuntimeError("Cryptography library required for decryption")
        
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        
        ciphertext = base64.b64decode(encrypted_data["ciphertext"])
        nonce = base64.b64decode(encrypted_data["nonce"])
        
        aesgcm = AESGCM(self.key)
        plaintext = aesgcm.decrypt(nonce, ciphertext, None)
        
        return plaintext.decode()


class AuditLogger:
    """
    Maintains audit trail of all actions.
    Logs are structured and can be shipped to SIEM.
    """
    
    def __init__(self, 
                 encryption: Optional[TranscriptEncryption] = None,
                 log_file: Optional[str] = None):
        """
        Initialize audit logger.
        
        Args:
            encryption: Optional encryption for sensitive logs
            log_file: Optional file path for audit log
        """
        self.encryption = encryption
        self.log_file = log_file
        self._logs: List[Dict] = []  # In-memory buffer
    
    def log(self,
            event_type: AuditEventType,
            session_id: str,
            details: Dict[str, Any],
            user_id: Optional[str] = None,
            sensitive: bool = False) -> str:
        """
        Log an audit event.
        
        Args:
            event_type: Type of event
            session_id: Session identifier
            details: Event details
            user_id: Optional user/patient identifier
            sensitive: Whether to encrypt the log
            
        Returns:
            Audit log entry ID
        """
        entry_id = f"audit_{int(time.time() * 1000)}_{secrets.token_hex(4)}"
        
        entry = {
            "id": entry_id,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "event_type": event_type.value,
            "session_id": session_id,
            "user_id": user_id,
            "details": details,
        }
        
        # Encrypt sensitive details if needed
        if sensitive and self.encryption:
            entry["details"] = self.encryption.encrypt(json.dumps(details))
            entry["encrypted"] = True
        
        # Add to in-memory buffer
        self._logs.append(entry)
        
        # Log via structlog
        logger.info("audit_event",
                   entry_id=entry_id,
                   event_type=event_type.value,
                   session_id=session_id)
        
        # Write to file if configured
        if self.log_file:
            self._write_to_file(entry)
        
        return entry_id
    
    def _write_to_file(self, entry: Dict):
        """Append entry to audit log file."""
        try:
            with open(self.log_file, 'a') as f:
                f.write(json.dumps(entry) + '\n')
        except Exception as e:
            logger.error("Failed to write audit log", error=str(e))
    
    def get_session_audit(self, session_id: str) -> List[Dict]:
        """Get all audit entries for a session."""
        return [e for e in self._logs if e["session_id"] == session_id]
    
    def log_session_start(self, session_id: str, caller_id: str, channel: str):
        """Log session start."""
        return self.log(
            AuditEventType.SESSION_START,
            session_id,
            {"caller_id": caller_id, "channel": channel}
        )
    
    def log_session_end(self, session_id: str, reason: str = "normal"):
        """Log session end."""
        return self.log(
            AuditEventType.SESSION_END,
            session_id,
            {"reason": reason}
        )
    
    def log_intent(self, session_id: str, intent: str, confidence: float):
        """Log intent classification."""
        return self.log(
            AuditEventType.INTENT_CLASSIFIED,
            session_id,
            {"intent": intent, "confidence": confidence}
        )
    
    def log_api_call(self, session_id: str, method: str, endpoint: str, 
                     success: bool, status_code: int = 0):
        """Log HIS API call."""
        return self.log(
            AuditEventType.API_CALL,
            session_id,
            {
                "method": method,
                "endpoint": endpoint,
                "success": success,
                "status_code": status_code
            }
        )
    
    def log_patient_lookup(self, session_id: str, search_criteria: Dict,
                          found: bool, patient_count: int = 0):
        """Log patient lookup (sensitive)."""
        return self.log(
            AuditEventType.PATIENT_LOOKUP,
            session_id,
            {
                "search_type": list(search_criteria.keys()),
                "found": found,
                "count": patient_count
            },
            sensitive=True
        )
    
    def log_emergency(self, session_id: str, emergency_type: str):
        """Log emergency report."""
        return self.log(
            AuditEventType.EMERGENCY_REPORTED,
            session_id,
            {"emergency_type": emergency_type}
        )
    
    def log_sensitive_data(self, session_id: str, data_types: List[str]):
        """Log detection of sensitive data (for compliance)."""
        return self.log(
            AuditEventType.SENSITIVE_DATA_DETECTED,
            session_id,
            {"data_types": data_types, "action": "masked"}
        )


class RBACEnforcer:
    """
    Enforces Role-Based Access Control.
    Ensures voice agent only accesses permitted endpoints.
    """
    
    # Receptionist role permissions (from HIS RBAC)
    RECEPTIONIST_PERMISSIONS = {
        "patients": ["create", "read", "update", "search"],
        "appointments": ["create", "read", "update", "cancel", "checkin"],
        "opd": ["read", "checkin"],
        "beds": ["read", "allocate"],
        "emergency": ["create", "read"],
        "departments": ["read"],
        "billing": ["read"],
        "lab": ["read"],  # Cannot create lab orders (needs doctor)
    }
    
    # Endpoints the voice agent is allowed to call
    ALLOWED_ENDPOINTS = [
        "POST /auth/login",
        "GET /patients/*",
        "POST /patients",
        "PUT /patients/*",
        "GET /departments",
        "GET /departments/*",
        "POST /opd/appointments",
        "GET /opd/appointments/*",
        "PUT /opd/appointments/*",
        "PUT /opd/appointments/*/checkin",
        "DELETE /opd/appointments/*",
        "GET /opd/queue",
        "GET /beds",
        "GET /beds/availability",
        "POST /beds/allocate",
        "POST /emergency/cases",
        "GET /emergency/cases/*",
        "GET /lab/tests",
        "GET /lab/orders/*",
        "GET /billing/patients/*",
    ]
    
    # Explicitly denied endpoints
    DENIED_ENDPOINTS = [
        "DELETE /patients/*",        # Can't delete patients
        "POST /lab/orders",          # Can't create lab orders
        "PUT /lab/orders/*",         # Can't modify lab orders
        "POST /users",               # Can't create users
        "PUT /users/*",              # Can't modify users
        "DELETE /*",                  # All deletes except appointments
    ]
    
    @classmethod
    def is_allowed(cls, method: str, endpoint: str) -> bool:
        """
        Check if endpoint access is allowed.
        
        Args:
            method: HTTP method (GET, POST, etc.)
            endpoint: API endpoint path
        """
        full_endpoint = f"{method} {endpoint}"
        
        # Check explicit denies first
        for denied in cls.DENIED_ENDPOINTS:
            if cls._matches_pattern(full_endpoint, denied):
                logger.warning("Endpoint access denied", 
                             method=method, 
                             endpoint=endpoint)
                return False
        
        # Check allows
        for allowed in cls.ALLOWED_ENDPOINTS:
            if cls._matches_pattern(full_endpoint, allowed):
                return True
        
        # Default deny
        logger.warning("Endpoint not in allowlist", 
                      method=method, 
                      endpoint=endpoint)
        return False
    
    @classmethod
    def _matches_pattern(cls, endpoint: str, pattern: str) -> bool:
        """Check if endpoint matches pattern (with wildcards)."""
        import fnmatch
        return fnmatch.fnmatch(endpoint, pattern)


# Global audit logger instance
audit_logger = AuditLogger()


def get_audit_logger() -> AuditLogger:
    """Get the global audit logger."""
    return audit_logger


def create_secure_audit_logger(encryption_key: str, log_file: str) -> AuditLogger:
    """Create a secure audit logger with encryption."""
    encryption = TranscriptEncryption(encryption_key)
    return AuditLogger(encryption=encryption, log_file=log_file)
