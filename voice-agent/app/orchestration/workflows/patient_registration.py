"""
Patient Registration Workflow
Handles new patient registration and patient lookup
"""

from typing import Dict, Any, List
import structlog

from app.models.intents import Intent
from app.models.responses import WorkflowResult
from app.orchestration.workflows.base import BaseWorkflow

logger = structlog.get_logger()


class PatientRegistrationWorkflow(BaseWorkflow):
    """
    Workflow for patient registration and lookup.
    """
    
    @property
    def supported_intents(self) -> List[Intent]:
        return [Intent.REGISTER_PATIENT, Intent.FIND_PATIENT, Intent.UPDATE_PATIENT]
    
    async def execute(
        self,
        session_id: str,
        intent: Intent,
        entities: Dict[str, Any],
        context: Dict[str, Any]
    ) -> WorkflowResult:
        """Execute patient registration workflow."""
        
        if intent == Intent.FIND_PATIENT:
            return await self._find_patient(entities, context)
        elif intent == Intent.REGISTER_PATIENT:
            return await self._register_patient(entities, context)
        else:
            return WorkflowResult(
                success=False,
                response_text="I'm not sure how to help with that patient request.",
                is_complete=False
            )
    
    async def _find_patient(
        self,
        entities: Dict[str, Any],
        context: Dict[str, Any]
    ) -> WorkflowResult:
        """Find existing patient."""
        
        # Need some identifier
        phone = entities.get("phone")
        patient_id = entities.get("patient_id")
        name = entities.get("first_name") or entities.get("name")
        
        if not any([phone, patient_id, name]):
            return WorkflowResult(
                success=True,
                response_text="To find your record, please provide your patient ID, phone number, or name.",
                is_complete=False,
                updated_context={"step": "waiting_for_identifier"}
            )
        
        try:
            # Search for patient
            patients = await self.his_client.search_patients(
                query=name,
                phone=self._validate_phone(phone) if phone else None,
                patient_id=patient_id
            )
            
            self._record_api_call("GET", "/patients/search", 
                                 {"phone": phone, "patient_id": patient_id, "name": name},
                                 {"count": len(patients)}, True)
            
            if not patients:
                return WorkflowResult(
                    success=True,
                    response_text="I couldn't find a patient record with that information. Would you like to register as a new patient?",
                    is_complete=False,
                    updated_context={"step": "offer_registration"}
                )
            
            if len(patients) == 1:
                patient = patients[0]
                return WorkflowResult(
                    success=True,
                    response_text=f"I found your record. You are {patient.get('firstName')} {patient.get('lastName')}, Patient ID: {patient.get('patientId')}. How can I help you today?",
                    is_complete=True,
                    updated_context={
                        "patient": patient,
                        "patient_id": patient.get("_id"),
                        "patient_uhid": patient.get("patientId")
                    },
                    api_calls_made=self.api_calls
                )
            
            # Multiple matches
            names = [f"{p.get('firstName')} {p.get('lastName')}" for p in patients[:3]]
            return WorkflowResult(
                success=True,
                response_text=f"I found {len(patients)} patients. Could you confirm which one? {', '.join(names)}?",
                is_complete=False,
                updated_context={"step": "disambiguate", "matches": patients}
            )
            
        except Exception as e:
            logger.error("Patient search failed", error=str(e))
            return WorkflowResult(
                success=False,
                response_text="I'm having trouble searching our records. Please try again or I can connect you to the reception desk.",
                is_complete=False,
                error=str(e)
            )
    
    async def _register_patient(
        self,
        entities: Dict[str, Any],
        context: Dict[str, Any]
    ) -> WorkflowResult:
        """Register new patient."""
        
        # Check required fields
        required = ["first_name", "last_name", "phone", "date_of_birth", "gender"]
        missing = self._get_missing_required_fields(Intent.REGISTER_PATIENT, entities)
        
        if missing:
            prompt = self._get_next_prompt(Intent.REGISTER_PATIENT, missing)
            return WorkflowResult(
                success=True,
                response_text=prompt,
                is_complete=False,
                updated_context={
                    "step": "collecting_info",
                    "missing_fields": missing,
                    "collected": entities
                }
            )
        
        # Validate phone
        phone = self._validate_phone(entities.get("phone", ""))
        if not phone:
            return WorkflowResult(
                success=True,
                response_text="The phone number doesn't seem valid. Please provide a 10-digit mobile number.",
                is_complete=False,
                updated_context={"step": "fix_phone"}
            )
        
        # Format date
        dob = self._format_date(entities.get("date_of_birth", ""))
        if not dob:
            return WorkflowResult(
                success=True,
                response_text="I couldn't understand the date of birth. Please say it as day, month, year. For example, 15 January 1985.",
                is_complete=False,
                updated_context={"step": "fix_dob"}
            )
        
        # Check for confirmation in entities (set by continue_workflow), context, or workflow_state
        workflow_state = context.get("workflow_state", {})
        is_confirmed = entities.get("confirmed") or context.get("confirmed") or workflow_state.get("confirmed")
        
        logger.info("REGISTRATION: Confirmation check",
                   is_confirmed=is_confirmed,
                   from_entities=entities.get("confirmed"),
                   from_context=context.get("confirmed"),
                   from_workflow=workflow_state.get("confirmed"))
        
        # Confirm before creating
        if not is_confirmed:
            summary = f"""
            Let me confirm the details:
            Name: {entities.get('first_name')} {entities.get('last_name')}
            Phone: {phone}
            Date of Birth: {dob}
            Gender: {entities.get('gender')}
            
            Is this correct?
            """
            return WorkflowResult(
                success=True,
                response_text=summary.strip().replace('\n            ', '\n'),
                is_complete=False,
                updated_context={
                    "step": "awaiting_confirmation",
                    "validated_phone": phone,
                    "validated_dob": dob,
                    # Preserve all collected data for when user confirms
                    "first_name": entities.get("first_name"),
                    "last_name": entities.get("last_name"),
                    "gender": entities.get("gender"),
                    "email": entities.get("email"),
                    "address": entities.get("address")
                }
            )
        
        # Create patient
        logger.info("REGISTRATION: Creating patient",
                   first_name=entities.get("first_name"),
                   last_name=entities.get("last_name"),
                   phone=phone)
        
        try:
            patient_data = {
                "firstName": entities.get("first_name"),
                "lastName": entities.get("last_name"),
                "phone": phone,
                "dateOfBirth": dob,
                "gender": entities.get("gender").capitalize(),
            }
            
            # Optional fields
            if entities.get("email"):
                patient_data["email"] = entities.get("email")
            if entities.get("address"):
                patient_data["address"] = {"street": entities.get("address")}
            
            logger.info("REGISTRATION: Calling HIS API to create patient")
            result = await self.his_client.create_patient(patient_data)
            
            self._record_api_call("POST", "/patients", patient_data, result, True)
            
            patient_id = result.get("patientId", "")
            logger.info("REGISTRATION: SUCCESS - Patient created",
                       patient_id=patient_id,
                       patient_db_id=result.get("_id"))
            
            patient_id = result.get("patientId", "")
            
            return WorkflowResult(
                success=True,
                response_text=f"Registration complete! Your patient ID is {patient_id}. Please save this number for future visits. How else can I help you today?",
                is_complete=True,
                updated_context={
                    "patient": result,
                    "patient_id": result.get("_id"),
                    "patient_uhid": patient_id
                },
                api_calls_made=self.api_calls
            )
            
        except Exception as e:
            logger.error("Patient creation failed", error=str(e))
            return WorkflowResult(
                success=False,
                response_text="I encountered an issue creating your record. Let me transfer you to the reception desk for assistance.",
                is_complete=False,
                requires_human=True,
                error=str(e)
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
        """Continue registration workflow."""
        
        workflow_state = context.get("workflow_state", {})
        step = workflow_state.get("step", "")
        
        logger.info("=" * 60)
        logger.info("REGISTRATION: continue_workflow called",
                   session_id=session_id,
                   step=step,
                   is_confirmation=is_confirmation,
                   is_denial=is_denial,
                   workflow_state_keys=list(workflow_state.keys()))
        
        # Merge workflow_state into all_entities to preserve collected data
        merged_entities = {**workflow_state, **all_entities, **new_entities}
        
        logger.info("REGISTRATION: Merged entities",
                   merged_keys=list(merged_entities.keys()),
                   first_name=merged_entities.get("first_name"),
                   validated_phone=merged_entities.get("validated_phone"))
        
        if step == "awaiting_confirmation":
            if is_confirmation:
                # User confirmed - create patient
                logger.info("REGISTRATION: User CONFIRMED - proceeding to create patient")
                merged_entities["confirmed"] = True
                return await self._register_patient(merged_entities, context)
            elif is_denial:
                logger.info("REGISTRATION: User DENIED - starting over")
                return WorkflowResult(
                    success=True,
                    response_text="No problem. Let's start over. What is the patient's first name?",
                    is_complete=False,
                    updated_context={"step": "collecting_info", "collected": {}}
                )
        
        if step == "offer_registration":
            if is_confirmation:
                return WorkflowResult(
                    success=True,
                    response_text="Let's register you as a new patient. What is your first name?",
                    is_complete=False,
                    updated_context={"step": "collecting_info"}
                )
        
        # Default: continue with merged entities
        return await self._register_patient(merged_entities, context)

