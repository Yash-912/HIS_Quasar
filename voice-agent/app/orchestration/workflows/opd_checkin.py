"""
OPD Check-in Workflow
Handles patient check-in for scheduled appointments
"""

from typing import Dict, Any, List
import structlog

from app.models.intents import Intent
from app.models.responses import WorkflowResult
from app.orchestration.workflows.base import BaseWorkflow

logger = structlog.get_logger()


class OPDCheckinWorkflow(BaseWorkflow):
    """
    Workflow for OPD check-in.
    """
    
    @property
    def supported_intents(self) -> List[Intent]:
        return [Intent.OPD_CHECKIN, Intent.OPD_QUEUE_STATUS]
    
    async def execute(
        self,
        session_id: str,
        intent: Intent,
        entities: Dict[str, Any],
        context: Dict[str, Any]
    ) -> WorkflowResult:
        """Execute OPD check-in workflow."""
        
        if intent == Intent.OPD_QUEUE_STATUS:
            return await self._check_queue(entities, context)
        
        return await self._checkin(entities, context)
    
    async def _checkin(
        self,
        entities: Dict[str, Any],
        context: Dict[str, Any]
    ) -> WorkflowResult:
        """Check in patient for appointment."""
        
        patient_id = entities.get("patient_id") or context.get("patient_id")
        phone = entities.get("phone")
        appointment_id = entities.get("appointment_id") or context.get("appointment_id")
        
        # Need patient identifier
        if not patient_id and not appointment_id:
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
                    response_text="To check you in, please provide your patient ID or registered phone number.",
                    is_complete=False,
                    updated_context={"step": "need_identifier"}
                )
        
        # Find today's appointment
        if not appointment_id and patient_id:
            try:
                from datetime import date
                appointments = await self.his_client.get_appointments(
                    patient_id=patient_id,
                    status="scheduled",
                    date=date.today().isoformat()
                )
                
                if not appointments:
                    return WorkflowResult(
                        success=True,
                        response_text="I couldn't find an appointment for you today. Would you like to book a new appointment?",
                        is_complete=False,
                        updated_context={"step": "no_appointment"}
                    )
                
                if len(appointments) == 1:
                    appointment_id = appointments[0].get("_id")
                else:
                    # Multiple appointments
                    times = [a.get("scheduledTime", "unknown time") for a in appointments]
                    return WorkflowResult(
                        success=True,
                        response_text=f"I found {len(appointments)} appointments today at {', '.join(times)}. Which one would you like to check in for?",
                        is_complete=False,
                        updated_context={"step": "select_appointment", "appointments": appointments}
                    )
                    
            except Exception as e:
                logger.error("Appointment lookup failed", error=str(e))
                return WorkflowResult(
                    success=False,
                    response_text="I'm having trouble looking up your appointment. Let me connect you with the reception desk.",
                    requires_human=True,
                    error=str(e)
                )
        
        # Perform check-in
        try:
            result = await self.his_client.checkin_appointment(appointment_id)
            
            self._record_api_call("PUT", f"/opd/appointments/{appointment_id}/checkin", {}, result, True)
            
            token = result.get("tokenNumber", "")
            queue_position = result.get("queuePosition", "")
            estimated_wait = result.get("estimatedWait", "")
            
            response = f"Check-in complete! Your token number is {token}."
            if queue_position:
                response += f" You are number {queue_position} in the queue."
            if estimated_wait:
                response += f" Estimated wait time is about {estimated_wait} minutes."
            response += " Please have a seat in the waiting area. Is there anything else I can help with?"
            
            return WorkflowResult(
                success=True,
                response_text=response,
                is_complete=True,
                updated_context={"checkin": result},
                api_calls_made=self.api_calls
            )
            
        except Exception as e:
            logger.error("Check-in failed", error=str(e))
            return WorkflowResult(
                success=False,
                response_text="I couldn't complete the check-in. Please visit the reception desk for assistance.",
                requires_human=True,
                error=str(e)
            )
    
    async def _check_queue(
        self,
        entities: Dict[str, Any],
        context: Dict[str, Any]
    ) -> WorkflowResult:
        """Check OPD queue status."""
        try:
            queue = await self.his_client.get_opd_queue()
            
            if not queue:
                return WorkflowResult(
                    success=True,
                    response_text="The OPD queue is currently empty. There should be no wait time.",
                    is_complete=True
                )
            
            return WorkflowResult(
                success=True,
                response_text=f"There are currently {len(queue)} patients in the OPD queue. Average wait time is approximately 15-20 minutes.",
                is_complete=True
            )
            
        except Exception as e:
            logger.error("Queue check failed", error=str(e))
            return WorkflowResult(
                success=False,
                response_text="I couldn't check the queue status. Please ask at the reception desk.",
                error=str(e)
            )
