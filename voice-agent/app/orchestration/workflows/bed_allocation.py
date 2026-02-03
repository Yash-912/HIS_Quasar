"""
Bed Allocation Workflow
Handles bed availability checks and allocation requests
"""

from typing import Dict, Any, List
import structlog

from app.models.intents import Intent
from app.models.responses import WorkflowResult
from app.orchestration.workflows.base import BaseWorkflow

logger = structlog.get_logger()


class BedAllocationWorkflow(BaseWorkflow):
    """
    Workflow for bed management.
    """
    
    @property
    def supported_intents(self) -> List[Intent]:
        return [
            Intent.CHECK_BED_AVAILABILITY,
            Intent.REQUEST_BED_ALLOCATION,
            Intent.REQUEST_ADMISSION
        ]
    
    async def execute(
        self,
        session_id: str,
        intent: Intent,
        entities: Dict[str, Any],
        context: Dict[str, Any]
    ) -> WorkflowResult:
        """Execute bed workflow."""
        
        if intent == Intent.CHECK_BED_AVAILABILITY:
            return await self._check_availability(entities, context)
        else:
            return await self._request_allocation(entities, context)
    
    async def _check_availability(
        self,
        entities: Dict[str, Any],
        context: Dict[str, Any]
    ) -> WorkflowResult:
        """Check bed availability."""
        try:
            availability = await self.his_client.get_bed_availability()
            beds = await self.his_client.get_beds(status="available")
            
            self._record_api_call("GET", "/beds/availability", {}, availability, True)
            
            total_available = len(beds)
            
            # Categorize by type
            ward_beds = [b for b in beds if b.get("type") == "general"]
            private_rooms = [b for b in beds if b.get("type") == "private"]
            icu_beds = [b for b in beds if b.get("type") == "icu"]
            
            response_parts = [f"We currently have {total_available} beds available:"]
            if ward_beds:
                response_parts.append(f"{len(ward_beds)} general ward beds")
            if private_rooms:
                response_parts.append(f"{len(private_rooms)} private rooms")
            if icu_beds:
                response_parts.append(f"{len(icu_beds)} ICU beds")
            
            response = ". ".join(response_parts) + ". Would you like to request a bed allocation?"
            
            return WorkflowResult(
                success=True,
                response_text=response,
                is_complete=True,
                updated_context={"available_beds": beds},
                api_calls_made=self.api_calls
            )
            
        except Exception as e:
            logger.error("Bed availability check failed", error=str(e))
            return WorkflowResult(
                success=False,
                response_text="I couldn't check bed availability. Let me connect you with the admission desk.",
                requires_human=True,
                error=str(e)
            )
    
    async def _request_allocation(
        self,
        entities: Dict[str, Any],
        context: Dict[str, Any]
    ) -> WorkflowResult:
        """Request bed allocation."""
        
        patient_id = entities.get("patient_id") or context.get("patient_id")
        
        if not patient_id:
            return WorkflowResult(
                success=True,
                response_text="For bed allocation, I'll need the patient's ID or phone number. This requires admission approval from a doctor.",
                is_complete=False,
                updated_context={"step": "need_patient"}
            )
        
        # Bed allocation typically requires doctor approval
        return WorkflowResult(
            success=True,
            response_text="Bed allocation requires doctor approval. Let me connect you with the admission desk who can process this request with the attending physician.",
            is_complete=False,
            requires_human=True
        )
