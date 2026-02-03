"""Workflows package init"""

from app.orchestration.workflows.base import BaseWorkflow
from app.orchestration.workflows.patient_registration import PatientRegistrationWorkflow
from app.orchestration.workflows.appointment_booking import AppointmentBookingWorkflow
from app.orchestration.workflows.opd_checkin import OPDCheckinWorkflow
from app.orchestration.workflows.bed_allocation import BedAllocationWorkflow
from app.orchestration.workflows.lab_booking import LabBookingWorkflow
from app.orchestration.workflows.status_inquiry import StatusInquiryWorkflow
from app.orchestration.workflows.escalation import EscalationWorkflow

__all__ = [
    "BaseWorkflow",
    "PatientRegistrationWorkflow",
    "AppointmentBookingWorkflow",
    "OPDCheckinWorkflow",
    "BedAllocationWorkflow",
    "LabBookingWorkflow",
    "StatusInquiryWorkflow",
    "EscalationWorkflow",
]
