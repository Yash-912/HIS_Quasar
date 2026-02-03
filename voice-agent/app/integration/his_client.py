"""
HIS API Client
Wrapper for communicating with Hospital Information System backend
"""

import httpx
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
import structlog

logger = structlog.get_logger()


class HISClient:
    """
    HTTP client for HIS backend API.
    Handles authentication, token refresh, and all API calls.
    """
    
    def __init__(
        self,
        base_url: str,
        username: str,
        password: str,
        timeout: float = 30.0
    ):
        """
        Initialize HIS client.
        
        Args:
            base_url: HIS API base URL (e.g., http://localhost:5001/api)
            username: Service account username
            password: Service account password
            timeout: Request timeout in seconds
        """
        self.base_url = base_url.rstrip('/')
        self.username = username
        self.password = password
        self.timeout = timeout
        
        self._token: Optional[str] = None
        self._token_expiry: Optional[datetime] = None
        self._client: Optional[httpx.AsyncClient] = None
    
    @property
    def is_authenticated(self) -> bool:
        """Check if client has valid authentication."""
        if not self._token:
            return False
        if self._token_expiry and datetime.now() >= self._token_expiry:
            return False
        return True
    
    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                timeout=self.timeout,
                headers={"Content-Type": "application/json"}
            )
        return self._client
    
    async def authenticate(self) -> bool:
        """
        Authenticate with HIS backend.
        
        Returns:
            True if authentication successful
        """
        try:
            client = await self._get_client()
            
            response = await client.post(
                "/auth/login",
                json={
                    "email": self.username,
                    "password": self.password
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                self._token = data.get("accessToken") or data.get("token")
                # Assume token valid for 24 hours, refresh before expiry
                self._token_expiry = datetime.now() + timedelta(hours=23)
                
                logger.info("HIS authentication successful", username=self.username)
                return True
            else:
                logger.error("HIS authentication failed", 
                           status=response.status_code,
                           response=response.text)
                return False
                
        except Exception as e:
            logger.error("HIS authentication error", error=str(e))
            raise
    
    async def _ensure_authenticated(self):
        """Ensure we have valid authentication before making requests."""
        if not self.is_authenticated:
            await self.authenticate()
    
    def _get_headers(self) -> Dict[str, str]:
        """Get request headers with authentication."""
        return {
            "Authorization": f"Bearer {self._token}",
            "Content-Type": "application/json"
        }
    
    async def _request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict] = None,
        params: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Make authenticated request to HIS API.
        
        Args:
            method: HTTP method (GET, POST, PUT, DELETE)
            endpoint: API endpoint (without base URL)
            data: Request body for POST/PUT
            params: Query parameters
            
        Returns:
            Response JSON data
        """
        await self._ensure_authenticated()
        client = await self._get_client()
        
        try:
            response = await client.request(
                method=method,
                url=endpoint,
                json=data,
                params=params,
                headers=self._get_headers()
            )
            
            logger.info("HIS_CLIENT: API call completed",
                        method=method,
                        endpoint=endpoint,
                        status=response.status_code)
            
            if response.status_code >= 400:
                error_data = response.json() if response.text else {}
                logger.error("HIS API error",
                           status=response.status_code,
                           error=error_data)
                raise HISAPIError(
                    status_code=response.status_code,
                    message=error_data.get("error", "Unknown error"),
                    endpoint=endpoint
                )
            
            return response.json()
            
        except httpx.RequestError as e:
            logger.error("HIS API request failed", error=str(e))
            raise
    
    async def close(self):
        """Close HTTP client."""
        if self._client:
            await self._client.aclose()
            self._client = None
    
    # =========================================================================
    # Patient APIs
    # =========================================================================
    
    async def search_patients(
        self,
        query: Optional[str] = None,
        phone: Optional[str] = None,
        patient_id: Optional[str] = None
    ) -> List[Dict]:
        """
        Search for patients.
        
        Args:
            query: Search text (name, phone, or patientId)
            phone: Phone number (will be used as query if query is not provided)
            patient_id: Patient ID (UHID) (will be used as query if query/phone not provided)
        """
        # HIS backend expects a single 'query' parameter that searches across
        # patientId, firstName, lastName, and phone fields
        search_term = query or phone or patient_id
        
        if not search_term:
            logger.warning("Patient search called without any search criteria")
            return []
        
        params = {"query": search_term}
        
        result = await self._request("GET", "/patients/search", params=params)
        return result.get("data", [])
    
    async def get_patient(self, patient_id: str) -> Dict:
        """Get patient by ID."""
        result = await self._request("GET", f"/patients/{patient_id}")
        return result.get("data", {})
    
    async def create_patient(self, patient_data: Dict) -> Dict:
        """
        Create new patient.
        
        Args:
            patient_data: Patient details (firstName, lastName, phone, dob, gender, etc.)
        """
        result = await self._request("POST", "/patients", data=patient_data)
        return result.get("data", {})
    
    # =========================================================================
    # Department APIs
    # =========================================================================
    
    async def get_departments(self) -> List[Dict]:
        """Get all departments."""
        result = await self._request("GET", "/departments")
        return result.get("data", [])
    
    async def get_department_doctors(self, department_id: str) -> List[Dict]:
        """Get doctors in a department."""
        result = await self._request("GET", f"/departments/{department_id}/doctors")
        return result.get("data", [])
    
    # =========================================================================
    # Appointment APIs
    # =========================================================================
    
    async def create_appointment(self, appointment_data: Dict) -> Dict:
        """
        Create OPD appointment.
        
        Args:
            appointment_data: {patient, doctor, department, scheduledDate, scheduledTime, chiefComplaint}
        """
        result = await self._request("POST", "/opd/appointments", data=appointment_data)
        return result.get("data", {})
    
    async def get_appointments(
        self,
        patient_id: Optional[str] = None,
        status: Optional[str] = None,
        date: Optional[str] = None
    ) -> List[Dict]:
        """Get appointments with filters."""
        params = {}
        if patient_id:
            params["patient"] = patient_id
        if status:
            params["status"] = status
        if date:
            params["date"] = date
        
        result = await self._request("GET", "/opd/appointments", params=params)
        return result.get("data", [])
    
    async def checkin_appointment(self, appointment_id: str) -> Dict:
        """Check in patient for appointment."""
        result = await self._request("PUT", f"/opd/appointments/{appointment_id}/checkin")
        return result.get("data", {})
    
    async def get_opd_queue(self) -> List[Dict]:
        """Get current OPD queue."""
        result = await self._request("GET", "/opd/queue")
        return result.get("data", [])
    
    # =========================================================================
    # Bed APIs
    # =========================================================================
    
    async def get_bed_availability(self) -> Dict:
        """Get bed availability summary."""
        result = await self._request("GET", "/beds/availability")
        return result.get("data", {})
    
    async def get_beds(self, status: Optional[str] = None) -> List[Dict]:
        """Get all beds with optional status filter."""
        params = {"status": status} if status else {}
        result = await self._request("GET", "/beds", params=params)
        return result.get("data", [])
    
    async def allocate_bed(self, patient_id: str, bed_id: str) -> Dict:
        """Allocate bed to patient."""
        result = await self._request("POST", "/beds/allocate", data={
            "patient": patient_id,
            "bed": bed_id
        })
        return result.get("data", {})
    
    # =========================================================================
    # IPD APIs
    # =========================================================================
    
    async def create_admission(self, admission_data: Dict) -> Dict:
        """Create IPD admission."""
        result = await self._request("POST", "/ipd/admissions", data=admission_data)
        return result.get("data", {})
    
    async def get_admission_requests(self) -> List[Dict]:
        """Get pending admission requests."""
        result = await self._request("GET", "/ipd/requests")
        return result.get("data", [])
    
    # =========================================================================
    # Emergency APIs
    # =========================================================================
    
    async def create_emergency_case(self, case_data: Dict) -> Dict:
        """Create emergency case."""
        result = await self._request("POST", "/emergency/cases", data=case_data)
        return result.get("data", {})
    
    async def get_emergency_queue(self) -> List[Dict]:
        """Get emergency queue sorted by triage."""
        result = await self._request("GET", "/emergency/queue")
        return result.get("data", [])
    
    # =========================================================================
    # Lab APIs
    # =========================================================================
    
    async def get_lab_tests(self) -> List[Dict]:
        """Get available lab tests."""
        result = await self._request("GET", "/lab/tests")
        return result.get("data", [])
    
    async def get_lab_orders(self, patient_id: Optional[str] = None) -> List[Dict]:
        """Get lab orders for patient."""
        params = {"patient": patient_id} if patient_id else {}
        result = await self._request("GET", "/lab/orders", params=params)
        return result.get("data", [])
    
    # =========================================================================
    # Billing APIs
    # =========================================================================
    
    async def get_patient_bills(self, patient_id: str) -> List[Dict]:
        """Get bills for a patient."""
        result = await self._request("GET", f"/billing/patient/{patient_id}")
        return result.get("data", [])


class HISAPIError(Exception):
    """Exception for HIS API errors."""
    
    def __init__(self, status_code: int, message: str, endpoint: str):
        self.status_code = status_code
        self.message = message
        self.endpoint = endpoint
        super().__init__(f"HIS API Error [{status_code}] on {endpoint}: {message}")
