"""
Status Inquiry Workflow
Handles various status checks (appointments, labs, bills)
"""

from typing import Dict, Any, List
import structlog

from app.models.intents import Intent
from app.models.responses import WorkflowResult
from app.orchestration.workflows.base import BaseWorkflow

logger = structlog.get_logger()


class StatusInquiryWorkflow(BaseWorkflow):
    """
    Workflow for status inquiries.
    """
    
    @property
    def supported_intents(self) -> List[Intent]:
        return [
            Intent.CHECK_LAB_STATUS,
            Intent.CHECK_BILL_STATUS,
            Intent.CHECK_APPOINTMENT_STATUS,
            Intent.GENERAL_STATUS_INQUIRY
        ]
    
    async def execute(
        self,
        session_id: str,
        intent: Intent,
        entities: Dict[str, Any],
        context: Dict[str, Any]
    ) -> WorkflowResult:
        """Execute status inquiry workflow."""
        
        # Get patient identifier first
        patient_id = entities.get("patient_id") or context.get("patient_id")
        phone = entities.get("phone")
        
        if not patient_id:
            if phone:
                validated_phone = self._validate_phone(phone)
                if validated_phone:
                    try:
                        patients = await self.his_client.search_patients(phone=validated_phone)
                        if patients:
                            patient_id = patients[0].get("_id")
                    except Exception as e:
                        logger.error("Patient search failed", error=str(e))
            
            if not patient_id:
                return WorkflowResult(
                    success=True,
                    response_text="To check your status, please provide your patient ID or registered phone number.",
                    is_complete=False,
                    updated_context={"step": "need_patient"}
                )
        
        if intent == Intent.CHECK_LAB_STATUS:
            return await self._check_lab_status(patient_id)
        elif intent == Intent.CHECK_BILL_STATUS:
            return await self._check_bill_status(patient_id)
        elif intent == Intent.CHECK_APPOINTMENT_STATUS:
            return await self._check_appointment_status(patient_id)
        else:
            return WorkflowResult(
                success=True,
                response_text="What would you like to check? I can help with appointment status, lab results, or billing information.",
                is_complete=False
            )
    
    async def _check_lab_status(self, patient_id: str) -> WorkflowResult:
        """Check lab results status."""
        try:
            orders = await self.his_client.get_lab_orders(patient_id)
            
            if not orders:
                return WorkflowResult(
                    success=True,
                    response_text="I don't see any recent lab orders on your record. Is there anything else I can help with?",
                    is_complete=True
                )
            
            pending = [o for o in orders if o.get("status") in ["pending", "in_progress"]]
            completed = [o for o in orders if o.get("status") == "completed"]
            
            response_parts = []
            if completed:
                response_parts.append(f"You have {len(completed)} lab results ready")
            if pending:
                response_parts.append(f"{len(pending)} tests still in progress")
            
            response = ". ".join(response_parts)
            if completed:
                response += ". You can collect your reports from the lab."
            
            return WorkflowResult(
                success=True,
                response_text=response + " Is there anything else I can help with?",
                is_complete=True
            )
            
        except Exception as e:
            logger.error("Lab status check failed", error=str(e))
            return WorkflowResult(
                success=False,
                response_text="I couldn't check your lab status. Please visit the lab or call the lab directly.",
                error=str(e)
            )
    
    async def _check_bill_status(self, patient_id: str) -> WorkflowResult:
        """Check billing status."""
        try:
            bills = await self.his_client.get_patient_bills(patient_id)
            
            if not bills:
                return WorkflowResult(
                    success=True,
                    response_text="You don't have any pending bills at the moment. Is there anything else I can help with?",
                    is_complete=True
                )
            
            pending_bills = [b for b in bills if b.get("status") != "paid"]
            total_due = sum(b.get("totalAmount", 0) - b.get("paidAmount", 0) for b in pending_bills)
            
            if total_due > 0:
                return WorkflowResult(
                    success=True,
                    response_text=f"You have {len(pending_bills)} pending bills with a total balance of Rs. {total_due:,.2f}. You can make payment at the billing counter. Is there anything else I can help with?",
                    is_complete=True
                )
            else:
                return WorkflowResult(
                    success=True,
                    response_text="All your bills have been paid. Is there anything else I can help with?",
                    is_complete=True
                )
            
        except Exception as e:
            logger.error("Bill status check failed", error=str(e))
            return WorkflowResult(
                success=False,
                response_text="I couldn't check your billing status. Please visit the billing counter.",
                error=str(e)
            )
    
    async def _check_appointment_status(self, patient_id: str) -> WorkflowResult:
        """Check appointment status."""
        try:
            appointments = await self.his_client.get_appointments(patient_id=patient_id)
            
            upcoming = [a for a in appointments if a.get("status") == "scheduled"]
            
            if not upcoming:
                return WorkflowResult(
                    success=True,
                    response_text="You don't have any upcoming appointments. Would you like to book one?",
                    is_complete=True
                )
            
            next_apt = upcoming[0]
            date = next_apt.get("scheduledDate", "")
            time = next_apt.get("scheduledTime", "")
            dept = next_apt.get("department", {}).get("name", "")
            
            return WorkflowResult(
                success=True,
                response_text=f"Your next appointment is on {date} at {time} in {dept}. Is there anything else I can help with?",
                is_complete=True
            )
            
        except Exception as e:
            logger.error("Appointment status check failed", error=str(e))
            return WorkflowResult(
                success=False,
                response_text="I couldn't check your appointment status. Please ask at the reception.",
                error=str(e)
            )
