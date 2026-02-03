"""
Interactive Workflow Test Script
Run this to interactively test all voice agent workflows
"""

import asyncio
import httpx
from typing import Dict, Optional

BASE_URL = "http://localhost:5003"


class WorkflowTester:
    """Interactive tester for voice agent workflows."""
    
    def __init__(self):
        self.client = httpx.AsyncClient(base_url=BASE_URL, timeout=30.0)
        self.session_id: Optional[str] = None
        self.context: Dict = {}
        self.results = []
    
    async def start_call(self, caller_id: str = "9876543210") -> str:
        """Start a new call session."""
        response = await self.client.post("/voice/call", json={
            "caller_id": caller_id,
            "channel": "test"
        })
        data = response.json()
        self.session_id = data["session_id"]
        self.context = {}
        print(f"\n🎙️ Call started: {self.session_id}")
        print(f"🤖 Agent: {data['response_text']}\n")
        return self.session_id
    
    async def say(self, text: str) -> Dict:
        """Send user utterance and get response."""
        print(f"👤 You: {text}")
        
        response = await self.client.post("/conversation/process", json={
            "session_id": self.session_id,
            "user_input": text,
            "context": self.context,
            "return_audio": False
        })
        data = response.json()
        
        self.context = data.get("context") or self.context
        self.results.append(data)
        
        print(f"🤖 Agent: {data['response_text']}")
        print(f"   [Intent: {data['intent']}, Complete: {data['is_complete']}]")
        
        if data.get("requires_human"):
            print("   ⚠️ Human escalation requested")
        print()
        
        return data
    
    async def end_call(self):
        """End the current call."""
        await self.client.delete(f"/session/{self.session_id}")
        print("📞 Call ended\n")


async def test_patient_registration():
    """Test patient registration workflow."""
    print("\n" + "="*60)
    print("TEST: New Patient Registration")
    print("="*60)
    
    tester = WorkflowTester()
    await tester.start_call("9999000123")
    
    await tester.say("I want to register as a new patient")
    await tester.say("My name is Priya Sharma")
    await tester.say("My phone number is 9876543211")
    await tester.say("I was born on 10th January 1985")
    await tester.say("Female")
    await tester.say("Yes, that's correct")
    
    await tester.end_call()


async def test_appointment_booking():
    """Test appointment booking workflow."""
    print("\n" + "="*60)
    print("TEST: Appointment Booking")
    print("="*60)
    
    tester = WorkflowTester()
    await tester.start_call("9876543210")
    
    await tester.say("I need to book an appointment with a heart specialist")
    await tester.say("My phone is 9876543210")
    await tester.say("Tomorrow afternoon")
    await tester.say("Yes please book it")
    
    await tester.end_call()


async def test_opd_checkin():
    """Test OPD check-in workflow."""
    print("\n" + "="*60)
    print("TEST: OPD Check-in")
    print("="*60)
    
    tester = WorkflowTester()
    await tester.start_call("9876543210")
    
    await tester.say("I am here for my appointment")
    await tester.say("My phone number is 9876543210")
    
    await tester.end_call()


async def test_bed_availability():
    """Test bed availability check."""
    print("\n" + "="*60)
    print("TEST: Bed Availability")
    print("="*60)
    
    tester = WorkflowTester()
    await tester.start_call()
    
    await tester.say("Are there any beds available for admission?")
    
    await tester.end_call()


async def test_lab_booking():
    """Test lab test booking."""
    print("\n" + "="*60)
    print("TEST: Lab Test Booking")
    print("="*60)
    
    tester = WorkflowTester()
    await tester.start_call()
    
    await tester.say("I need to get a blood test done")
    
    await tester.end_call()


async def test_status_inquiries():
    """Test various status inquiries."""
    print("\n" + "="*60)
    print("TEST: Status Inquiries")
    print("="*60)
    
    tester = WorkflowTester()
    await tester.start_call("9876543210")
    
    await tester.say("Do I have any pending bills?")
    await tester.say("My phone is 9876543210")
    
    await tester.end_call()


async def test_emergency():
    """Test emergency handling."""
    print("\n" + "="*60)
    print("TEST: Emergency Detection")
    print("="*60)
    
    tester = WorkflowTester()
    await tester.start_call()
    
    await tester.say("This is an emergency! My father is having chest pain and can't breathe!")
    
    await tester.end_call()


async def test_human_escalation():
    """Test human escalation."""
    print("\n" + "="*60)
    print("TEST: Human Escalation")
    print("="*60)
    
    tester = WorkflowTester()
    await tester.start_call()
    
    await tester.say("I want to speak to a human please")
    
    await tester.end_call()


async def run_all_tests():
    """Run all workflow tests."""
    print("\n" + "🏥"*30)
    print("       VOICE AGENT WORKFLOW COVERAGE TESTS")
    print("🏥"*30)
    
    tests = [
        ("Patient Registration", test_patient_registration),
        ("Appointment Booking", test_appointment_booking),
        ("OPD Check-in", test_opd_checkin),
        ("Bed Availability", test_bed_availability),
        ("Lab Booking", test_lab_booking),
        ("Status Inquiries", test_status_inquiries),
        ("Emergency", test_emergency),
        ("Human Escalation", test_human_escalation),
    ]
    
    passed = 0
    failed = 0
    
    for name, test_func in tests:
        try:
            await test_func()
            print(f"✅ {name} - PASSED")
            passed += 1
        except Exception as e:
            print(f"❌ {name} - FAILED: {e}")
            failed += 1
    
    print("\n" + "="*60)
    print(f"RESULTS: {passed} passed, {failed} failed")
    print("="*60)


if __name__ == "__main__":
    print("Voice Agent Workflow Tester")
    print("-" * 40)
    print("Make sure the voice agent is running on http://localhost:5003")
    print("And HIS backend is running on http://localhost:5001")
    print("-" * 40)
    
    asyncio.run(run_all_tests())
