"""
Lab Booking Workflow
Handles lab test booking and status inquiries
"""

from typing import Dict, Any, List
import structlog

from app.models.intents import Intent
from app.models.responses import WorkflowResult
from app.orchestration.workflows.base import BaseWorkflow

logger = structlog.get_logger()


class LabBookingWorkflow(BaseWorkflow):
    """
    Workflow for lab test management.
    """
    
    @property
    def supported_intents(self) -> List[Intent]:
        return [Intent.BOOK_LAB_TEST]
    
    async def execute(
        self,
        session_id: str,
        intent: Intent,
        entities: Dict[str, Any],
        context: Dict[str, Any]
    ) -> WorkflowResult:
        """Execute lab booking workflow."""
        
        patient_id = entities.get("patient_id") or context.get("patient_id")
        phone = entities.get("phone")
        test_name = entities.get("test_name")
        
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
                    response_text="To book a lab test, please provide your patient ID or registered phone number.",
                    is_complete=False,
                    updated_context={"step": "need_patient"}
                )
        
        # Get available tests
        try:
            tests = await self.his_client.get_lab_tests()
            
            if test_name:
                # Match test
                matched = [t for t in tests if test_name.lower() in t.get("name", "").lower()]
                if matched:
                    test_info = matched[0]
                    return WorkflowResult(
                        success=True,
                        response_text=f"Lab test booking for {test_info.get('name')} requires a doctor's prescription. Please visit the lab with your prescription, or I can connect you with the lab reception.",
                        is_complete=False,
                        requires_human=True
                    )
            
            # List popular tests
            popular_tests = [t.get("name") for t in tests[:5]]
            return WorkflowResult(
                success=True,
                response_text=f"Our lab offers various tests including: {', '.join(popular_tests)}. Lab tests require a doctor's prescription. Would you like me to connect you with the lab reception?",
                is_complete=False,
                requires_human=True
            )
            
        except Exception as e:
            logger.error("Lab test lookup failed", error=str(e))
            return WorkflowResult(
                success=True,
                response_text="Let me connect you with our lab reception for assistance with test booking.",
                requires_human=True
            )
