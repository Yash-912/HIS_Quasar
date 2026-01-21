# Product Requirements Document (PRD)
Hospital Information System (HIS) with AI Integration

## Executive Summary
A comprehensive, unified Hospital Information System built on MERN stack that digitizes end-to-end hospital operations with integrated AI capabilities for revenue leakage detection and predictive analytics.

## Tech Stack
### Core Technologies

- **Frontend:** React.js, Redux, Material-UI/Ant Design
- **Backend:** Node.js, Express.js
- **Database:** MongoDB
- **AI/ML:** Python (scikit-learn, pandas, Prophet/ARIMA)
- **Communication:** Socket.io (real-time updates), REST APIs
- **Authentication:** JWT, bcrypt
- **File Storage:** AWS S3 / Local storage
- **Reporting:** PDFKit, ExcelJS

---

## Complete File Structure

### Backend Architecture (Node.js + Express)
```
hospital-his-backend/
│
├── config/
│   ├── ✅ database.js                 # MongoDB connection
│   ├── ✅ config.js                   # Environment variables
│   ├── ✅ aws.js                      # AWS S3 configuration
│   └── ✅ constants.js                # System constants
│
├── models/
│   ├── ✅ User.js                     # All user types with roles
│   ├── ✅ Patient.js                  # Patient demographics & records
│   ├── ✅ Appointment.js              # OPD/IPD appointments
│   ├── ✅ Admission.js                # IPD admissions
│   ├── ✅ Emergency.js                # Emergency records
│   ├── ✅ EMR.js                      # Electronic Medical Records
│   ├── ✅ Prescription.js             # Prescriptions
│   ├── ✅ LabTest.js                  # Lab orders & results
│   ├── ✅ LabTestMaster.js            # Lab test catalog
│   ├── ✅ Radiology.js                # Radiology orders & reports
│   ├── ✅ RadiologyMaster.js          # Radiology test catalog
│   ├── ✅ Surgery.js                  # OT schedules & records
│   ├── ✅ Medicine.js                 # Medicine master
│   ├── ✅ PharmacyDispense.js         # Medicine dispensing records
│   ├── ✅ PharmacyInventory.js        # Pharmacy stock
│   ├── ✅ Billing.js                  # Bills & invoices
│   ├── ✅ BillingItem.js              # Individual billing items
│   ├── ✅ Payment.js                  # Payment transactions
│   ├── ✅ Insurance.js                # Insurance claims
│   ├── ✅ InsuranceProvider.js        # Insurance company master
│   ├── ✅ Inventory.js                # Hospital inventory items
│   ├── ✅ InventoryTransaction.js     # Stock in/out records
│   ├── ✅ Department.js               # Department master
│   ├── ✅ Bed.js                      # Bed master & allocation
│   ├── ✅ Ward.js                     # Ward master
│   ├── ✅ Tariff.js                   # Service pricing master
│   ├── ✅ TariffCategory.js           # Tariff categories
│   ├── ✅ Staff.js                    # Staff/HR records
│   ├── ✅ Attendance.js               # Staff attendance
│   ├── ✅ AuditLog.js                 # System audit trails
│   ├── ✅ Notification.js             # System notifications
│   ├── ✅ AIAnomaly.js                # AI-detected anomalies
│   ├── ✅ AIPrediction.js             # AI predictions & forecasts
│   ├── 🆕 PatientMerge.js             # Patient merge records & audit
│   ├── 🆕 ConsentRecord.js            # Patient consent tracking
│   ├── 🆕 OrderSet.js                 # Emergency order sets (trauma, cardiac, stroke)
│   ├── 🆕 DrugInteraction.js          # Drug interaction rules
│   ├── 🆕 AllergyAlert.js             # Allergy alert configuration
│   ├── 🆕 CriticalValue.js            # Critical lab value thresholds
│   ├── 🆕 VitalSignAlert.js           # Vital sign abnormality rules
│   ├── 🆕 OTChecklist.js              # WHO surgical safety checklist
│   ├── 🆕 PreOpAssessment.js          # Pre-operative assessment records
│   ├── 🆕 IntraOpNotes.js             # Intra-operative notes
│   ├── 🆕 PostOpOrders.js             # Post-operative orders
│   ├── 🆕 InfectionControl.js         # OT infection control tracking
│   ├── 🆕 ImplantConsumable.js        # OT implants & consumables tracking
│   ├── 🆕 BedCleaning.js              # Bed cleaning status tracking
│   ├── 🆕 IncidentReport.js           # Risk & incident management
│   ├── 🆕 NearMiss.js                 # Near-miss logging
│   ├── 🆕 RiskAssessment.js           # Risk assessment records
│   ├── 🆕 CAPA.js                     # Corrective & Preventive Action tracking
│   ├── 🆕 NursingCareFlow.js          # Nursing workflows & care plans
│   ├── 🆕 MedicationAdministration.js # Medication Administration Record (MAR)
│   ├── 🆕 ShiftHandover.js            # Nursing shift handover logs
│   ├── 🆕 ResourceUtilization.js      # Resource tracking (beds, equipment, staff)
│   ├── 🆕 ClinicalCoding.js           # CPT/ICD coding records
│   ├── 🆕 PurchaseOrder.js            # Inventory purchase orders
│   ├── 🆕 GRN.js                      # Goods Receipt Note
│   ├── 🆕 VendorMaster.js             # Vendor management
│   ├── 🆕 DrugRecall.js               # Drug recall tracking
│   └── 🆕 TPAProvider.js              # TPA (Third Party Administrator) master
│
├── routes/
│   ├── ✅ auth.routes.js              # Login, logout, token refresh
│   ├── ✅ patient.routes.js           # Patient CRUD & search
│   ├── ✅ opd.routes.js               # OPD management
│   ├── ✅ ipd.routes.js               # IPD management
│   ├── ✅ emergency.routes.js         # Emergency management
│   ├── ✅ emr.routes.js               # EMR endpoints
│   ├── ✅ prescription.routes.js      # Prescription management
│   ├── ✅ lab.routes.js               # Lab orders & results
│   ├── ✅ radiology.routes.js         # Radiology orders & reports
│   ├── ✅ pharmacy.routes.js          # Pharmacy operations
│   ├── ✅ billing.routes.js           # Billing & invoicing
│   ├── ✅ payment.routes.js           # Payment processing
│   ├── ✅ insurance.routes.js         # Insurance claims
│   ├── ✅ surgery.routes.js           # OT scheduling
│   ├── ✅ inventory.routes.js         # Inventory management
│   ├── ✅ bed.routes.js               # Bed management
│   ├── ✅ staff.routes.js             # HR/Staff management
│   ├── ✅ department.routes.js        # Department management
│   ├── ✅ tariff.routes.js            # Tariff management
│   ├── ✅ analytics.routes.js         # Dashboard & reports
│   ├── ✅ ai.routes.js                # AI endpoints (both models)
│   ├── ✅ notification.routes.js      # Notifications
│   ├── ✅ admin.routes.js             # Admin configurations
│   ├── 🆕 nursing.routes.js           # Nursing workflows & MAR
│   ├── 🆕 safety.routes.js            # Safety alerts & warnings
│   ├── 🆕 incident.routes.js          # Risk & incident management
│   ├── 🆕 coding.routes.js            # Clinical coding (CPT/ICD)
│   └── 🆕 resource.routes.js          # Resource utilization tracking
│
├── controllers/
│   ├── ✅ auth.controller.js
│   ├── ✅ patient.controller.js
│   ├── ✅ opd.controller.js
│   ├── ✅ ipd.controller.js
│   ├── ✅ emergency.controller.js
│   ├── ✅ emr.controller.js
│   ├── ✅ prescription.controller.js
│   ├── ✅ lab.controller.js
│   ├── ✅ radiology.controller.js
│   ├── ✅ pharmacy.controller.js
│   ├── ✅ billing.controller.js
│   ├── ✅ payment.controller.js
│   ├── ✅ insurance.controller.js
│   ├── ✅ surgery.controller.js
│   ├── ✅ inventory.controller.js
│   ├── ✅ bed.controller.js
│   ├── ✅ staff.controller.js
│   ├── ✅ department.controller.js
│   ├── ✅ tariff.controller.js
│   ├── ✅ analytics.controller.js
│   ├── ✅ ai.controller.js            # Calls Python ML services
│   ├── ✅ notification.controller.js
│   ├── ✅ admin.controller.js
│   ├── 🆕 nursing.controller.js
│   ├── 🆕 safety.controller.js
│   ├── 🆕 incident.controller.js
│   ├── 🆕 coding.controller.js
│   └── 🆕 resource.controller.js
│
├── middleware/
│   ├── auth.middleware.js          # JWT verification
│   ├── rbac.middleware.js          # Role-based access control
│   ├── validation.middleware.js    # Request validation
│   ├── error.middleware.js         # Error handling
│   ├── audit.middleware.js         # Audit logging
│   ├── upload.middleware.js        # File upload handling
│   └── 🆕 breakglass.middleware.js # Emergency override (break-glass) access
│
├── services/
│   ├── patient.service.js          # Patient business logic
│   ├── appointment.service.js      # Appointment scheduling
│   ├── billing.service.js          # Billing calculations
│   ├── insurance.service.js        # Insurance processing
│   ├── inventory.service.js        # Stock management
│   ├── notification.service.js     # Email/SMS/Push notifications
│   ├── report.service.js           # Report generation
│   ├── pdf.service.js              # PDF generation
│   ├── excel.service.js            # Excel generation
│   ├── socket.service.js           # Real-time updates
│   ├── ml.service.js               # ML API caller (Python bridge)
│   ├── 🆕 duplicateDetection.service.js # Duplicate patient detection
│   ├── 🆕 patientMerge.service.js  # Patient merge logic
│   ├── 🆕 safetyAlert.service.js   # Safety alerts orchestration
│   ├── 🆕 orderSet.service.js      # Emergency order sets
│   ├── 🆕 drugInteraction.service.js # Drug interaction checking
│   ├── 🆕 coding.service.js        # ICD/CPT coding validation
│   └── 🆕 autosave.service.js      # Auto-save & network failure handling
│
├── utils/
│   ├── validators.js               # Input validators
│   ├── helpers.js                  # Helper functions
│   ├── encryption.js               # Password hashing
│   ├── date.utils.js               # Date utilities
│   ├── response.js                 # Standard API responses
│   ├── logger.js                   # Winston logger
│   └── 🆕 icd.validator.js         # ICD-10/ICD-11 validation
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── socket/
│   └── socket.handler.js           # Socket.io event handlers
│
├── scripts/
│   ├── seed.js                     # Database seeding
│   └── migrate.js                  # Data migration
│
├── .env.example                     # Environment template
├── .gitignore
├── package.json
├── package-lock.json
├── server.js                        # Entry point
└── README.md
```

### ML Services (Python - Microservices)
```
hospital-his-ml/
│
├── revenue_leakage/
│   ├── app.py                      # Flask API for revenue ML
│   ├── data_processor.py           # Data preprocessing
│   ├── anomaly_detector.py         # Isolation Forest model
│   ├── pattern_analyzer.py         # Rule-based patterns
│   ├── alert_generator.py          # Alert generation logic
│   ├── model_trainer.py            # Model training scripts
│   ├── models/
│   │   └── isolation_forest.pkl    # Trained model
│   ├── config.py                   # ML config
│   └── requirements.txt
│
├── predictive_analytics/
│   ├── app.py                      # Flask API for predictions
│   ├── time_series.py              # Prophet/ARIMA implementation
│   ├── opd_predictor.py            # OPD rush hour prediction
│   ├── bed_predictor.py            # Bed occupancy forecasting
│   ├── lab_predictor.py            # Lab workload forecasting
│   ├── models/
│   │   ├── opd_prophet.pkl
│   │   ├── bed_arima.pkl
│   │   └── lab_prophet.pkl
│   ├── config.py
│   └── requirements.txt
│
├── shared/
│   ├── db_connector.py             # MongoDB connection
│   └── utils.py                    # Shared utilities
│
├── docker-compose.yml              # Multi-service setup
└── README.md
```

### Frontend Architecture (React.js)
```
hospital-his-frontend/
│
├── public/
│   ├── index.html
│   ├── favicon.ico
│   ├── manifest.json
│   └── assets/
│       ├── images/
│       ├── icons/
│       └── fonts/
│
├── src/
│   ├── App.js                      # Main app component
│   ├── index.js                    # Entry point
│   ├── routes.js                   # Route definitions
│   │
│   ├── components/
│   │   ├── common/
│   │   │   ├── Header.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   ├── Footer.jsx
│   │   │   ├── Loader.jsx
│   │   │   ├── Modal.jsx
│   │   │   ├── DataTable.jsx
│   │   │   ├── SearchBar.jsx
│   │   │   ├── Notification.jsx
│   │   │   ├── ConfirmDialog.jsx
│   │   │   ├── DatePicker.jsx
│   │   │   ├── FileUpload.jsx
│   │   │   └── PrintPreview.jsx
│   │   │
│   │   ├── auth/
│   │   │   ├── Login.jsx
│   │   │   ├── ForgotPassword.jsx
│   │   │   └── ChangePassword.jsx
│   │   │
│   │   ├── patient/
│   │   │   ├── PatientRegistration.jsx
│   │   │   ├── PatientSearch.jsx
│   │   │   ├── PatientProfile.jsx
│   │   │   ├── PatientHistory.jsx
│   │   │   ├── PatientCard.jsx
│   │   │   ├── 🆕 DuplicateDetection.jsx
│   │   │   ├── 🆕 PatientMerge.jsx
│   │   │   ├── 🆕 EmergencyRegistration.jsx
│   │   │   └── 🆕 ConsentManagement.jsx
│   │   │
│   │   ├── opd/
│   │   │   ├── OPDQueue.jsx
│   │   │   ├── OPDConsultation.jsx
│   │   │   ├── OPDAppointment.jsx
│   │   │   ├── OPDBilling.jsx
│   │   │   └── OPDDashboard.jsx
│   │   │
│   │   ├── ipd/
│   │   │   ├── IPDAdmission.jsx
│   │   │   ├── IPDPatientList.jsx
│   │   │   ├── IPDCaseSheet.jsx
│   │   │   ├── IPDDischarge.jsx
│   │   │   └── IPDDashboard.jsx
│   │   │
│   │   ├── emergency/
│   │   │   ├── EmergencyTriage.jsx
│   │   │   ├── EmergencyQueue.jsx
│   │   │   ├── EmergencyTreatment.jsx
│   │   │   ├── EmergencyDashboard.jsx
│   │   │   ├── 🆕 EmergencyOrderSets.jsx
│   │   │   ├── 🆕 MedicoLegalCase.jsx
│   │   │   └── 🆕 DowntimeMode.jsx
│   │   │
│   │   ├── emr/
│   │   │   ├── EMRView.jsx
│   │   │   ├── VitalsEntry.jsx
│   │   │   ├── ProgressNotes.jsx
│   │   │   ├── ClinicalDocuments.jsx
│   │   │   ├── PatientTimeline.jsx
│   │   │   ├── 🆕 AllergyManagement.jsx
│   │   │   └── 🆕 VersionHistory.jsx
│   │   │
│   │   ├── lab/
│   │   │   ├── LabOrderEntry.jsx
│   │   │   ├── LabWorkQueue.jsx
│   │   │   ├── LabResultEntry.jsx
│   │   │   ├── LabReportViewer.jsx
│   │   │   ├── LabDashboard.jsx
│   │   │   ├── 🆕 CriticalValueAlerts.jsx
│   │   │   └── 🆕 SampleTracking.jsx
│   │   │
│   │   ├── radiology/
│   │   │   ├── RadiologyOrderEntry.jsx
│   │   │   ├── RadiologyWorkQueue.jsx
│   │   │   ├── RadiologyReportEntry.jsx
│   │   │   ├── RadiologyImageViewer.jsx
│   │   │   ├── RadiologyDashboard.jsx
│   │   │   └── 🆕 ReportApproval.jsx
│   │   │
│   │   ├── pharmacy/
│   │   │   ├── PharmacyQueue.jsx
│   │   │   ├── MedicineDispense.jsx
│   │   │   ├── PharmacyInventory.jsx
│   │   │   ├── StockManagement.jsx
│   │   │   ├── ExpiryMonitor.jsx
│   │   │   ├── PharmacyDashboard.jsx
│   │   │   ├── 🆕 DrugInteractionAlerts.jsx
│   │   │   ├── 🆕 DrugRecallManagement.jsx
│   │   │   ├── 🆕 BatchTracking.jsx
│   │   │   └── 🆕 PatientStockMapping.jsx
│   │   │
│   │   ├── surgery/
│   │   │   ├── OTSchedule.jsx
│   │   │   ├── SurgeryBooking.jsx
│   │   │   ├── OTRoster.jsx
│   │   │   ├── SurgeryNotes.jsx
│   │   │   ├── OTDashboard.jsx
│   │   │   ├── 🆕 PreOpAssessment.jsx
│   │   │   ├── 🆕 WHOSafetyChecklist.jsx
│   │   │   ├── 🆕 IntraOpNotes.jsx
│   │   │   ├── 🆕 PostOpOrders.jsx
│   │   │   ├── 🆕 ImplantTracking.jsx
│   │   │   ├── 🆕 AnesthesiaRecords.jsx
│   │   │   └── 🆕 InfectionControlLog.jsx
│   │   │
│   │   ├── billing/
│   │   │   ├── BillGeneration.jsx
│   │   │   ├── BillSearch.jsx
│   │   │   ├── PaymentCollection.jsx
│   │   │   ├── CreditBills.jsx
│   │   │   ├── BillCancellation.jsx
│   │   │   ├── RevenueLeakageAlerts.jsx  # AI Component
│   │   │   ├── BillingDashboard.jsx
│   │   │   ├── 🆕 AutoChargeCapture.jsx
│   │   │   └── 🆕 DiscountApproval.jsx
│   │   │
│   │   ├── insurance/
│   │   │   ├── InsuranceVerification.jsx
│   │   │   ├── ClaimSubmission.jsx
│   │   │   ├── ClaimTracking.jsx
│   │   │   ├── PreAuthorization.jsx
│   │   │   ├── InsuranceDashboard.jsx
│   │   │   ├── 🆕 TPAManagement.jsx
│   │   │   ├── 🆕 PackageMapping.jsx
│   │   │   ├── 🆕 RejectionTracking.jsx
│   │   │   └── 🆕 SettlementTracking.jsx
│   │   │
│   │   ├── bed/
│   │   │   ├── BedAllocation.jsx
│   │   │   ├── BedTransfer.jsx
│   │   │   ├── BedOccupancyView.jsx
│   │   │   ├── WardManagement.jsx
│   │   │   ├── BedPredictiveAnalytics.jsx  # AI Component
│   │   │   ├── 🆕 CleaningStatus.jsx
│   │   │   └── 🆕 TimeTracking.jsx
│   │   │
│   │   ├── inventory/
│   │   │   ├── InventoryList.jsx
│   │   │   ├── StockEntry.jsx
│   │   │   ├── StockIssue.jsx
│   │   │   ├── StockAdjustment.jsx
│   │   │   ├── PurchaseOrder.jsx
│   │   │   ├── VendorManagement.jsx
│   │   │   ├── InventoryDashboard.jsx
│   │   │   ├── 🆕 GRNManagement.jsx
│   │   │   ├── 🆕 StockReturn.jsx
│   │   │   └── 🆕 ConsumptionTracking.jsx
│   │   │
│   │   ├── hr/
│   │   │   ├── StaffDirectory.jsx
│   │   │   ├── StaffRegistration.jsx
│   │   │   ├── AttendanceManagement.jsx
│   │   │   ├── LeaveManagement.jsx
│   │   │   ├── ShiftRoster.jsx
│   │   │   └── HRDashboard.jsx
│   │   │
│   │   ├── analytics/
│   │   │   ├── ExecutiveDashboard.jsx
│   │   │   ├── ClinicalAnalytics.jsx
│   │   │   ├── FinancialAnalytics.jsx
│   │   │   ├── OperationalAnalytics.jsx
│   │   │   ├── OPDPredictiveAnalytics.jsx   # AI Component
│   │   │   ├── LabWorkloadForecast.jsx      # AI Component
│   │   │   ├── CustomReports.jsx
│   │   │   └── 🆕 PatientFlowAnalysis.jsx
│   │   │
│   │   ├── admin/
│   │   │   ├── UserManagement.jsx
│   │   │   ├── RolePermissions.jsx
│   │   │   ├── DepartmentMaster.jsx
│   │   │   ├── TariffMaster.jsx
│   │   │   ├── ServiceMaster.jsx
│   │   │   ├── AuditLogs.jsx
│   │   │   ├── SystemConfiguration.jsx
│   │   │   ├── BackupRestore.jsx
│   │   │   └── 🆕 ComplianceReports.jsx
│   │   │
│   │   ├── 🆕 nursing/
│   │   │   ├── 🆕 NursingDashboard.jsx
│   │   │   ├── 🆕 PatientCareWorkflow.jsx
│   │   │   ├── 🆕 VitalsRecording.jsx
│   │   │   ├── 🆕 NursingNotes.jsx
│   │   │   ├── 🆕 MedicationAdministration.jsx
│   │   │   ├── 🆕 CarePlanManagement.jsx
│   │   │   ├── 🆕 ShiftHandover.jsx
│   │   │   └── 🆕 CriticalAlerts.jsx
│   │   │
│   │   ├── 🆕 safety/
│   │   │   ├── 🆕 SafetyAlertsDashboard.jsx
│   │   │   ├── 🆕 AllergyAlerts.jsx
│   │   │   ├── 🆕 DrugInteractionWarnings.jsx
│   │   │   ├── 🆕 CriticalLabAlerts.jsx
│   │   │   ├── 🆕 VitalSignAlerts.jsx
│   │   │   └── 🆕 DuplicateOrderWarnings.jsx
│   │   │
│   │   ├── 🆕 incident/
│   │   │   ├── 🆕 IncidentReporting.jsx
│   │   │   ├── 🆕 NearMissLogging.jsx
│   │   │   ├── 🆕 RiskAssessment.jsx
│   │   │   ├── 🆕 CAPATracking.jsx
│   │   │   └── 🆕 IncidentDashboard.jsx
│   │   │
│   │   ├── 🆕 coding/
│   │   │   ├── 🆕 ClinicalCoding.jsx
│   │   │   ├── 🆕 ICDMapping.jsx
│   │   │   ├── 🆕 CPTMapping.jsx
│   │   │   ├── 🆕 CodeAudit.jsx
│   │   │   └── 🆕 MandatoryCodingCheck.jsx
│   │   │
│   │   ├── 🆕 resource/
│   │   │   ├── 🆕 ResourceDashboard.jsx
│   │   │   ├── 🆕 BedOccupancyTracking.jsx
│   │   │   ├── 🆕 EquipmentUsage.jsx
│   │   │   ├── 🆕 StaffShiftAssignment.jsx
│   │   │   ├── 🆕 ConsumablesMonitor.jsx
│   │   │   └── 🆕 ShortageAlerts.jsx
│   │   │
│   │   └── notifications/
│   │       ├── NotificationCenter.jsx
│   │       ├── NotificationBell.jsx
│   │       └── NotificationSettings.jsx
│   │
│   ├── redux/
│   │   ├── store.js                # Redux store configuration
│   │   ├── rootReducer.js          # Combine all reducers
│   │   │
│   │   ├── slices/
│   │   │   ├── authSlice.js
│   │   │   ├── patientSlice.js
│   │   │   ├── opdSlice.js
│   │   │   ├── ipdSlice.js
│   │   │   ├── emergencySlice.js
│   │   │   ├── labSlice.js
│   │   │   ├── radiologySlice.js
│   │   │   ├── pharmacySlice.js
│   │   │   ├── billingSlice.js
│   │   │   ├── insuranceSlice.js
│   │   │   ├── bedSlice.js
│   │   │   ├── inventorySlice.js
│   │   │   ├── staffSlice.js
│   │   │   ├── analyticsSlice.js
│   │   │   ├── aiSlice.js          # AI features state
│   │   │   ├── notificationSlice.js
│   │   │   ├── 🆕 nursingSlice.js
│   │   │   ├── 🆕 safetySlice.js
│   │   │   ├── 🆕 incidentSlice.js
│   │   │   ├── 🆕 codingSlice.js
│   │   │   └── 🆕 resourceSlice.js
│   │   │
│   │   └── thunks/
│   │       ├── patientThunks.js    # Async actions
│   │       ├── billingThunks.js
│   │       ├── aiThunks.js         # AI API calls
│   │       ├── 🆕 nursingThunks.js
│   │       ├── 🆕 safetyThunks.js
│   │       └── ...
││
│   ├── services/
│   │   ├── api.js                  # Axios configuration
│   │   ├── auth.service.js
│   │   ├── patient.service.js
│   │   ├── opd.service.js
│   │   ├── ipd.service.js
│   │   ├── emergency.service.js
│   │   ├── lab.service.js
│   │   ├── radiology.service.js
│   │   ├── pharmacy.service.js
│   │   ├── billing.service.js
│   │   ├── insurance.service.js
│   │   ├── bed.service.js
│   │   ├── inventory.service.js
│   │   ├── staff.service.js
│   │   ├── analytics.service.js
│   │   ├── ai.service.js           # ML API calls
│   │   ├── notification.service.js
│   │   ├── socket.service.js       # Socket.io client
│   │   ├── report.service.js
│   │   ├── 🆕 nursing.service.js
│   │   ├── 🆕 safety.service.js
│   │   ├── 🆕 incident.service.js
│   │   ├── 🆕 coding.service.js
│   │   └── 🆕 resource.service.js
│   │
│   ├── utils/
│   │   ├── constants.js            # App constants
│   │   ├── helpers.js              # Helper functions
│   │   ├── validators.js           # Form validators
│   │   ├── permissions.js          # RBAC helpers
│   │   ├── dateUtils.js            # Date formatting
│   │   └── exportUtils.js          # Export to PDF/Excel
│   │
│   ├── hooks/
│   │   ├── useAuth.js              # Authentication hook
│   │   ├── useSocket.js            # Socket.io hook
│   │   ├── useNotification.js      # Notification hook
│   │   ├── usePagination.js        # Pagination hook
│   │   └── useDebounce.js          # Debounce hook
│   │
│   ├── styles/
│   │   ├── global.css              # Global styles
│   │   ├── variables.css           # CSS variables
│   │   └── themes/
│   │       ├── light.css
│   │       └── dark.css
│   │
│   ├── config/
│   │   ├── routes.config.js        # Route configurations
│   │   └── permissions.config.js   # Role permissions
│   │
│   └── tests/
│       ├── components/
│       ├── services/
│       └── utils/
│
├── .env.example
├── .gitignore
├── package.json
├── package-lock.json
├── craco.config.js                 # If using CRACO
└── README.md
```

---

## Database Schema (MongoDB Collections)

### Core Collections

```javascript
// users
{
  _id: ObjectId,
  username: String,
  email: String,
  password: String (hashed),
  role: String, // doctor, nurse, receptionist, lab_tech, radiologist, pharmacist, billing, insurance, admin, compliance
  department: ObjectId (ref: Department),
  profile: {
    firstName: String,
    lastName: String,
    phone: String,
    qualification: String,
    specialization: String,
    registrationNumber: String
  },
  isActive: Boolean,
  lastLogin: Date,
  createdAt: Date,
  updatedAt: Date
}

// patients
{
  _id: ObjectId,
  patientId: String (unique, auto-generated, UHID),
  🆕 isDuplicate: Boolean,
  🆕 mergedWith: ObjectId (ref: Patient),
  🆕 duplicateScore: Number,
  🆕 idProof: {
    type: String,
    number: String,
    imageUrl: String
  },
  firstName: String,
  lastName: String,
  dateOfBirth: Date,
  gender: String,
  phone: String,
  email: String,
  address: {
    street: String,
    city: String,
    state: String,
    pincode: String
  },
  emergencyContact: {
    name: String,
    relationship: String,
    phone: String
  },
  bloodGroup: String,
  allergies: [String],
  🆕 allergyAlerts: [{
    allergen: String,
    severity: String,
    reaction: String,
    addedAt: Date,
    addedBy: ObjectId (ref: User)
  }],
  medicalHistory: [String],
  insuranceDetails: {
    provider: ObjectId (ref: InsuranceProvider),
    policyNumber: String,
    validTill: Date
  },
  createdAt: Date,
  updatedAt: Date,
  🆕 editHistory: [{
    field: String,
    oldValue: Mixed,
    newValue: Mixed,
    editedBy: ObjectId (ref: User),
    editedAt: Date,
    reason: String
  }]
}

🆕 // patient_merges
{
  _id: ObjectId,
  sourcePatientsIds: [ObjectId] (ref: Patient),
  targetPatientId: ObjectId (ref: Patient),
  mergedBy: ObjectId (ref: User),
  mergedAt: Date,
  reason: String,
  dataMapping: Object,
  auditTrail: [{
    action: String,
    timestamp: Date,
    details: Object
  }]
}

🆕 // consent_records
{
  _id: ObjectId,
  patient: ObjectId (ref: Patient),
  consentType: String, // surgery, procedure, treatment, disclosure
  description: String,
  consentGivenBy: String,
  relationship: String,
  witness: ObjectId (ref: User),
  documentUrl: String,
  digitalSignature: String,
  status: String, // obtained, declined, revoked
  obtainedAt: Date,
  obtainedBy: ObjectId (ref: User),
  expiresAt: Date,
  createdAt: Date
}

// appointments
{
  _id: ObjectId,
  appointmentNumber: String (unique),
  patient: ObjectId (ref: Patient),
  doctor: ObjectId (ref: User),
  department: ObjectId (ref: Department),
  type: String, // opd, followup
  scheduledDate: Date,
  scheduledTime: String,
  status: String, // scheduled, checked-in, in-consultation, completed, cancelled
  tokenNumber: Number,
  chiefComplaint: String,
  notes: String,
  🆕 arrivalTime: Date,
  🆕 consultStartTime: Date,
  🆕 consultEndTime: Date,
  createdBy: ObjectId (ref: User),
  createdAt: Date,
  updatedAt: Date
}

// admissions (IPD)
{
  _id: ObjectId,
  admissionNumber: String (unique),
  patient: ObjectId (ref: Patient),
  doctor: ObjectId (ref: User),
  department: ObjectId (ref: Department),
  ward: ObjectId (ref: Ward),
  bed: ObjectId (ref: Bed),
  admissionDate: Date,
  dischargeDate: Date,
  admissionType: String, // emergency, planned
  diagnosis: String,
  status: String, // admitted, discharged, transferred
  estimatedDischarge: Date,
  🆕 transferHistory: [{
    fromWard: ObjectId (ref: Ward),
    fromBed: ObjectId (ref: Bed),
    toWard: ObjectId (ref: Ward),
    toBed: ObjectId (ref: Bed),
    transferredAt: Date,
    transferredBy: ObjectId (ref: User),
    reason: String
  }],
  createdBy: ObjectId (ref: User),
  createdAt: Date,
  updatedAt: Date
}

// emergencies
{
  _id: ObjectId,
  emergencyNumber: String (unique),
  patient: ObjectId (ref: Patient),
  🆕 triageLevel: String, // red, orange, yellow, green
  🆕 triageTime: Date,
  🆕 triageBy: ObjectId (ref: User),
  arrivalTime: Date,
  chiefComplaint: String,
  🆕 isMedicoLegal: Boolean,
  🆕 medicoLegalDetails: {
    caseType: String,
    policeStation: String,
    firNumber: String,
    reportedAt: Date
  },
  vitals: {
    bloodPressure: String,
    pulse: Number,
    temperature: Number,
    respiratoryRate: Number,
    oxygenSaturation: Number
  },
  status: String, // waiting, treating, admitted, discharged
  🆕 treatmentStartTime: Date,
  🆕 treatmentEndTime: Date,
  doctor: ObjectId (ref: User),
  nurse: ObjectId (ref: User),
  notes: String,
  outcome: String,
  createdAt: Date,
  updatedAt: Date
}

// emr (Electronic Medical Records)
{
  _id: ObjectId,
  patient: ObjectId (ref: Patient),
  visit: ObjectId (ref: Appointment/Admission),
  visitType: String, // opd, ipd, emergency
  date: Date,
  vitals: {
    bloodPressure: String,
    pulse: Number,
    temperature: Number,
    respiratoryRate: Number,
    oxygenSaturation: Number,
    weight: Number,
    height: Number,
    bmi: Number
  },
  chiefComplaint: String,
  presentingIllness: String,
  examination: String,
  diagnosis: String,
  treatment: String,
  notes: String,
  doctor: ObjectId (ref: User),
  🆕 versionHistory: [{
    version: Number,
    changes: Object,
    changedBy: ObjectId (ref: User),
    changedAt: Date,
    reason: String
  }],
  createdAt: Date,
  updatedAt: Date
}

// prescriptions
{
  _id: ObjectId,
  prescriptionNumber: String (unique),
  patient: ObjectId (ref: Patient),
  visit: ObjectId (ref: Appointment/Admission),
  doctor: ObjectId (ref: User),
  medicines: [{
    medicine: ObjectId (ref: Medicine),
    dosage: String,
    🆕 route: String,
    frequency: String,
    🆕 time: String,
    duration: String,
    instructions: String,
    quantity: Number,
    🆕 allergyChecked: Boolean,
    🆕 interactionChecked: Boolean
  }],
  specialInstructions: String,
  isDispensed: Boolean,
  dispensedBy: ObjectId (ref: User),
  dispensedAt: Date,
  🆕 nurseSignature: ObjectId (ref: User),
  createdAt: Date,
  updatedAt: Date
}

// lab_tests
{
  _id: ObjectId,
  testNumber: String (unique),
  patient: ObjectId (ref: Patient),
  visit: ObjectId (ref: Appointment/Admission),
  orderedBy: ObjectId (ref: User),
  test: ObjectId (ref: LabTestMaster),
  🆕 sampleId: String,
  sampleCollectedAt: Date,
  sampleCollectedBy: ObjectId (ref: User),
  status: String, // ordered, sample-collected, in-progress, completed, cancelled
  results: [{
    parameter: String,
    value: String,
    unit: String,
    normalRange: String,
    isAbnormal: Boolean,
    🆕 isCritical: Boolean
  }],
  remarks: String,
  performedBy: ObjectId (ref: User),
  🆕 validatedBy: ObjectId (ref: User),
  🆕 validatedAt: Date,
  🆕 approvedBy: ObjectId (ref: User),
  🆕 approvedAt: Date,
  completedAt: Date,
  isReportGenerated: Boolean,
  reportUrl: String,
  🆕 criticalAlertSent: Boolean,
  🆕 criticalAlertTime: Date,
  createdAt: Date,
  updatedAt: Date
}

// radiology_tests
{
  _id: ObjectId,
  testNumber: String (unique),
  patient: ObjectId (ref: Patient),
  visit: ObjectId (ref: Appointment/Admission),
  orderedBy: ObjectId (ref: User),
  test: ObjectId (ref: RadiologyMaster),
  scheduledAt: Date,
  status: String, // ordered, scheduled, in-progress, completed, cancelled
  findings: String,
  impression: String,
  recommendations: String,
  performedBy: ObjectId (ref: User),
  🆕 approvedBy: ObjectId (ref: User),
  🆕 approvedAt: Date,
  completedAt: Date,
  images: [String], // URLs
  reportUrl: String,
  createdAt: Date,
  updatedAt: Date
}

// surgeries
{
  _id: ObjectId,
  surgeryNumber: String (unique),
  patient: ObjectId (ref: Patient),
  admission: ObjectId (ref: Admission),
  surgeon: ObjectId (ref: User),
  assistantSurgeons: [ObjectId] (ref: User),
  anesthetist: ObjectId (ref: User),
  nurses: [ObjectId] (ref: User),
  otNumber: String,
  scheduledDate: Date,
  scheduledTime: String,
  actualStartTime: Date,
  actualEndTime: Date,
  surgeryType: String,
  diagnosis: String,
  procedure: String,
  anesthesiaType: String,
  🆕 preOpAssessment: {
    assessedBy: ObjectId (ref: User),
    assessedAt: Date,
    vitalSigns: Object,
    allergies: [String],
    currentMedications: [String],
    medicalHistory: String,
    labResults: String,
    anesthesiaRisk: String,
    fitness: String,
    notes: String
  },
  🆕 whoChecklist: {
    signIn: {
      patientIdentity: Boolean,
      siteMark: Boolean,
      consentObtained: Boolean,
      anesthesiaSafetyCheck: Boolean,
      pulseOximeter: Boolean,
      allergyCheck: Boolean,
      completedBy: ObjectId (ref: User),
      completedAt: Date
    },
    timeOut: {
      teamIntroduction: Boolean,
      procedureConfirmed: Boolean,
      antibioticsProphylaxis: Boolean,
      anticipatedCriticalEvents: Boolean,
      equipmentIssues: Boolean,
      imagingDisplayed: Boolean,
      completedBy: ObjectId (ref: User),
      completedAt: Date
    },
    signOut: {
      procedureRecorded: Boolean,
      instrumentCount: Boolean,
      specimenLabeled: Boolean,
      equipmentProblems: Boolean,
      keyRecoveryPlan: Boolean,
      completedBy: ObjectId (ref: User),
      completedAt: Date
    }
  },
  🆕 intraOpNotes: {
    procedure: String,
    findings: String,
    techniqueUsed: String,
    bloodLoss: Number,
    fluidAdministered: Number,
    complications: String,
    notes: String,
    recordedBy: ObjectId (ref: User),
    recordedAt: Date
  },
  🆕 postOpOrders: {
    painManagement: String,
    antibiotics: String,
    ivFluids: String,
    dietOrders: String,
    activityLevel: String,
    monitoringRequired: String,
    followUpInstructions: String,
    orderedBy: ObjectId (ref: User),
    orderedAt: Date
  },
  🆕 implantsConsumables: [{
    itemType: String, // implant, consumable
    itemName: String,
    batchNumber: String,
    quantity: Number,
    serialNumber: String,
    expiryDate: Date,
    supplier: String,
    recordedBy: ObjectId (ref: User),
    recordedAt: Date
  }],
  🆕 infectionControl: {
    antibioticProphylaxis: Boolean,
    antibioticName: String,
    administeredAt: Date,
    sterilizationVerified: Boolean,
    gloveChanges: Number,
    environmentalControls: Boolean,
    notes: String,
    recordedBy: ObjectId (ref: User)
  },
  complications: String,
  postOpInstructions: String,
  status: String, // scheduled, in-progress, completed, cancelled
  🆕 billingLinked: Boolean,
  🆕 billingAmount: Number,
  createdAt: Date,
  updatedAt: Date,
  🆕 auditTrail: [{
    action: String,
    performedBy: ObjectId (ref: User),
    timestamp: Date,
    details: Object
  }]
}

// billings
{
  _id: ObjectId,
  billNumber: String (unique),
  patient: ObjectId (ref: Patient),
  visit: ObjectId (ref: Appointment/Admission),
  visitType: String, // opd, ipd, emergency
  billDate: Date,
  items: [{
    itemType: String, // consultation, procedure, lab, radiology, medicine, bed, etc.
    itemReference: ObjectId, // Reference to specific item
    description: String,
    quantity: Number,
    rate: Number,
    amount: Number,
    discount: Number,
    🆕 discountApprovedBy: ObjectId (ref: User),
    tax: Number,
    netAmount: Number,
    🆕 autoCharged: Boolean,
    isBilled: Boolean,
    billedAt: Date
  }],
  subtotal: Number,
  totalDiscount: Number,
  totalTax: Number,
  grandTotal: Number,
  paidAmount: Number,
  balanceAmount: Number,
  paymentStatus: String, // pending, partial, paid
  insuranceClaim: ObjectId (ref: Insurance),
  generatedBy: ObjectId (ref: User),
  createdAt: Date,
  updatedAt: Date,
  🆕 auditTrail: [{
    action: String,
    performedBy: ObjectId (ref: User),
    timestamp: Date,
    details: Object
  }]
}

// payments
{
  _id: ObjectId,
  receiptNumber: String (unique),
  bill: ObjectId (ref: Billing),
  patient: ObjectId (ref: Patient),
  amount: Number,
  paymentMode: String, // cash, card, upi, cheque, insurance
  paymentDetails: {
    transactionId: String,
    cardLast4: String,
    bankName: String,
    chequeNumber: String
  },
  paymentDate: Date,
  collectedBy: ObjectId (ref: User),
  createdAt: Date
}

// insurance_claims
{
  _id: ObjectId,
  claimNumber: String (unique),
  patient: ObjectId (ref: Patient),
  admission: ObjectId (ref: Admission),
  provider: ObjectId (ref: InsuranceProvider),
  🆕 tpaProvider: ObjectId (ref: TPAProvider),
  policyNumber: String,
  🆕 preAuthNumber: String,
  🆕 preAuthStatus: String, // pending, approved, rejected
  🆕 preAuthAmount: Number,
  🆕 preAuthApprovedAt: Date,
  🆕 icdCode: String, // ICD-10/ICD-11 mandatory
  🆕 icdDescription: String,
  🆕 packageCode: String,
  🆕 packageAmount: Number,
  claimAmount: Number,
  approvedAmount: Number,
  status: String, // pending, pre-authorized, approved, rejected, settled
  submittedDate: Date,
  approvalDate: Date,
  settlementDate: Date,
  🆕 rejectionReason: String,
  🆕 rejectionDate: Date,
  documents: [String], // URLs
  remarks: String,
  handledBy: ObjectId (ref: User),
  createdAt: Date,
  updatedAt: Date,
  🆕 auditTrail: [{
    action: String,
    performedBy: ObjectId (ref: User),
    timestamp: Date,
    details: Object
  }]
}

🆕 // tpa_providers
{
  _id: ObjectId,
  tpaName: String,
  tpaCode: String,
  contactPerson: String,
  phone: String,
  email: String,
  address: String,
  isActive: Boolean,
  insuranceCompanies: [ObjectId] (ref: InsuranceProvider),
  createdAt: Date,
  updatedAt: Date
}

// beds
{
  _id: ObjectId,
  bedNumber: String,
  ward: ObjectId (ref: Ward),
  bedType: String, // general, semi-private, private, icu, nicu
  status: String, // available, occupied, under-maintenance, reserved
  currentPatient: ObjectId (ref: Patient),
  currentAdmission: ObjectId (ref: Admission),
  tariff: Number,
  🆕 allocationTime: Date,
  🆕 cleaningStatus: String, // cleaned, cleaning-pending, cleaning-in-progress
  🆕 lastCleanedAt: Date,
  🆕 lastCleanedBy: ObjectId (ref: User),
  createdAt: Date,
  updatedAt: Date,
  🆕 auditTrail: [{
    action: String,
    performedBy: ObjectId (ref: User),
    timestamp: Date,
    status: String
  }]
}

// pharmacy_inventory
{
  _id: ObjectId,
  medicine: ObjectId (ref: Medicine),
  batchNumber: String,
  expiryDate: Date,
  quantity: Number,
  purchaseRate: Number,
  sellingRate: Number,
  supplier: String,
  purchaseDate: Date,   
  status: String, // available, low-stock, expired
  🆕 issuedToPatients: [{
    patient: ObjectId (ref: Patient),
    quantity: Number,
    issuedAt: Date,
    issuedBy: ObjectId (ref: User)
  }],
  🆕 isRecalled: Boolean,
  🆕 recallDetails: {
    reason: String,
    recalledAt: Date,
    action: String
  },
  createdAt: Date,
  updatedAt: Date
}

// inventory (Hospital Supplies)
{
  _id: ObjectId,
  itemName: String,
  itemCode: String,
  category: String,
  unit: String,
  quantity: Number,
  reorderLevel: Number,
  location: String,
  supplier: String,
  lastPurchaseDate: Date,
  lastPurchaseRate: Number,
  🆕 consumptionRecords: [{
    patient: ObjectId (ref: Patient),
    quantity: Number,
    consumedAt: Date,
    consumedBy: ObjectId (ref: User),
    department: ObjectId (ref: Department)
  }],
  createdAt: Date,
  updatedAt: Date
}

🆕 // purchase_orders
{
  _id: ObjectId,
  poNumber: String (unique),
  vendor: ObjectId (ref: VendorMaster),
  poDate: Date,
  expectedDeliveryDate: Date,
  items: [{
    item: ObjectId (ref: Inventory/Medicine),
    itemType: String, // inventory, medicine
    quantity: Number,
    rate: Number,
    amount: Number
  }],
  totalAmount: Number,
  status: String, // pending, approved, ordered, received, cancelled
  approvedBy: ObjectId (ref: User),
  approvedAt: Date,
  createdBy: ObjectId (ref: User),
  createdAt: Date,
  updatedAt: Date
}

🆕 // grn (Goods Receipt Note)
{
  _id: ObjectId,
  grnNumber: String (unique),
  purchaseOrder: ObjectId (ref: PurchaseOrder),
  vendor: ObjectId (ref: VendorMaster),
  receivedDate: Date,
  items: [{
    item: ObjectId (ref: Inventory/Medicine),
    orderedQuantity: Number,
    receivedQuantity: Number,
    batchNumber: String,
    expiryDate: Date,
    rate: Number,
    amount: Number,
    remarks: String
  }],
  totalAmount: Number,
  discrepancies: String,
  receivedBy: ObjectId (ref: User),
  verifiedBy: ObjectId (ref: User),
  createdAt: Date
}

🆕 // vendor_master
{
  _id: ObjectId,
  vendorCode: String (unique),
  vendorName: String,
  contactPerson: String,
  phone: String,
  email: String,
  address: String,
  gstNumber: String,
  panNumber: String,
  category: String, // medicine, equipment, consumables
  isActive: Boolean,
  paymentTerms: String,
  createdAt: Date,
  updatedAt: Date
}

🆕 // order_sets
{
  _id: ObjectId,
  orderSetName: String, // trauma, cardiac, stroke
  orderSetType: String,
  description: String,
  investigations: [{
    test: ObjectId (ref: LabTestMaster/RadiologyMaster),
    testType: String, // lab, radiology
    priority: String
  }],
  medications: [{
    medicine: ObjectId (ref: Medicine),
    dosage: String,
    route: String,
    frequency: String,
    priority: String
  }],
  procedures: [String],
  isActive: Boolean,
  createdBy: ObjectId (ref: User),
  createdAt: Date,
  updatedAt: Date
}

🆕 // drug_interactions
{
  _id: ObjectId,
  drug1: ObjectId (ref: Medicine),
  drug2: ObjectId (ref: Medicine),
  interactionType: String, // major, moderate, minor
  severity: String, // critical, high, medium, low
  description: String,
  recommendation: String,
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}

🆕 // critical_values
{
  _id: ObjectId,
  testParameter: String,
  lowCritical: Number,
  highCritical: Number,
  unit: String,
  ageGroup: String,
  gender: String,
  alertMessage: String,
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}

🆕 // vital_sign_alerts
{
  _id: ObjectId,
  vitalSign: String, // bp, pulse, temperature, spo2, respiratory_rate
  normalRange: {
    min: Number,
    max: Number
  },
  criticalRange: {
    min: Number,
    max: Number
  },
  ageGroup: String,
  alertMessage: String,
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}

🆕 // nursing_care_flows
{
  _id: ObjectId,
  patient: ObjectId (ref: Patient),
  admission: ObjectId (ref: Admission),
  nurse: ObjectId (ref: User),
  shift: String, // morning, evening, night
  vitalSigns: [{
    time: Date,
    bloodPressure: String,
    pulse: Number,
    temperature: Number,
    respiratoryRate: Number,
    oxygenSaturation: Number,
    recordedBy: ObjectId (ref: User)
  }],
  nurssingNotes: [{
    time: Date,
    note: String,
    recordedBy: ObjectId (ref: User)
  }],
  carePlan: {
    goals: [String],
    interventions: [String],
    evaluations: [String],
    updatedAt: Date,
    updatedBy: ObjectId (ref: User)
  },
  createdAt: Date,
  updatedAt: Date
}

🆕 // medication_administration
{
  _id: ObjectId,
  patient: ObjectId (ref: Patient),
  prescription: ObjectId (ref: Prescription),
  medicine: ObjectId (ref: Medicine),
  scheduledTime: Date,
  administeredTime: Date,
  dose: String,
  route: String,
  administeredBy: ObjectId (ref: User),
  status: String, // scheduled, administered, skipped, refused
  skipReason: String,
  refuseReason: String,
  observations: String,
  createdAt: Date
}

🆕 // shift_handovers
{
  _id: ObjectId,
  shift: String,
  date: Date,
  ward: ObjectId (ref: Ward),
  handoverFrom: ObjectId (ref: User),
  handoverTo: ObjectId (ref: User),
  patients: [{
    patient: ObjectId (ref: Patient),
    bed: ObjectId (ref: Bed),
    condition: String,
    pendingTasks: [String],
    criticalAlerts: [String],
    notes: String
  }],
  generalNotes: String,
  handoverTime: Date,
  acknowledged: Boolean,
  acknowledgedAt: Date,
  createdAt: Date
}

🆕 // resource_utilization
{
  _id: ObjectId,
  resourceType: String, // bed, equipment, staff, consumable
  resourceId: ObjectId,
  department: ObjectId (ref: Department),
  utilizationDate: Date,
  utilizationHours: Number,
  patient: ObjectId (ref: Patient),
  recordedBy: ObjectId (ref: User),
  notes: String,
  createdAt: Date
}

🆕 // clinical_coding
{
  _id: ObjectId,
  patient: ObjectId (ref: Patient),
  visit: ObjectId (ref: Appointment/Admission),
  visitType: String,
  diagnosisCodes: [{
    icdCode: String, // ICD-10 or ICD-11
    icdVersion: String,
    description: String,
    isPrimary: Boolean
  }],
  procedureCodes: [{
    cptCode: String,
    localCode: String,
    description: String,
    billingItem: ObjectId (ref: BillingItem)
  }],
  codedBy: ObjectId (ref: User),
  codedAt: Date,
  verifiedBy: ObjectId (ref: User),
  verifiedAt: Date,
  isBillingLinked: Boolean,
  isClaimLinked: Boolean,
  createdAt: Date,
  updatedAt: Date,
  🆕 auditTrail: [{
    action: String,
    changes: Object,
    performedBy: ObjectId (ref: User),
    timestamp: Date
  }]
}

🆕 // incident_reports
{
  _id: ObjectId,
  incidentNumber: String (unique),
  incidentType: String, // medication-error, fall, equipment-failure, infection
  severity: String, // critical, major, moderate, minor
  incidentDate: Date,
  reportedDate: Date,
  reportedBy: ObjectId (ref: User),
  department: ObjectId (ref: Department),
  location: String,
  patient: ObjectId (ref: Patient),
  description: String,
  immediateAction: String,
  witnesses: [ObjectId] (ref: User),
  investigationNotes: String,
  rootCause: String,
  status: String, // reported, under-investigation, resolved, closed
  resol
  vedBy: ObjectId (ref: User),
  resolvedAt: Date,
  createdAt: Date,
  updatedAt: Date
}

🆕 // near_misses
{
  _id: ObjectId,
  nearMissNumber: String (unique),
  nearMissType: String,
  nearMissDate: Date,
  reportedDate: Date,
  reportedBy: ObjectId (ref: User),
  department: ObjectId (ref: Department),
  description: String,
  potentialConsequence: String,
  preventiveMeasures: String,
  status: String, // reported, reviewed, closed
  reviewedBy: ObjectId (ref: User),
  reviewedAt: Date,
  createdAt: Date
}

🆕 // risk_assessments
{
  _id: ObjectId,
  assessmentNumber: String (unique),
  riskCategory: String, // clinical, operational, financial, compliance
  riskDescription: String,
  likelihood: String, // rare, unlikely, possible, likely, certain
  consequence: String, // negligible, minor, moderate, major, catastrophic
  riskScore: Number,
  currentControls: [String],
  assessedBy: ObjectId (ref: User),
  assessedAt: Date,
  reviewDate: Date,
  status: String, // active, mitigated, closed
  createdAt: Date,
  updatedAt: Date
}

🆕 // capa (Corrective and Preventive Actions)
{
  _id: ObjectId,
  capaNumber: String (unique),
  relatedIncident: ObjectId (ref: IncidentReport),
  relatedRisk: ObjectId (ref: RiskAssessment),
  capaType: String, // corrective, preventive
  description: String,
  rootCause: String,
  proposedAction: String,
  actionOwner: ObjectId (ref: User),
  targetDate: Date,
  status: String, // planned, in-progress, implemented, verified, closed
  implementationDate: Date,
  verificationMethod: String,
  verifiedBy: ObjectId (ref: User),
  verifiedAt: Date,
  effectiveness: String,
  createdBy: ObjectId (ref: User),
  createdAt: Date,
  updatedAt: Date
}

// ai_anomalies (Revenue Leakage)
{
  _id: ObjectId,
  anomalyType: String, // unbilled-service, unbilled-medicine, unusual-pattern
  detectionDate: Date,
  patient: ObjectId (ref: Patient),
  visit: ObjectId (ref: Appointment/Admission),
  description: String,
  details: {
    service: String,
    expectedRevenue: Number,
    actualRevenue: Number,
    leakageAmount: Number
  },
  status: String, // detected, under-review, resolved, false-positive
  reviewedBy: ObjectId (ref: User),
  reviewedAt: Date,
  resolutionNotes: String,
  anomalyScore: Number,
  createdAt: Date
}

// ai_predictions (Operational Forecasts)
{
  _id: ObjectId,
  predictionType: String, // opd-rush, bed-occupancy, lab-workload
  predictionDate: Date,
  forecastPeriod: {
    from: Date,
    to: Date
  },
  predictions: [{
    timestamp: Date,
    predictedValue: Number,
    confidence: Number
  }],
  accuracy: Number, // calculated after actual data
  createdAt: Date
}

// audit_logs
{
  _id: ObjectId,
  user: ObjectId (ref: User),
  action: String,
  entity: String,
  entityId: ObjectId,
  changes: Object,
  ipAddress: String,
  userAgent: String,
  timestamp: Date
}

// notifications
{
  _id: ObjectId,
  recipient: ObjectId (ref: User),
  type: String, // info, warning, critical, alert
  title: String,
  message: String,
  relatedEntity: {
    type: String,
    id: ObjectId
  },
  isRead: Boolean,
  readAt: Date,
  createdAt: Date
}
```

---

## API Endpoints Structure

### Authentication
```
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/refresh-token
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
PUT    /api/auth/change-password
🆕 POST   /api/auth/break-glass          # Emergency override access
```

### Patients
```
POST   /api/patients
GET    /api/patients
GET    /api/patients/:id
PUT    /api/patients/:id
DELETE /api/patients/:id
GET    /api/patients/search?query=
GET    /api/patients/:id/history
GET    /api/patients/:id/emr
🆕 POST   /api/patients/detect-duplicates
🆕 POST   /api/patients/merge
🆕 GET    /api/patients/:id/merge-history
🆕 POST   /api/patients/emergency-registration
🆕 GET    /api/patients/:id/edit-audit
🆕 POST   /api/patients/:id/consent
🆕 GET    /api/patients/:id/consents
```

### OPD
```
POST   /api/opd/appointments
GET    /api/opd/appointments
GET    /api/opd/appointments/:id
PUT    /api/opd/appointments/:id
DELETE /api/opd/appointments/:id
PUT    /api/opd/appointments/:id/checkin
GET    /api/opd/queue
GET    /api/opd/dashboard
🆕 GET    /api/opd/timestamps/:id        # Get arrival, consult times
```

### IPD
```
POST   /api/ipd/admissions
GET    /api/ipd/admissions
GET    /api/ipd/admissions/:id
PUT    /api/ipd/admissions/:id
POST   /api/ipd/admissions/:id/discharge
GET    /api/ipd/patients
GET    /api/ipd/dashboard
🆕 POST   /api/ipd/admissions/:id/transfer
🆕 GET    /api/ipd/admissions/:id/transfer-history
```

### Emergency
```
POST   /api/emergency/cases
GET    /api/emergency/cases
GET    /api/emergency/cases/:id
PUT    /api/emergency/cases/:id
GET    /api/emergency/queue
🆕 POST   /api/emergency/triage
🆕 POST   /api/emergency/medico-legal
🆕 GET    /api/emergency/live-board
🆕 POST   /api/emergency/order-sets/:setId/apply
```

### EMR
```
POST   /api/emr
GET    /api/emr/:patientId
GET    /api/emr/visit/:visitId
PUT    /api/emr/:id
POST   /api/emr/:id/vitals
GET    /api/emr/:id/timeline
🆕 GET    /api/emr/:id/version-history
🆕 POST   /api/emr/:id/restore-version
```

### Prescriptions
```
POST   /api/prescriptions
GET    /api/prescriptions
GET    /api/prescriptions/:id
PUT    /api/prescriptions/:id
GET    /api/prescriptions/patient/:patientId
🆕 POST   /api/prescriptions/check-interactions
🆕 POST   /api/prescriptions/check-allergies
```

### Lab
```
POST   /api/lab/orders
GET    /api/lab/orders
GET    /api/lab/orders/:id
PUT    /api/lab/orders/:id
POST   /api/lab/orders/:id/collect-sample
POST   /api/lab/orders/:id/enter-results
POST   /api/lab/orders/:id/generate-report
GET    /api/lab/queue
GET    /api/lab/dashboard
🆕 POST   /api/lab/orders/:id/validate
🆕 POST   /api/lab/orders/:id/approve
🆕 GET    /api/lab/critical-alerts
🆕 GET    /api/lab/sample-tracking/:sampleId
```

### Radiology
```
POST   /api/radiology/orders
GET    /api/radiology/orders
GET    /api/radiology/orders/:id
PUT    /api/radiology/orders/:id
POST   /api/radiology/orders/:id/schedule
POST   /api/radiology/orders/:id/enter-report
GET    /api/radiology/queue
GET    /api/radiology/dashboard
🆕 POST   /api/radiology/orders/:id/approve
```

### Pharmacy
```
POST   /api/pharmacy/dispense
GET    /api/pharmacy/queue
GET    /api/pharmacy/inventory
POST   /api/pharmacy/inventory
PUT    /api/pharmacy/inventory/:id
GET    /api/pharmacy/expiry-alerts
GET    /api/pharmacy/dashboard
🆕 POST   /api/pharmacy/batch-track
🆕 GET    /api/pharmacy/patient-stock-mapping/:patientId
🆕 POST   /api/pharmacy/drug-recall
🆕 GET    /api/pharmacy/drug-recalls
```

### Surgery/OT
```
POST   /api/surgery/schedule
GET    /api/surgery/schedules
GET    /api/surgery/schedules/:id
PUT    /api/surgery/schedules/:id
GET    /api/surgery/ot-roster
GET    /api/surgery/dashboard
🆕 POST   /api/surgery/:id/pre-op-assessment
🆕 POST   /api/surgery/:id/who-checklist
🆕 POST   /api/surgery/:id/intra-op-notes
🆕 POST   /api/surgery/:id/post-op-orders
🆕 POST   /api/surgery/:id/implants-consumables
🆕 POST   /api/surgery/:id/infection-control
🆕 GET    /api/surgery/:id/billing-link
```

### Billing
```
POST   /api/billing/generate
GET    /api/billing/bills
GET    /api/billing/bills/:id
PUT    /api/billing/bills/:id
GET    /api/billing/patient/:patientId
GET    /api/billing/pending
GET    /api/billing/dashboard
🆕 POST   /api/billing/auto-capture
🆕 POST   /api/billing/discount-approval
🆕 GET    /api/billing/audit/:billId
```

### Payments
```
POST   /api/payments
GET    /api/payments
GET    /api/payments/:id
GET    /api/payments/bill/:billId
```

### Insurance
```
POST   /api/insurance/claims
GET    /api/insurance/claims
GET    /api/insurance/claims/:id
PUT    /api/insurance/claims/:id
POST   /api/insurance/pre-authorization
GET    /api/insurance/providers
🆕 GET    /api/insurance/tpa-providers
🆕 POST   /api/insurance/package-mapping
🆕 POST   /api/insurance/rejection-tracking
🆕 GET    /api/insurance/settlement-tracking
🆕 GET    /api/insurance/claims/:id/audit
```

### Beds
```
GET    /api/beds
GET    /api/beds/:id
PUT    /api/beds/:id
POST   /api/beds/allocate
POST   /api/beds/transfer
GET    /api/beds/availability
GET    /api/beds/occupancy
🆕 POST   /api/beds/:id/cleaning-status
🆕 GET    /api/beds/time-tracking/:bedId
```

### Inventory
```
GET    /api/inventory
POST   /api/inventory
PUT    /api/inventory/:id
DELETE /api/inventory/:id
POST   /api/inventory/stock-in
POST   /api/inventory/stock-out
GET    /api/inventory/low-stock
🆕 POST   /api/inventory/purchase-orders
🆕 GET    /api/inventory/purchase-orders
🆕 POST   /api/inventory/grn
🆕 GET    /api/inventory/grn/:poId
🆕 POST   /api/inventory/stock-return
🆕 GET    /api/inventory/consumption/:patientId
🆕 GET    /api/inventory/vendors
🆕 POST   /api/inventory/vendors
```

### Staff/HR
```
GET    /api/staff
POST   /api/staff
PUT    /api/staff/:id
DELETE /api/staff/:id
POST   /api/staff/attendance
GET    /api/staff/attendance
POST   /api/staff/leaves
GET    /api/staff/leaves
```

### Analytics
```
GET    /api/analytics/executive-dashboard
GET    /api/analytics/clinical
GET    /api/analytics/financial
GET    /api/analytics/operational
GET    /api/analytics/reports
POST   /api/analytics/custom-report
🆕 GET    /api/analytics/patient-flow
🆕 GET    /api/analytics/department-productivity
🆕 GET    /api/analytics/er-waiting-time
🆕 GET    /api/analytics/bed-occupancy
🆕 GET    /api/analytics/revenue-reports
```

### 🆕 Nursing
```
🆕 GET    /api/nursing/dashboard
🆕 GET    /api/nursing/patients/:wardId
🆕 POST   /api/nursing/vitals
🆕 GET    /api/nursing/vitals/:patientId
🆕 POST   /api/nursing/notes
🆕 GET    /api/nursing/notes/:patientId
🆕 POST   /api/nursing/medication-administration
🆕 GET    /api/nursing/medication-schedule/:patientId
🆕 POST   /api/nursing/care-plan
🆕 GET    /api/nursing/care-plan/:patientId
🆕 POST   /api/nursing/shift-handover
🆕 GET    /api/nursing/shift-handover/:shiftId
🆕 GET    /api/nursing/critical-alerts
```

### 🆕 Safety & Alerts
```
🆕 GET    /api/safety/alerts
🆕 GET    /api/safety/allergy-alerts/:patientId
🆕 POST   /api/safety/check-drug-interaction
🆕 GET    /api/safety/critical-lab-values
🆕 GET    /api/safety/vital-sign-alerts/:patientId
🆕 POST   /api/safety/duplicate-order-check
🆕 GET    /api/safety/compliance-report
```

### 🆕 Incident Management
```
🆕 POST   /api/incidents/report
🆕 GET    /api/incidents
🆕 GET    /api/incidents/:id
🆕 PUT    /api/incidents/:id
🆕 POST   /api/incidents/near-miss
🆕 GET    /api/incidents/near-misses
🆕 POST   /api/incidents/risk-assessment
🆕 GET    /api/incidents/risk-assessments
🆕 POST   /api/incidents/capa
🆕 GET    /api/incidents/capa
🆕 GET    /api/incidents/dashboard
```

### 🆕 Clinical Coding
```
🆕 POST   /api/coding/create
🆕 GET    /api/coding/:visitId
🆕 PUT    /api/coding/:id
🆕 POST   /api/coding/validate-icd
🆕 GET    /api/coding/icd-search?query=
🆕 GET    /api/coding/cpt-search?query=
🆕 POST   /api/coding/link-billing
🆕 GET    /api/coding/audit/:id
🆕 GET    /api/coding/mandatory-check/:visitId
```

### 🆕 Resource Utilization
```
🆕 POST   /api/resource/track
🆕 GET    /api/resource/dashboard
🆕 GET    /api/resource/bed-occupancy
🆕 GET    /api/resource/equipment-usage
🆕 GET    /api/resource/staff-allocation
🆕 GET    /api/resource/consumables-monitoring
🆕 GET    /api/resource/shortage-alerts
🆕 GET    /api/resource/audit
```

### AI Endpoints

**Revenue Leakage Detection**
```
POST   /api/ai/revenue/scan              # Trigger anomaly detection
GET    /api/ai/revenue/anomalies          # Get detected anomalies
GET    /api/ai/revenue/anomalies/:id      # Get specific anomaly
PUT    /api/ai/revenue/anomalies/:id      # Update anomaly status
GET    /api/ai/revenue/dashboard          # Revenue leakage dashboard
```

**Predictive Analytics**
```
POST   /api/ai/predict/opd-rush           # Predict OPD rush hours
POST   /api/ai/predict/bed-occupancy      # Predict bed occupancy
POST   /api/ai/predict/lab-workload       # Predict lab workload
GET    /api/ai/predictions                # Get all predictions
GET    /api/ai/predictions/:type          # Get specific prediction type
```

### Admin
```
GET    /api/admin/users
POST   /api/admin/users
PUT    /api/admin/users/:id
DELETE /api/admin/users/:id
GET    /api/admin/departments
POST   /api/admin/departments
GET    /api/admin/tariffs
POST   /api/admin/tariffs
GET    /api/admin/audit-logs
GET    /api/admin/system-config
PUT    /api/admin/system-config
🆕 GET    /api/admin/compliance-reports
🆕 POST   /api/admin/order-sets
🆕 GET    /api/admin/order-sets
🆕 POST   /api/admin/critical-value-config
🆕 POST   /api/admin/drug-interaction-rules
```

---

## ML Service APIs (Python Flask)

### Revenue Leakage Service (Port 5001)
```
POST   /ml/revenue/detect                 # Run anomaly detection
POST   /ml/revenue/train                  # Train/retrain model
GET    /ml/revenue/health                 # Service health check
```

### Predictive Analytics Service (Port 5002)
```
POST   /ml/predict/opd                    # OPD predictions
POST   /ml/predict/beds                   # Bed occupancy predictions
POST   /ml/predict/lab                    # Lab workload predictions
POST   /ml/predict/train                  # Train/retrain models
GET    /ml/predict/health                 # Service health check
```

---

## Integration Requirements

### 1. Node.js Backend ↔ MongoDB
- Mongoose ODM for data modeling
- Connection pooling
- Transaction support for critical operations
- 🆕 Auto-save mechanisms for network failure handling

### 2. React Frontend ↔ Node.js Backend
- Axios for HTTP requests
- Redux for state management
- Socket.io for real-time updates
- 🆕 Offline capability for downtime mode

### 3. Node.js Backend ↔ Python ML Services
- HTTP REST calls from Node to Python
- JSON data exchange
- Async processing for ML operations

### 4. Python ML Services ↔ MongoDB
- PyMongo for direct DB access
- Read-only access for training data
- Write access for predictions/anomalies

### 5. Real-time Communication
Socket.io for:
- New patient registrations
- Queue updates
- Lab/radiology result availability
- Billing alerts
- AI anomaly notifications
- 🆕 Critical safety alerts (allergy, drug interaction, vital signs)
- 🆕 Emergency triage updates
- 🆕 Bed status changes
- 🆕 Incident reports

---

## Dependencies

### Backend (package.json)
```json
{
  "dependencies": {
    "express": "^4.18.0",
    "mongoose": "^7.0.0",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.0",
    "cors": "^2.8.5",
    "dotenv": "^16.0.0",
    "socket.io": "^4.5.0",
    "axios": "^1.4.0",
    "multer": "^1.4.5-lts.1",
    "pdfkit": "^0.13.0",
    "exceljs": "^4.3.0",
    "nodemailer": "^6.9.0",
    "winston": "^3.8.0",
    "joi": "^17.9.0",
    "express-rate-limit": "^6.7.0",
    "helmet": "^7.0.0",
    "morgan": "^1.10.0"
  }
}
```

### Frontend (package.json)
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.11.0",
    "@reduxjs/toolkit": "^1.9.0",
    "react-redux": "^8.0.0",
    "axios": "^1.4.0",
    "socket.io-client": "^4.5.0",
    "@mui/material": "^5.13.0",
    "@mui/icons-material": "^5.11.0",
    "@emotion/react": "^11.11.0",
    "@emotion/styled": "^11.11.0",
    "recharts": "^2.5.0",
    "date-fns": "^2.30.0",
    "react-datepicker": "^4.11.0",
    "react-toastify": "^9.1.0",
    "formik": "^2.2.9",
    "yup": "^1.2.0",
    "jspdf": "^2.5.1",
    "file-saver": "^2.0.5"
  }
}
```

### ML Services (requirements.txt)

**Revenue Leakage Service**
```
flask==2.3.2
flask-cors==4.0.0
pandas==2.0.2
numpy==1.24.3
scikit-learn==1.2.2
pymongo==4.3.3
python-dotenv==1.0.0
joblib==1.2.0
```

**Predictive Analytics Service**
```
flask==2.3.2
flask-cors==4.0.0
pandas==2.0.2
numpy==1.24.3
prophet==1.1.2
statsmodels==0.14.0
pymongo==4.3.3
python-dotenv==1.0.0
joblib==1.2.0
matplotlib==3.7.1
```

---

## Development Workflow

### 1. Initial Setup
```bash
# Backend
cd hospital-his-backend
npm install
cp .env.example .env
# Configure MongoDB connection
npm run dev

# Frontend
cd hospital-his-frontend
npm install
cp .env.example .env
# Configure API endpoint
npm start

# ML Services
cd hospital-his-ml/revenue_leakage
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py

cd ../predictive_analytics
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

### 2. Database Seeding
```bash
node scripts/seed.js
```

### 3. Testing
```bash
# Backend
npm test

# Frontend
npm test

# ML Services
pytest
```

---

## Deployment Considerations

### Environment Variables (.env)

**Backend:**
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/hospital_his
JWT_SECRET=your_jwt_secret
JWT_EXPIRE=7d
ML_REVENUE_SERVICE_URL=http://localhost:5001
ML_PREDICT_SERVICE_URL=http://localhost:5002
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email
SMTP_PASS=your_password
AWS_ACCESS_KEY=your_aws_key
AWS_SECRET_KEY=your_aws_secret
AWS_BUCKET_NAME=hospital-his-files
```

**Frontend:**
```
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_SOCKET_URL=http://localhost:5000
```

**ML Services:**
```
FLASK_PORT=5001 (or 5002)
MONGODB_URI=mongodb://localhost:27017/hospital_his
MODEL_PATH=./models
```

---

## Key Features Summary

### Core HIS Features:
1. **Patient Management**
   - Registration with UHID
   - 🆕 Duplicate patient detection
   - 🆕 Patient merge capability
   - Search & Profile
   - 🆕 ID proof capture
   - 🆕 Emergency temporary registration
   - 🆕 Audit trail for edits

2. **Electronic Medical Records (EMR)**
   - Chief complaint & diagnosis
   - Progress notes
   - 🆕 Allergies & alerts
   - Prescriptions
   - Lab & radiology reports
   - Discharge summary
   - 🆕 Consent records
   - 🆕 Version history

3. **OPD / IPD / Emergency Workflow**
   - Appointment scheduling
   - 🆕 Emergency triage with color coding
   - 🆕 Time stamps (arrival, consult, treatment)
   - Doctor & nurse notes
   - Admission, transfer, discharge
   - Bed allocation
   - 🆕 Medico-legal case flagging
   - 🆕 E-prescription

4. **Pharmacy Management**
   - 🆕 Batch number tracking
   - 🆕 Expiry management
   - 🆕 Stock issue mapping to patient
   - 🆕 Allergy & interaction alerts
   - 🆕 Drug recall support
   - 🆕 Pharmacy billing integration
   - 🆕 Time, dose, route, nurse signature

5. **Inventory Management**
   - 🆕 Purchase orders
   - 🆕 GRN (Goods Receipt Note)
   - Stock issue & return
   - 🆕 Expiry tracking
   - 🆕 Consumption linked to patient
   - 🆕 Vendor management
   - 🆕 Audit logs

6. **Insurance & TPA**
   - Policy & TPA details
   - 🆕 Pre-authorization workflow
   - 🆕 ICD-10/ICD-11 mandatory mapping
   - 🆕 Package mapping
   - 🆕 Claim submission tracking
   - 🆕 Rejection reason capture
   - 🆕 Settlement tracking
   - 🆕 Audit logs

7. **Operation Theatre (OT)**
   - Surgery scheduling
   - Surgeon, anesthetist, nurse mapping
   - 🆕 OT checklist
   - 🆕 Anesthesia records
   - 🆕 Implant & consumables capture
   - 🆕 OT notes
   - 🆕 Billing linkage
   - 🆕 Pre-op assessment
   - 🆕 WHO surgical safety checklist
   - 🆕 Intra-op notes
   - 🆕 Post-op orders
   - 🆕 OT billing integration
   - 🆕 Infection control tracking
   - 🆕 Full audit trail

8. **Bed Management**
   - Real-time bed status
   - Allocation, transfer, discharge
   - 🆕 ICU / ward classification
   - 🆕 Time tracking
   - 🆕 Cleaning status
   - 🆕 Audit trail

9. **🆕 Safety Alerts & Warnings**
   - 🆕 Allergy alerts
   - 🆕 Drug interaction alerts
   - 🆕 Critical lab value alerts
   - 🆕 Vital sign abnormality alerts
   - 🆕 Duplicate order warnings
   - 🆕 Compliance (ISO 14971, IEC 62366)

10. **🆕 Emergency Order Sets**
    - 🆕 Predefined trauma, cardiac, stroke bundles
    - 🆕 One-click investigations & medications
    - 🆕 Error reduction & time saving

11. **🆕 Access & Audit Control**
    - 🆕 Role-based access
    - 🆕 Emergency override (break-glass)
    - 🆕 Full audit trails
    - 🆕 Compliance (IEC 62304, HIPAA, NABH)

12. **🆕 Emergency Dashboard**
    - 🆕 Live ER boardll
    - 🆕 Patient name & UHID
    - 🆕 Triage color
    - 🆕 Waiting time
    - 🆕 Patient status (waiting / treating / admitted)
    - 🆕 Downtime mode

13. **🆕 Risk Controls**
    - 🆕 Auto-save
    - 🆕 Network failure handling
    - 🆕 Duplicate patient detection
    - 🆕 ICD-10/ICD-11 error diagnosis

14. **🆕 Clinical Coding**
    - 🆕 CPT / local procedure codes
    - 🆕 Mapping codes to billing
    - 🆕 Mandatory coding before billing/claims
    - 🆕 Audit of code changes

15. **Lab & Radiology**
    - Digital order entry
    - 🆕 Sample collection & tracking
    - Result entry & validation
    - 🆕 Critical value alerts
    - 🆕 Report approval
    - EMR integration
    - 🆕 Time stamps

16. **Billing**
    - Itemized billing
    - Medicine, service, bed, OT charges
    - 🆕 Tariff master
    - 🆕 Auto charge capture
    - 🆕 Discount control with approval
    - 🆕 Audit trail
    - Final bill generation
    - 🆕 Bed occupancy tracking
    - 🆕 Revenue reports

17. **MIS & Dashboards**
    - 🆕 Patient flow analysis
    - 🆕 Department productivity
    - 🆕 ER waiting time
    - 🆕 Exportable reports
    - 🆕 Role-based dashboards

18. **🆕 Risk & Incident Management**
    - 🆕 Incident reporting
    - 🆕 Near-miss logging
    - 🆕 Risk assessment
    - 🆕 CAPA tracking
    - 🆕 Audit trails
    - 🆕 Safety compliance (ISO 14971)

19. **🆕 Resource Utilization Module**
    - 🆕 Bed occupancy tracking
    - 🆕 ICU / ward / OT resource allocation
    - 🆕 Equipment usage tracking
    - 🆕 Staff & shift assignment
    - 🆕 Consumables monitoring
    - 🆕 Utilization dashboards
    - 🆕 Shortage alerts
    - 🆕 Resource audit trail

20. **🆕 Nursing Module**
    - 🆕 Role-based access
    - 🆕 Patient care workflows
    - 🆕 Vital signs recording
    - 🆕 Nursing & progress notes
    - 🆕 Medication administration (MAR)
    - 🆕 Care plan management
    - 🆕 Shift handover logging
    - 🆕 Critical alerts
    - 🆕 Audit trail & compliance

21. **🆕 Diagnostic Module**
    - 🆕Lab test order entry
    - 🆕 Sample collection & tracking
    - 🆕 Result entry & validation
    - 🆕 Critical alerts
    - 🆕 Report verification
    - 🆕 EMR integration
    - 🆕 Billing linkage
    - 🆕 Role-based access
    - 🆕 Audit trail

### AI Features:
1. **Revenue Leakage Detection (Priority)**
   - Detects unbilled services
   - Flags unbilled medicines
   - Identifies unusual billing patterns
   - Real-time alerts dashboard

2. **Predictive Analytics (Optional)**
   - OPD rush hour predictions
   - Bed occupancy forecasting
   - Lab workload forecasting
   - Resource planning insights

---

## 🆕 Compliance & Standards

### ISO Standards
- **ISO 14971**: Risk management for medical devices
- **IEC 62304**: Medical device software lifecycle
- **IEC 62366**: Usability engineering for medical devices

### Healthcare Standards
- **HIPAA**: Health Insurance Portability and Accountability Act
- **NABH**: National Accreditation Board for Hospitals
- **ICD-10/ICD-11**: International Classification of Diseases
- **CPT**: Current Procedural Terminology

### Safety Protocols
- **WHO Surgical Safety Checklist**: Mandatory for all surgeries
- **Break-glass Access**: Emergency override with full audit
- **Drug Interaction Checking**: Real-time validation
- **Critical Value Alerts**: Automated notifications

---

## 🆕 User Roles & Permissions

### Role Definitions
1. **Admin**: Full system access, configuration, user management
2. **Doctor**: Clinical records, prescriptions, orders, consultations
3. **Nurse**: Vital signs, medication administration, care plans, shift handovers
4. **Receptionist**: Patient registration, appointments, basic demographics
5. **Lab Technician**: Lab orders, sample collection, result entry
6. **Radiologist**: Radiology orders, report entry, image viewing
7. **Pharmacist**: Medicine dispensing, inventory, drug interaction checks
8. **Billing**: Bill generation, payment collection, revenue tracking
9. **Insurance Coordinator**: Claims, pre-authorization, TPA coordination
10. **Compliance Officer**: Audit logs, incident reports, CAPA tracking

---

This PRD provides a **complete and comprehensive blueprint** for building the HIS system with all the features from PS_03 requirements integrated into the existing structure. All new additions are marked with 🆕 for easy identification.