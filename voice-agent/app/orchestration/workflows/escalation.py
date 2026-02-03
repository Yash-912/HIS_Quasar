"""
Escalation Workflow
Handles emergency reports and escalation to human staff
"""

from typing import Dict, Any, List
import structlog

from app.models.intents import Intent
from app.models.responses import WorkflowResult
from app.orchestration.workflows.base import BaseWorkflow

logger = structlog.get_logger()


class EscalationWorkflow(BaseWorkflow):
    """
    Workflow for emergencies and human escalation.
    """
    
    @property
    def supported_intents(self) -> List[Intent]:
        return [Intent.ESCALATE_TO_HUMAN, Intent.REPORT_EMERGENCY]
    
    async def execute(
        self,
        session_id: str,
        intent: Intent,
        entities: Dict[str, Any],
        context: Dict[str, Any]
    ) -> WorkflowResult:
        """Execute escalation workflow."""
        
        if intent == Intent.REPORT_EMERGENCY:
            return await self._handle_emergency(entities, context)
        else:
            return await self._escalate_to_human(entities, context)
    
    async def _handle_emergency(
        self,
        entities: Dict[str, Any],
        context: Dict[str, Any]
    ) -> WorkflowResult:
        """Handle emergency report."""
        
        emergency_type = entities.get("emergency_type", "")
        
        logger.critical("EMERGENCY REPORTED",
                       emergency_type=emergency_type,
                       entities=entities)
        
        # Create emergency case if possible
        patient_name = entities.get("patient_name") or entities.get("first_name")
        
        try:
            if patient_name:
                # Try to create emergency case
                case_data = {
                    "patientName": patient_name,
                    "chiefComplaint": emergency_type or "Emergency - details pending",
                    "triageLevel": "red",  # Assume highest priority
                    "source": "voice_agent"
                }
                
                result = await self.his_client.create_emergency_case(case_data)
                
                self._record_api_call("POST", "/emergency/cases", case_data, result, True)
                
                return WorkflowResult(
                    success=True,
                    response_text="I've alerted our emergency team. Please bring the patient to the Emergency entrance immediately. If you're not at the hospital, call 108 for an ambulance. Our emergency team is being notified.",
                    is_complete=True,
                    requires_human=True,
                    api_calls_made=self.api_calls
                )
                
        except Exception as e:
            logger.error("Emergency case creation failed", error=str(e))
        
        # Default emergency response
        return WorkflowResult(
            success=True,
            response_text="I understand this is an emergency. Please come directly to the Emergency entrance of the hospital. If you're not nearby, call 108 for an ambulance immediately. I'm alerting our emergency team now. Stay on the line if you need further assistance.",
            is_complete=True,
            requires_human=True
        )
    
    async def _escalate_to_human(
        self,
        entities: Dict[str, Any],
        context: Dict[str, Any]
    ) -> WorkflowResult:
        """Escalate to human receptionist."""
        
        reason = entities.get("reason", "")
        
        logger.info("Escalation requested",
                   reason=reason,
                   context_summary={
                       "turns": context.get("turn_count", 0),
                       "workflow": context.get("current_workflow")
                   })
        
        return WorkflowResult(
            success=True,
            response_text="I'll connect you with our reception desk right away. Please hold while I transfer your call. If you're at the hospital, you can also approach the main reception counter directly.",
            is_complete=True,
            requires_human=True
        )
