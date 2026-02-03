"""
Workflow Engine
Maps intents to workflows and orchestrates execution
"""

from typing import Dict, Any, Optional
import structlog

from app.models.intents import Intent, INTENT_CONFIGS
from app.models.responses import WorkflowResult
from app.integration.his_client import HISClient
from app.conversation.context_tracker import ContextTracker

logger = structlog.get_logger()


class WorkflowEngine:
    """
    Orchestrates conversation workflows.
    Maps intents to appropriate handlers and manages execution.
    """
    
    # Greeting templates
    GREETINGS = [
        "Hello! Welcome to City Hospital. I'm your AI receptionist. How can I help you today?",
        "Good morning! This is City Hospital AI receptionist. How may I assist you?",
        "Thank you for calling City Hospital. How can I help you today?",
    ]
    
    def __init__(self, his_client: HISClient):
        """
        Initialize workflow engine.
        
        Args:
            his_client: Authenticated HIS API client
        """
        self.his_client = his_client
        self.context_tracker = ContextTracker()
        
        # Import workflow handlers
        from app.orchestration.workflows import (
            PatientRegistrationWorkflow,
            AppointmentBookingWorkflow,
            OPDCheckinWorkflow,
            BedAllocationWorkflow,
            LabBookingWorkflow,
            StatusInquiryWorkflow,
            EscalationWorkflow,
        )
        
        # Map intents to workflow handlers
        self._workflows = {
            Intent.REGISTER_PATIENT: PatientRegistrationWorkflow(his_client),
            Intent.FIND_PATIENT: PatientRegistrationWorkflow(his_client),  # Reuse
            Intent.BOOK_APPOINTMENT: AppointmentBookingWorkflow(his_client),
            Intent.RESCHEDULE_APPOINTMENT: AppointmentBookingWorkflow(his_client),
            Intent.CANCEL_APPOINTMENT: AppointmentBookingWorkflow(his_client),
            Intent.OPD_CHECKIN: OPDCheckinWorkflow(his_client),
            Intent.OPD_QUEUE_STATUS: OPDCheckinWorkflow(his_client),
            Intent.CHECK_BED_AVAILABILITY: BedAllocationWorkflow(his_client),
            Intent.REQUEST_BED_ALLOCATION: BedAllocationWorkflow(his_client),
            Intent.REQUEST_ADMISSION: BedAllocationWorkflow(his_client),
            Intent.BOOK_LAB_TEST: LabBookingWorkflow(his_client),
            Intent.CHECK_LAB_STATUS: StatusInquiryWorkflow(his_client),
            Intent.CHECK_BILL_STATUS: StatusInquiryWorkflow(his_client),
            Intent.CHECK_APPOINTMENT_STATUS: StatusInquiryWorkflow(his_client),
            Intent.GENERAL_STATUS_INQUIRY: StatusInquiryWorkflow(his_client),
            Intent.ESCALATE_TO_HUMAN: EscalationWorkflow(his_client),
            Intent.REPORT_EMERGENCY: EscalationWorkflow(his_client),
        }
    
    def create_session(self, caller_id: str, channel: str = "phone") -> str:
        """Create a new conversation session."""
        return self.context_tracker.create_session(caller_id, channel)
    
    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get session information."""
        session = self.context_tracker.get_session(session_id)
        if not session:
            return None
        return {
            "session_id": session.session_id,
            "caller_id": session.caller_id,
            "channel": session.channel,
            "started_at": session.started_at.isoformat(),
            "last_activity": session.last_activity.isoformat(),
            "turn_count": session.turn_count,
            "current_workflow": session.current_workflow,
            "context": session.context,
        }
    
    def end_session(self, session_id: str) -> bool:
        """End a session."""
        return self.context_tracker.end_session(session_id)
    
    async def generate_greeting(self) -> str:
        """Generate greeting for new call."""
        from datetime import datetime
        hour = datetime.now().hour
        
        if hour < 12:
            time_greeting = "Good morning"
        elif hour < 17:
            time_greeting = "Good afternoon"
        else:
            time_greeting = "Good evening"
        
        return f"{time_greeting}! Welcome to City Hospital. I'm your AI receptionist. How can I help you today?"
    
    async def execute(
        self,
        session_id: str,
        intent: str,
        entities: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None
    ) -> WorkflowResult:
        """
        Execute workflow based on intent.
        
        Args:
            session_id: Session ID
            intent: Classified intent
            entities: Extracted entities
            context: Current conversation context
            
        Returns:
            WorkflowResult with response and state
        """
        try:
            # ==================== STEP 1: GET SESSION CONTEXT ====================
            logger.info("=" * 60)
            logger.info("WORKFLOW_ENGINE: Starting execution",
                       session_id=session_id,
                       intent=str(intent),
                       entities_count=len(entities),
                       entities_keys=list(entities.keys()))
            
            # Get session context
            session_context = self.context_tracker.get_context(session_id)
            merged_context = {**(context or {}), **session_context}
            
            logger.info("WORKFLOW_ENGINE: Context loaded",
                       session_id=session_id,
                       current_workflow=session_context.get("current_workflow"),
                       workflow_state_keys=list(session_context.get("workflow_state", {}).keys()),
                       turn_count=session_context.get("turn_count", 0))
            
            # Handle simple intents directly
            if intent == Intent.GREETING or intent == "GREETING":
                return WorkflowResult(
                    success=True,
                    response_text=await self.generate_greeting(),
                    is_complete=False
                )
            
            if intent == Intent.GOODBYE or intent == "GOODBYE":
                self.end_session(session_id)
                return WorkflowResult(
                    success=True,
                    response_text="Thank you for calling City Hospital. Take care and have a great day!",
                    is_complete=True
                )
            
            if intent == Intent.HELP or intent == "HELP":
                return WorkflowResult(
                    success=True,
                    response_text="I can help you with: booking appointments, patient registration, check-in for OPD, checking bed availability, lab test booking, or status inquiries. What would you like to do?",
                    is_complete=False
                )
            
            if intent == Intent.UNCLEAR or intent == "UNCLEAR":
                return WorkflowResult(
                    success=True,
                    response_text="I'm sorry, I didn't quite understand that. Could you please repeat or tell me more about what you need help with?",
                    is_complete=False
                )
            
            # Handle confirmation intents
            if intent in [Intent.CONFIRM_YES, Intent.CONFIRM_NO, Intent.PROVIDE_INFORMATION,
                         "CONFIRM_YES", "CONFIRM_NO", "PROVIDE_INFORMATION", "CONFIRM", "DENY"]:
                return await self._handle_continuation(
                    session_id, intent, entities, merged_context
                )
            
            # Get workflow handler for intent
            intent_enum = Intent(intent) if isinstance(intent, str) else intent
            workflow = self._workflows.get(intent_enum)
            
            if not workflow:
                logger.warning("No workflow for intent", intent=intent)
                return WorkflowResult(
                    success=False,
                    response_text="I'm not sure how to help with that. Would you like me to connect you with a human receptionist?",
                    is_complete=False
                )
            
            # CRITICAL FIX: If there's an active workflow of the SAME type, 
            # treat this as a continuation instead of restarting
            current_workflow = merged_context.get("current_workflow")
            if current_workflow and current_workflow == intent:
                logger.info("Same workflow intent - continuing instead of restarting",
                           intent=intent, current_workflow=current_workflow)
                return await self._handle_continuation(
                    session_id, intent, entities, merged_context
                )
            
            # Set current workflow (only for NEW workflows)
            logger.info("WORKFLOW_ENGINE: Setting NEW workflow",
                       session_id=session_id,
                       workflow=str(intent))
            self.context_tracker.set_workflow(session_id, intent)
            
            # ==================== STEP 2: EXECUTE WORKFLOW ====================
            logger.info("WORKFLOW_ENGINE: Executing workflow",
                       session_id=session_id,
                       workflow=str(intent_enum),
                       entities=entities)
            
            # Execute workflow
            result = await workflow.execute(
                session_id=session_id,
                intent=intent_enum,
                entities=entities,
                context=merged_context
            )
            
            # ==================== STEP 3: UPDATE STATE ====================
            logger.info("WORKFLOW_ENGINE: Workflow returned",
                       session_id=session_id,
                       success=result.success,
                       is_complete=result.is_complete,
                       response_preview=result.response_text[:100] if result.response_text else None,
                       updated_context_keys=list(result.updated_context.keys()) if result.updated_context else [])
            
            # Update session context
            if result.updated_context:
                logger.info("WORKFLOW_ENGINE: Updating workflow state",
                           session_id=session_id,
                           updated_keys=list(result.updated_context.keys()))
                self.context_tracker.update_workflow_state(session_id, result.updated_context)
            
            # Record turn
            self.context_tracker.add_turn(
                session_id=session_id,
                user_input=entities.get("_raw_input", ""),
                intent=intent,
                entities=entities,
                response=result.response_text,
                api_calls=result.api_calls_made
            )
            
            # Clear workflow if complete
            if result.is_complete:
                self.context_tracker.clear_workflow(session_id)
            
            return result
            
        except Exception as e:
            logger.error("Workflow execution failed",
                        session_id=session_id,
                        intent=intent,
                        error=str(e))
            return WorkflowResult(
                success=False,
                response_text="I apologize, but I encountered an issue. Would you like me to transfer you to a human receptionist?",
                is_complete=False,
                requires_human=True,
                error=str(e)
            )
    
    async def _handle_continuation(
        self,
        session_id: str,
        intent: str,
        entities: Dict[str, Any],
        context: Dict[str, Any]
    ) -> WorkflowResult:
        """
        Handle continuation of an existing workflow.
        """
        current_workflow = context.get("current_workflow")
        workflow_state = context.get("workflow_state", {})
        
        logger.info("=" * 60)
        logger.info("WORKFLOW_ENGINE: Handling continuation",
                   session_id=session_id,
                   intent=str(intent),
                   current_workflow=current_workflow,
                   workflow_step=workflow_state.get("step"),
                   is_confirmation=intent in ["CONFIRM_YES", "CONFIRM", "Intent.CONFIRM_YES"])
        
        if not current_workflow:
            logger.warning("WORKFLOW_ENGINE: No active workflow - cannot continue",
                          session_id=session_id)
            return WorkflowResult(
                success=True,
                response_text="I'm sorry, I'm not sure what you're referring to. How can I help you today?",
                is_complete=False
            )
        
        # Get the workflow handler
        try:
            workflow_intent = Intent(current_workflow)
            workflow = self._workflows.get(workflow_intent)
            
            if workflow:
                # Merge entities with existing context
                merged_entities = {**context.get("collected_entities", {}), **entities}
                
                # ==================== ENTITY FLOW LOG ====================
                logger.info("WORKFLOW_ENGINE: Entity merge",
                           session_id=session_id,
                           incoming_entities_keys=list(entities.keys()),
                           workflow_state_keys=list(workflow_state.keys()),
                           merged_entities_keys=list(merged_entities.keys()),
                           available_doctors_in_state="available_doctors" in workflow_state)
                
                result = await workflow.continue_workflow(
                    session_id=session_id,
                    new_entities=entities,
                    all_entities=merged_entities,
                    context=context,
                    is_confirmation=intent in ["CONFIRM_YES", "CONFIRM", Intent.CONFIRM_YES],
                    is_denial=intent in ["CONFIRM_NO", "DENY", Intent.CONFIRM_NO]
                )
                
                # ==================== CONTINUATION RESULT LOG ====================
                logger.info("WORKFLOW_ENGINE: Continuation result",
                           session_id=session_id,
                           success=result.success,
                           is_complete=result.is_complete,
                           response_preview=result.response_text[:80] if result.response_text else None,
                           updated_context_keys=list(result.updated_context.keys()) if result.updated_context else [])
                
                # CRITICAL: Update session state with workflow result
                if result.updated_context:
                    logger.info("WORKFLOW_ENGINE: Saving updated context",
                               session_id=session_id,
                               keys=list(result.updated_context.keys()),
                               has_available_doctors="available_doctors" in result.updated_context,
                               doctor_id=result.updated_context.get("doctor_id"))
                    self.context_tracker.update_workflow_state(session_id, result.updated_context)
                
                # Record turn
                self.context_tracker.add_turn(
                    session_id=session_id,
                    user_input=entities.get("_raw_input", ""),
                    intent=intent,
                    entities=entities,
                    response=result.response_text,
                    api_calls=result.api_calls_made
                )
                
                # Clear workflow if complete
                if result.is_complete:
                    self.context_tracker.clear_workflow(session_id)
                
                return result
            
        except ValueError:
            pass
        
        return WorkflowResult(
            success=True,
            response_text="Let me help you with something else. What would you like to do?",
            is_complete=False
        )

