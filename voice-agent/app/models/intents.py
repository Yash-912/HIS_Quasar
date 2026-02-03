"""
Intent Definitions for Voice Agent
Maps to hospital receptionist workflows
"""

from enum import Enum
from typing import List, Dict
from pydantic import BaseModel


class Intent(str, Enum):
    """All supported voice agent intents."""
    
    # Greetings & General
    GREETING = "GREETING"
    GOODBYE = "GOODBYE"
    HELP = "HELP"
    UNCLEAR = "UNCLEAR"
    
    # Patient Management
    REGISTER_PATIENT = "REGISTER_PATIENT"
    FIND_PATIENT = "FIND_PATIENT"
    UPDATE_PATIENT = "UPDATE_PATIENT"
    
    # Appointments
    BOOK_APPOINTMENT = "BOOK_APPOINTMENT"
    RESCHEDULE_APPOINTMENT = "RESCHEDULE_APPOINTMENT"
    CANCEL_APPOINTMENT = "CANCEL_APPOINTMENT"
    CHECK_APPOINTMENT_STATUS = "CHECK_APPOINTMENT_STATUS"
    
    # OPD
    OPD_CHECKIN = "OPD_CHECKIN"
    OPD_QUEUE_STATUS = "OPD_QUEUE_STATUS"
    
    # IPD / Bed
    REQUEST_ADMISSION = "REQUEST_ADMISSION"
    CHECK_BED_AVAILABILITY = "CHECK_BED_AVAILABILITY"
    REQUEST_BED_ALLOCATION = "REQUEST_BED_ALLOCATION"
    
    # Lab
    BOOK_LAB_TEST = "BOOK_LAB_TEST"
    CHECK_LAB_STATUS = "CHECK_LAB_STATUS"
    
    # Status Inquiries
    CHECK_BILL_STATUS = "CHECK_BILL_STATUS"
    GENERAL_STATUS_INQUIRY = "GENERAL_STATUS_INQUIRY"
    
    # Emergency & Escalation
    REPORT_EMERGENCY = "REPORT_EMERGENCY"
    ESCALATE_TO_HUMAN = "ESCALATE_TO_HUMAN"
    
    # Confirmation flows
    CONFIRM_YES = "CONFIRM_YES"
    CONFIRM_NO = "CONFIRM_NO"
    PROVIDE_INFORMATION = "PROVIDE_INFORMATION"


class IntentConfig(BaseModel):
    """Configuration for an intent."""
    intent: Intent
    required_entities: List[str]
    optional_entities: List[str]
    follow_up_prompts: Dict[str, str]
    sample_utterances: List[str]


# Intent configurations with required/optional entities
INTENT_CONFIGS: Dict[Intent, IntentConfig] = {
    Intent.REGISTER_PATIENT: IntentConfig(
        intent=Intent.REGISTER_PATIENT,
        required_entities=["first_name", "last_name", "phone", "date_of_birth", "gender"],
        optional_entities=["email", "address", "emergency_contact", "blood_group"],
        follow_up_prompts={
            "first_name": "What is the patient's first name?",
            "last_name": "And the last name?",
            "phone": "What is the phone number?",
            "date_of_birth": "What is the date of birth?",
            "gender": "What is the gender - Male, Female, or Other?",
        },
        sample_utterances=[
            "I want to register as a new patient",
            "Register me please",
            "I'm new here, need to register",
            "Create a new patient record",
        ]
    ),
    
    Intent.BOOK_APPOINTMENT: IntentConfig(
        intent=Intent.BOOK_APPOINTMENT,
        required_entities=["patient_identifier", "department"],
        optional_entities=["doctor_name", "preferred_date", "preferred_time", "chief_complaint"],
        follow_up_prompts={
            "patient_identifier": "Please provide your patient ID or registered phone number.",
            "department": "Which department would you like to visit? For example, Cardiology, Orthopedics, General Medicine.",
            "preferred_date": "When would you like to schedule the appointment?",
        },
        sample_utterances=[
            "I need to book an appointment",
            "Schedule an appointment with a cardiologist",
            "I want to see a doctor tomorrow",
            "Book me for orthopedics",
        ]
    ),
    
    Intent.OPD_CHECKIN: IntentConfig(
        intent=Intent.OPD_CHECKIN,
        required_entities=["patient_identifier"],
        optional_entities=["appointment_number"],
        follow_up_prompts={
            "patient_identifier": "Please provide your patient ID or registered phone number to check in.",
        },
        sample_utterances=[
            "I'm here for my appointment",
            "I want to check in",
            "I've arrived for my OPD visit",
        ]
    ),
    
    Intent.CHECK_BED_AVAILABILITY: IntentConfig(
        intent=Intent.CHECK_BED_AVAILABILITY,
        required_entities=[],
        optional_entities=["ward_type", "bed_type"],
        follow_up_prompts={},
        sample_utterances=[
            "Are there any beds available?",
            "Check bed availability",
            "Do you have ICU beds?",
            "Is there a private room available?",
        ]
    ),
    
    Intent.REQUEST_BED_ALLOCATION: IntentConfig(
        intent=Intent.REQUEST_BED_ALLOCATION,
        required_entities=["patient_identifier"],
        optional_entities=["ward_type", "bed_type"],
        follow_up_prompts={
            "patient_identifier": "Please provide the patient ID for bed allocation.",
        },
        sample_utterances=[
            "I need a bed for admission",
            "Allocate a bed please",
            "We need a room for the patient",
        ]
    ),
    
    Intent.BOOK_LAB_TEST: IntentConfig(
        intent=Intent.BOOK_LAB_TEST,
        required_entities=["patient_identifier"],
        optional_entities=["test_name"],
        follow_up_prompts={
            "patient_identifier": "Please provide your patient ID or phone number.",
            "test_name": "Which lab test would you like to book?",
        },
        sample_utterances=[
            "I need to book a blood test",
            "Schedule a lab test",
            "I want to get my CBC done",
        ]
    ),
    
    Intent.CHECK_LAB_STATUS: IntentConfig(
        intent=Intent.CHECK_LAB_STATUS,
        required_entities=["patient_identifier"],
        optional_entities=[],
        follow_up_prompts={
            "patient_identifier": "Please provide your patient ID or phone number to check lab status.",
        },
        sample_utterances=[
            "What's the status of my lab test?",
            "Are my reports ready?",
            "Check my lab results",
        ]
    ),
    
    Intent.CHECK_BILL_STATUS: IntentConfig(
        intent=Intent.CHECK_BILL_STATUS,
        required_entities=["patient_identifier"],
        optional_entities=["bill_number"],
        follow_up_prompts={
            "patient_identifier": "Please provide your patient ID or phone number.",
        },
        sample_utterances=[
            "What's my bill amount?",
            "Check my pending bills",
            "How much do I owe?",
        ]
    ),
    
    Intent.ESCALATE_TO_HUMAN: IntentConfig(
        intent=Intent.ESCALATE_TO_HUMAN,
        required_entities=[],
        optional_entities=["reason"],
        follow_up_prompts={},
        sample_utterances=[
            "I want to speak to a person",
            "Connect me to the reception",
            "Transfer to human",
            "I need to talk to someone",
        ]
    ),
    
    Intent.REPORT_EMERGENCY: IntentConfig(
        intent=Intent.REPORT_EMERGENCY,
        required_entities=[],
        optional_entities=["emergency_type", "patient_name"],
        follow_up_prompts={},
        sample_utterances=[
            "This is an emergency",
            "I need emergency help",
            "Someone is having a heart attack",
            "There's been an accident",
        ]
    ),
}
