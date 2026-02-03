"""
Entity Validators
Validates and normalizes extracted entities from LLM
"""

import re
from typing import Optional, Dict, Any, Tuple
from datetime import datetime, date, timedelta
from enum import Enum
import structlog

logger = structlog.get_logger()


class ValidationResult(Enum):
    VALID = "valid"
    INVALID = "invalid"
    NEEDS_CONFIRMATION = "needs_confirmation"


class EntityValidator:
    """
    Validates and normalizes entities extracted by LLM.
    Ensures data quality before API calls.
    """
    
    # Indian phone number patterns
    PHONE_PATTERNS = [
        r'^[6-9]\d{9}$',           # 10-digit mobile
        r'^0\d{10}$',              # With leading 0
        r'^91\d{10}$',             # With country code
        r'^\+91\d{10}$',           # With +91
    ]
    
    # Date formats to try
    DATE_FORMATS = [
        "%Y-%m-%d",
        "%d-%m-%Y",
        "%d/%m/%Y",
        "%d %b %Y",
        "%d %B %Y",
        "%B %d, %Y",
        "%d-%m-%y",
        "%d/%m/%y",
    ]
    
    # Valid genders
    VALID_GENDERS = ["male", "female", "other", "m", "f", "o"]
    
    # Department name mappings (fuzzy)
    DEPARTMENT_ALIASES = {
        "heart": "Cardiology",
        "cardio": "Cardiology",
        "cardiac": "Cardiology",
        "ortho": "Orthopedics",
        "bone": "Orthopedics",
        "bones": "Orthopedics",
        "fracture": "Orthopedics",
        "general": "General Medicine",
        "medicine": "General Medicine",
        "fever": "General Medicine",
        "cold": "General Medicine",
        "ent": "ENT",
        "ear": "ENT",
        "nose": "ENT",
        "throat": "ENT",
        "eye": "Ophthalmology",
        "eyes": "Ophthalmology",
        "skin": "Dermatology",
        "derma": "Dermatology",
        "neuro": "Neurology",
        "brain": "Neurology",
        "nerve": "Neurology",
        "child": "Pediatrics",
        "children": "Pediatrics",
        "kids": "Pediatrics",
        "baby": "Pediatrics",
        "gynec": "Gynecology",
        "women": "Gynecology",
        "pregnancy": "Gynecology",
        "dental": "Dentistry",
        "teeth": "Dentistry",
        "tooth": "Dentistry",
    }
    
    @classmethod
    def validate_phone(cls, phone: str) -> Tuple[ValidationResult, Optional[str], Optional[str]]:
        """
        Validate and normalize phone number.
        
        Returns:
            (ValidationResult, normalized_value, error_message)
        """
        if not phone:
            return ValidationResult.INVALID, None, "Phone number is required"
        
        # Remove spaces, dashes, parentheses
        cleaned = re.sub(r'[\s\-\(\)\+]', '', str(phone))
        
        # Check patterns
        for pattern in cls.PHONE_PATTERNS:
            if re.match(pattern, cleaned):
                # Normalize to 10 digits
                if len(cleaned) == 12 and cleaned.startswith('91'):
                    normalized = cleaned[2:]
                elif len(cleaned) == 11 and cleaned.startswith('0'):
                    normalized = cleaned[1:]
                elif len(cleaned) == 10:
                    normalized = cleaned
                else:
                    continue
                
                return ValidationResult.VALID, normalized, None
        
        return ValidationResult.INVALID, None, "Please provide a valid 10-digit mobile number"
    
    @classmethod
    def validate_date(
        cls,
        date_str: str,
        allow_past: bool = True,
        max_future_days: int = 90
    ) -> Tuple[ValidationResult, Optional[str], Optional[str]]:
        """
        Validate and normalize date.
        
        Returns:
            (ValidationResult, normalized_ISO_date, error_message)
        """
        if not date_str:
            return ValidationResult.INVALID, None, "Date is required"
        
        date_str = str(date_str).strip().lower()
        today = date.today()
        
        # Handle relative dates
        relative_dates = {
            "today": today,
            "tomorrow": today + timedelta(days=1),
            "day after tomorrow": today + timedelta(days=2),
            "next week": today + timedelta(days=7),
        }
        
        for keyword, target_date in relative_dates.items():
            if keyword in date_str:
                return ValidationResult.VALID, target_date.isoformat(), None
        
        # Handle day names
        day_names = {
            "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
            "friday": 4, "saturday": 5, "sunday": 6
        }
        
        for day_name, day_num in day_names.items():
            if day_name in date_str:
                days_ahead = day_num - today.weekday()
                if days_ahead <= 0:
                    days_ahead += 7
                target_date = today + timedelta(days=days_ahead)
                return ValidationResult.VALID, target_date.isoformat(), None
        
        # Try parsing with various formats
        for fmt in cls.DATE_FORMATS:
            try:
                parsed = datetime.strptime(date_str, fmt).date()
                
                # Validate date range
                if not allow_past and parsed < today:
                    return ValidationResult.INVALID, None, "Date cannot be in the past"
                
                if max_future_days and (parsed - today).days > max_future_days:
                    return ValidationResult.INVALID, None, f"Date cannot be more than {max_future_days} days in the future"
                
                return ValidationResult.VALID, parsed.isoformat(), None
                
            except ValueError:
                continue
        
        return ValidationResult.INVALID, None, "Could not understand the date. Please say it as day, month, year"
    
    @classmethod
    def validate_gender(cls, gender: str) -> Tuple[ValidationResult, Optional[str], Optional[str]]:
        """Validate and normalize gender."""
        if not gender:
            return ValidationResult.INVALID, None, "Gender is required"
        
        gender_lower = str(gender).strip().lower()
        
        if gender_lower in ["male", "m", "man", "boy"]:
            return ValidationResult.VALID, "Male", None
        elif gender_lower in ["female", "f", "woman", "girl"]:
            return ValidationResult.VALID, "Female", None
        elif gender_lower in ["other", "o"]:
            return ValidationResult.VALID, "Other", None
        
        return ValidationResult.INVALID, None, "Please specify Male, Female, or Other"
    
    @classmethod
    def validate_name(cls, name: str) -> Tuple[ValidationResult, Optional[str], Optional[str]]:
        """Validate name (first or last)."""
        if not name:
            return ValidationResult.INVALID, None, "Name is required"
        
        # Remove extra spaces, capitalize
        cleaned = ' '.join(str(name).strip().split()).title()
        
        # Check minimum length
        if len(cleaned) < 2:
            return ValidationResult.INVALID, None, "Name seems too short"
        
        # Check for invalid characters
        if not re.match(r'^[A-Za-z\s\.\-\']+$', cleaned):
            return ValidationResult.NEEDS_CONFIRMATION, cleaned, "Name contains unusual characters. Is this correct?"
        
        return ValidationResult.VALID, cleaned, None
    
    @classmethod
    def validate_department(cls, department: str) -> Tuple[ValidationResult, Optional[str], Optional[str]]:
        """Validate and normalize department name."""
        if not department:
            return ValidationResult.INVALID, None, "Department is required"
        
        dept_lower = str(department).strip().lower()
        
        # Check aliases
        for alias, standard_name in cls.DEPARTMENT_ALIASES.items():
            if alias in dept_lower:
                return ValidationResult.VALID, standard_name, None
        
        # Check if it's already a valid department name
        standard_departments = [
            "General Medicine", "Cardiology", "Orthopedics", "ENT",
            "Ophthalmology", "Dermatology", "Neurology", "Pediatrics",
            "Gynecology", "Dentistry", "Psychiatry", "Urology"
        ]
        
        for dept in standard_departments:
            if dept.lower() in dept_lower or dept_lower in dept.lower():
                return ValidationResult.VALID, dept, None
        
        # Unknown department - needs confirmation
        return ValidationResult.NEEDS_CONFIRMATION, department.title(), f"'{department}' is not a recognized department. Did you mean one of our standard departments?"
    
    @classmethod
    def validate_patient_id(cls, patient_id: str) -> Tuple[ValidationResult, Optional[str], Optional[str]]:
        """Validate patient ID format."""
        if not patient_id:
            return ValidationResult.INVALID, None, "Patient ID is required"
        
        cleaned = str(patient_id).strip().upper()
        
        # Check common HIS ID formats
        patterns = [
            r'^HIS-\d{4}-\d{3,6}$',     # HIS-2024-001
            r'^P\d{6,10}$',              # P123456
            r'^[A-Z]{2,4}\d{6,10}$',     # UHID format
        ]
        
        for pattern in patterns:
            if re.match(pattern, cleaned):
                return ValidationResult.VALID, cleaned, None
        
        # Allow numeric-only IDs
        if cleaned.isdigit() and 4 <= len(cleaned) <= 12:
            return ValidationResult.VALID, cleaned, None
        
        return ValidationResult.NEEDS_CONFIRMATION, cleaned, "This doesn't look like a standard patient ID. Could you verify?"
    
    @classmethod
    def validate_all(cls, entities: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
        """
        Validate all entities in a dictionary.
        
        Returns:
            Dict mapping entity names to {result, normalized_value, error}
        """
        validators = {
            "phone": cls.validate_phone,
            "date_of_birth": lambda x: cls.validate_date(x, allow_past=True, max_future_days=0),
            "preferred_date": lambda x: cls.validate_date(x, allow_past=False, max_future_days=90),
            "gender": cls.validate_gender,
            "first_name": cls.validate_name,
            "last_name": cls.validate_name,
            "department": cls.validate_department,
            "patient_id": cls.validate_patient_id,
        }
        
        results = {}
        for key, value in entities.items():
            if key in validators and value:
                result, normalized, error = validators[key](value)
                results[key] = {
                    "result": result,
                    "original": value,
                    "normalized": normalized,
                    "error": error
                }
        
        return results
