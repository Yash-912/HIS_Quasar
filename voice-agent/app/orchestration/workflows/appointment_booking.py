"""
Appointment Booking Workflow
Handles appointment booking, rescheduling, and cancellation
"""

from typing import Dict, Any, List
import structlog

from app.models.intents import Intent
from app.models.responses import WorkflowResult
from app.orchestration.workflows.base import BaseWorkflow

logger = structlog.get_logger()


class AppointmentBookingWorkflow(BaseWorkflow):
    """
    Workflow for OPD appointment management.
    """
    
    @property
    def supported_intents(self) -> List[Intent]:
        return [
            Intent.BOOK_APPOINTMENT,
            Intent.RESCHEDULE_APPOINTMENT,
            Intent.CANCEL_APPOINTMENT
        ]
    
    async def execute(
        self,
        session_id: str,
        intent: Intent,
        entities: Dict[str, Any],
        context: Dict[str, Any]
    ) -> WorkflowResult:
        """Execute appointment workflow."""
        
        if intent == Intent.BOOK_APPOINTMENT:
            return await self._book_appointment(entities, context)
        elif intent == Intent.RESCHEDULE_APPOINTMENT:
            return await self._reschedule_appointment(entities, context)
        elif intent == Intent.CANCEL_APPOINTMENT:
            return await self._cancel_appointment(entities, context)
        
        return WorkflowResult(
            success=False,
            response_text="I'm not sure how to help with that appointment request.",
            is_complete=False
        )
    
    async def _book_appointment(
        self,
        entities: Dict[str, Any],
        context: Dict[str, Any]
    ) -> WorkflowResult:
        """Book new appointment."""
        
        # Get collected entities from context
        collected = context.get("collected_entities", {})
        workflow_state = context.get("workflow_state", {})
        
        # ==================== BOOKING WORKFLOW START LOG ====================
        logger.info("=" * 60)
        logger.info("APPOINTMENT: _book_appointment called",
                   entities_keys=list(entities.keys()),
                   workflow_state_keys=list(workflow_state.keys()),
                   step=workflow_state.get("step"),
                   has_available_doctors="available_doctors" in workflow_state or "available_doctors" in entities,
                   doctor_id_in_state=workflow_state.get("doctor_id"),
                   doctor_id_in_entities=entities.get("doctor_id"))
        
        # Step 1: Get patient identifier - check current entities AND collected context
        patient = context.get("patient") or collected.get("patient") or workflow_state.get("patient")
        patient_id = entities.get("patient_id") or context.get("patient_id") or collected.get("patient_id") or workflow_state.get("patient_id")
        phone = entities.get("phone") or context.get("phone") or collected.get("phone") or workflow_state.get("phone")
        
        logger.info("APPOINTMENT: Step 1 - Patient lookup",
                   has_patient=bool(patient),
                   patient_id=patient_id,
                   phone=phone)
        
        if not patient and not patient_id:
            if phone:
                # Try to find patient
                validated_phone = self._validate_phone(phone)
                if validated_phone:
                    try:
                        patients = await self.his_client.search_patients(phone=validated_phone)
                        if patients:
                            patient = patients[0]
                            patient_id = patient.get("_id")
                        else:
                            return WorkflowResult(
                                success=True,
                                response_text="I couldn't find a patient with that phone number. Are you a new patient? I can help you register first.",
                                is_complete=False,
                                updated_context={"step": "no_patient_found", "phone": phone}
                            )
                    except Exception as e:
                        logger.error("Patient search failed", error=str(e))
                        # Continue with phone even if search fails - store for later
                        return WorkflowResult(
                            success=True,
                            response_text="Which department would you like to visit? For example, General Medicine, Cardiology, Orthopedics, or ENT.",
                            is_complete=False,
                            updated_context={"step": "need_department", "phone": phone}
                        )
            else:
                return WorkflowResult(
                    success=True,
                    response_text="To book an appointment, I'll need your patient ID or registered phone number.",
                    is_complete=False,
                    updated_context={"step": "need_patient_id"}
                )
        
        # Step 2: Get department - check current entities AND collected context
        department = entities.get("department") or context.get("department") or collected.get("department") or workflow_state.get("department")
        department_id = entities.get("department_id") or context.get("department_id") or collected.get("department_id") or workflow_state.get("department_id")
        
        logger.info("APPOINTMENT: Step 2 - Department lookup",
                   department=department,
                   department_id=department_id,
                   source="entities" if entities.get("department") else 
                          "workflow_state" if workflow_state.get("department") else "none")
        
        if not department_id:
            if department:
                # Find department
                try:
                    departments = await self.his_client.get_departments()
                    matched = None
                    for dept in departments:
                        if department.lower() in dept.get("name", "").lower():
                            matched = dept
                            break
                    
                    if matched:
                        department_id = matched.get("_id")
                        department = matched.get("name")
                    else:
                        dept_names = [d.get("name") for d in departments[:5]]
                        return WorkflowResult(
                            success=True,
                            response_text=f"I couldn't find that department. We have: {', '.join(dept_names)}. Which one would you like?",
                            is_complete=False,
                            updated_context={"step": "select_department", "available_departments": departments, "phone": phone, "patient_id": patient_id}
                        )
                except Exception as e:
                    logger.error("Department fetch failed", error=str(e))
                    # Continue anyway - store department for later
                    return WorkflowResult(
                        success=True,
                        response_text="When would you like to schedule the appointment? You can say today, tomorrow, or a specific date.",
                        is_complete=False,
                        updated_context={"step": "need_date", "phone": phone, "patient_id": patient_id, "department": department}
                    )
            else:
                return WorkflowResult(
                    success=True,
                    response_text="Which department would you like to visit? For example, General Medicine, Cardiology, Orthopedics, or ENT.",
                    is_complete=False,
                    updated_context={"step": "need_department", "phone": phone, "patient_id": patient_id}
                )
        
        # Step 3: Get doctor (optional)
        doctor_id = entities.get("doctor_id") or context.get("doctor_id") or workflow_state.get("doctor_id")
        doctor_name = entities.get("doctor_name") or workflow_state.get("doctor_name")
        
        # If user selected a doctor by name but we don't have ID, look it up from available_doctors
        # Check both workflow_state and entities (since continue_workflow merges them)
        available_doctors = workflow_state.get("available_doctors") or entities.get("available_doctors") or []
        
        # Get user input for matching
        user_input = entities.get("_raw_input", "")
        
        logger.info("APPOINTMENT: Step 3 - Doctor lookup",
                   doctor_id=doctor_id,
                   doctor_name=doctor_name,
                   available_doctors_count=len(available_doctors),
                   doctor_offered=workflow_state.get("doctor_offered"),
                   user_input=user_input[:50] if user_input else None)
        
        if not doctor_id and available_doctors:
            user_input_lower = user_input.lower()
            
            # Check if user said "yes" or mentioned any doctor name
            for doc in available_doctors:
                first_name = doc.get("profile", {}).get("firstName", "").lower()
                last_name = doc.get("profile", {}).get("lastName", "").lower()
                full_name = f"{first_name} {last_name}"
                
                # Match if user mentions the name OR just says "yes" (take first doctor)
                if first_name in user_input_lower or last_name in user_input_lower or full_name in user_input_lower:
                    doctor_id = doc.get("_id")
                    doctor_name = f"{doc.get('profile', {}).get('firstName', '')} {doc.get('profile', {}).get('lastName', '')}"
                    logger.info("Matched doctor from user input", doctor_name=doctor_name, doctor_id=doctor_id)
                    break
            
            # If user just said "yes" and we have one doctor, select them
            if not doctor_id and len(available_doctors) == 1 and ("yes" in user_input_lower or "book" in user_input_lower):
                doc = available_doctors[0]
                doctor_id = doc.get("_id")
                doctor_name = f"{doc.get('profile', {}).get('firstName', '')} {doc.get('profile', {}).get('lastName', '')}"
                logger.info("Selected only available doctor", doctor_name=doctor_name, doctor_id=doctor_id)
        
        # Check doctor_offered in workflow_state (where it's stored via updated_context)
        doctor_offered = context.get("doctor_offered") or workflow_state.get("doctor_offered")
        if department_id and not doctor_id and not doctor_offered:
            # Offer doctor selection
            try:
                doctors = await self.his_client.get_department_doctors(department_id)
                if doctors:
                    doctor_names = [f"Dr. {d.get('profile', {}).get('firstName', '')} {d.get('profile', {}).get('lastName', '')}" for d in doctors[:3]]
                    logger.info("APPOINTMENT: Offering doctor selection",
                               doctors_count=len(doctors),
                               doctor_names=doctor_names)
                    return WorkflowResult(
                        success=True,
                        response_text=f"We have {len(doctors)} doctors in {department}. Would you like to see: {', '.join(doctor_names)}, or any available doctor?",
                        is_complete=False,
                        updated_context={
                            "step": "select_doctor",
                            "available_doctors": doctors,
                            "doctor_offered": True,
                            "department_id": department_id,
                            "department": department,
                            "patient_id": patient_id  # CRITICAL: Preserve patient_id
                        }
                    )
            except Exception as e:
                logger.warning("Doctor fetch failed, continuing without", error=str(e))
        
        # Step 4: Get date
        preferred_date = entities.get("preferred_date")
        formatted_date = None
        
        if preferred_date:
            formatted_date = self._format_date(preferred_date)
        
        # Also check if we already have a scheduled_date from workflow_state
        if not formatted_date:
            formatted_date = workflow_state.get("scheduled_date")
        
        logger.info("APPOINTMENT: Step 4 - Date lookup",
                   preferred_date=preferred_date,
                   formatted_date=formatted_date,
                   from_workflow_state=bool(workflow_state.get("scheduled_date")))
        
        if not formatted_date:
            logger.info("APPOINTMENT: Asking for date - preserving state",
                       doctor_id=doctor_id,
                       available_doctors_count=len(available_doctors))
            return WorkflowResult(
                success=True,
                response_text="When would you like to schedule the appointment? You can say today, tomorrow, or a specific date.",
                is_complete=False,
                updated_context={
                    "step": "need_date",
                    "department_id": department_id,
                    "department": department,
                    "doctor_id": doctor_id,
                    "doctor_name": doctor_name,
                    "doctor_offered": True,
                    "available_doctors": available_doctors,  # CRITICAL: Preserve for doctor matching
                    "patient_id": patient_id
                }
            )
        
        # Step 5: Confirm and book
        # Check for confirmation in entities (set by continue_workflow), context, or workflow_state
        is_confirmed = entities.get("confirmed") or context.get("confirmed") or workflow_state.get("confirmed")
        
        logger.info("APPOINTMENT: Step 5 - Confirmation check",
                   is_confirmed=is_confirmed,
                   patient_id=patient_id,
                   department_id=department_id,
                   doctor_id=doctor_id,
                   formatted_date=formatted_date)
        
        if not is_confirmed:
            summary = f"Let me confirm: Appointment in {department}"
            if doctor_name:
                summary += f" with {doctor_name}"
            summary += f" on {formatted_date}. Shall I book this?"
            
            return WorkflowResult(
                success=True,
                response_text=summary,
                is_complete=False,
                updated_context={
                    "step": "awaiting_confirmation",
                    "patient_id": patient_id,
                    "department_id": department_id,
                    "department": department,
                    "doctor_id": doctor_id,
                    "doctor_name": doctor_name,
                    "doctor_offered": True,
                    "available_doctors": available_doctors,  # CRITICAL: Preserve for doctor matching
                    "scheduled_date": formatted_date
                }
            )
        
        # ==================== STEP 6: CREATE APPOINTMENT ====================
        logger.info("APPOINTMENT: Step 6 - Creating appointment",
                   patient_id=patient_id,
                   department_id=department_id,
                   doctor_id=doctor_id,
                   scheduled_date=formatted_date)
        
        # Create appointment
        try:
            appointment_data = {
                "patient": patient_id,
                "department": department_id,
                "scheduledDate": formatted_date,
                "type": "opd"
            }
            
            if doctor_id:
                appointment_data["doctor"] = doctor_id
            
            if entities.get("chief_complaint"):
                appointment_data["chiefComplaint"] = entities.get("chief_complaint")
            
            logger.info("APPOINTMENT: Calling HIS API",
                       endpoint="/opd/appointments",
                       appointment_data=appointment_data)
            
            result = await self.his_client.create_appointment(appointment_data)
            
            self._record_api_call("POST", "/opd/appointments", appointment_data, result, True)
            
            apt_number = result.get("appointmentNumber", "")
            token = result.get("tokenNumber", "")
            
            logger.info("APPOINTMENT: SUCCESS - Appointment created",
                       appointment_number=apt_number,
                       token=token)
            
            apt_number = result.get("appointmentNumber", "")
            token = result.get("tokenNumber", "")
            
            return WorkflowResult(
                success=True,
                response_text=f"Your appointment is confirmed! Appointment number: {apt_number}, Token: {token}. Please arrive 15 minutes before your scheduled time. Is there anything else I can help with?",
                is_complete=True,
                updated_context={"appointment": result},
                api_calls_made=self.api_calls
            )
            
        except Exception as e:
            logger.error("Appointment creation failed", error=str(e))
            return WorkflowResult(
                success=False,
                response_text="I couldn't book the appointment. Would you like me to connect you to the reception desk?",
                is_complete=False,
                requires_human=True,
                error=str(e)
            )
    
    async def _reschedule_appointment(
        self,
        entities: Dict[str, Any],
        context: Dict[str, Any]
    ) -> WorkflowResult:
        """Reschedule existing appointment."""
        # TODO: Implement rescheduling
        return WorkflowResult(
            success=True,
            response_text="To reschedule your appointment, let me connect you with the reception desk who can check available slots.",
            is_complete=False,
            requires_human=True
        )
    
    async def _cancel_appointment(
        self,
        entities: Dict[str, Any],
        context: Dict[str, Any]
    ) -> WorkflowResult:
        """Cancel existing appointment."""
        # TODO: Implement cancellation
        return WorkflowResult(
            success=True,
            response_text="To cancel your appointment, let me connect you with the reception desk for confirmation.",
            is_complete=False,
            requires_human=True
        )
    
    async def continue_workflow(
        self,
        session_id: str,
        new_entities: Dict[str, Any],
        all_entities: Dict[str, Any],
        context: Dict[str, Any],
        is_confirmation: bool = False,
        is_denial: bool = False
    ) -> WorkflowResult:
        """Continue appointment workflow."""
        
        workflow_state = context.get("workflow_state", {})
        step = workflow_state.get("step", "")
        
        logger.info("=" * 60)
        logger.info("APPOINTMENT: continue_workflow called",
                   session_id=session_id,
                   step=step,
                   is_confirmation=is_confirmation,
                   is_denial=is_denial,
                   available_doctors_in_state="available_doctors" in workflow_state,
                   doctor_id_in_state=workflow_state.get("doctor_id"))
        
        # CRITICAL: Merge workflow_state into all_entities to preserve collected data
        # workflow_state contains patient_id, department_id, doctor_id, scheduled_date etc.
        merged_entities = {**workflow_state, **all_entities, **new_entities}
        
        logger.info("APPOINTMENT: Merged entities",
                   merged_keys=list(merged_entities.keys()),
                   doctor_id=merged_entities.get("doctor_id"),
                   patient_id=merged_entities.get("patient_id"),
                   department_id=merged_entities.get("department_id"))
        
        if step == "awaiting_confirmation":
            if is_confirmation:
                merged_entities["confirmed"] = True
                return await self._book_appointment(merged_entities, context)
            elif is_denial:
                return WorkflowResult(
                    success=True,
                    response_text="No problem. Would you like to choose a different date or department?",
                    is_complete=False,
                    updated_context={"step": "restart"}
                )
        
        # Default: continue booking flow with merged state
        return await self._book_appointment(merged_entities, context)

