"""
Text Extractor Module
=====================
Extracts patient information from ID card images using Donut model.
Parses name, DOB, gender, and Aadhaar number from extracted text.
"""

import re
import torch
from PIL import Image
from typing import Dict, Optional, Any
import logging
from datetime import datetime


# Configure logging
logger = logging.getLogger(__name__)

import pytesseract

# Set Tesseract Path for Windows
# Try common default paths if not in PATH
tesseract_paths = [
    r'C:\Program Files\Tesseract-OCR\tesseract.exe',
    r'C:\Program Files (x86)\Tesseract-OCR\tesseract.exe'
]

for path in tesseract_paths:
    from pathlib import Path
    if Path(path).exists():
        pytesseract.pytesseract.tesseract_cmd = path
        logger.info(f"Tesseract found at: {path}")
        break

def extract_text_from_image(image: Image.Image) -> str:
    """
    Use Tesseract OCR to extract text from an ID card image.
    
    Args:
        image: PIL Image object of the ID card
        
    Returns:
        Extracted text content from the image
    """
    try:
        # Convert to RGB if not already
        if image.mode != 'RGB':
            image = image.convert('RGB')
            
        # Extract text using Tesseract
        # lang='eng+hin' can be used if Hindi Tesseract data is installed, keeping 'eng' for safety
        text = pytesseract.image_to_string(image, lang='eng')
        
        logger.info(f"Extracted text (Tesseract): {text[:200]}...")
        return text
    except Exception as e:
        logger.error(f"Tesseract extraction failed: {str(e)}")
        # Fallback empty string
        return ""


def parse_aadhaar_number(text: str) -> Optional[str]:
    """
    Extract Aadhaar number from text.
    Aadhaar is a 12-digit number, often formatted as XXXX XXXX XXXX.
    
    Args:
        text: Text content to search for Aadhaar
        
    Returns:
        Aadhaar number if found, None otherwise
    """
    # Remove extra spaces and normalize
    normalized = re.sub(r'\s+', ' ', text)
    
    # Pattern 1: Aadhaar with spaces (XXXX XXXX XXXX)
    pattern_spaced = r'\b(\d{4}\s+\d{4}\s+\d{4})\b'
    match = re.search(pattern_spaced, normalized)
    if match:
        return re.sub(r'\s+', '', match.group(1))  # Return without spaces
    
    # Pattern 2: Continuous 12 digits
    pattern_continuous = r'\b(\d{12})\b'
    match = re.search(pattern_continuous, normalized)
    if match:
        return match.group(1)
    
    return None


def mask_aadhaar_number(aadhaar: str) -> str:
    """
    Mask Aadhaar number for privacy.
    Format: XXXX XXXX 1234 (last 4 digits visible)
    
    Args:
        aadhaar: 12-digit Aadhaar number (no spaces)
        
    Returns:
        Masked Aadhaar in format XXXX XXXX 1234
    """
    if not aadhaar or len(aadhaar) != 12:
        return "XXXX XXXX XXXX"
    
    return f"XXXX XXXX {aadhaar[-4:]}"


def parse_phone_number(text: str) -> Optional[str]:
    """
    Extract phone/mobile number from text.
    Look for 10-digit numbers, possibly with +91 prefix.
    """
    try:
        # Pattern 1: Robust Labeled Search
        # Looks for Label -> junk (non-digits) -> Number
        # Handles "Mobile No:", "Ph:", "Contact:", "Mob-" etc.
        # Modified to allow newlines ([\s\S]) in the gap
        pattern_relaxed = r'(?i)(?:Mobile|Phone|Mob|Tel|Contact|Ph|Cells?)(?:[\s\S]{0,30}?)((?:\+91[\s-]?)?\d{5}[\s-]?\d{5}|\d{10})'
        match = re.search(pattern_relaxed, text)
        if match:
             raw = re.sub(r'\D', '', match.group(1))
             if len(raw) >= 10:
                 formatted = f"+91 {raw[-10:-5]} {raw[-5:]}"
                 logger.info(f"Phone found via label: {formatted}")
                 return formatted
        
        # Pattern 2: Standalone 10-digit number starting with 6-9
        # Normalize text first to remove spaces/dashes
        text_clean = re.sub(r'[^\d]', ' ', text)
        # Look for 10 digits surrounded by spaces/boundaries
        # Avoid linking with 12-digit Aadhaar
        patterns_simple = [r'\b([6-9]\d{9})\b', r'\s([6-9]\d{4}\s\d{5})\s']
        
        for p in patterns_simple:
            match = re.search(p, text_clean)
            if match:
                 raw = re.sub(r'\D', '', match.group(1))
                 if len(raw) == 10:
                     formatted = f"+91 {raw[:5]} {raw[5:]}"
                     logger.info(f"Phone found via standalone: {formatted}")
                     return formatted
                     
    except Exception as e:
        logger.error(f"Phone parsing error: {e}")
        
    return None

def parse_name(text: str) -> Dict[str, str]:
    """
    Extract name from ID card text.
    Looks for patterns like "Name:", "नाम:", etc.
    """
    result = {"firstName": "", "lastName": ""}
    
    # Clean noise chars that might appear at start of lines
    clean_text = re.sub(r'(?m)^[^a-zA-Z0-9\n]+', '', text)
    
    # Common patterns for name on Indian ID cards
    patterns_labeled = [
        r'(?:Name|नाम|Nane)\s*[:\-]?\s*([A-Za-z\s\.]+)',
        r'(?:To|Son of|S/O|D/O|W/O|Care of|C/O)\s*[:\-]?\s*([A-Za-z\s\.]+)',
    ]
    
    # 1. Try labeled patterns first (High confidence)
    for pattern in patterns_labeled:
        match = re.search(pattern, clean_text, re.IGNORECASE)
        if match:
            if process_name_match(match.group(1), result):
                return result

    # 2. Heuristic: Name is often the line ABOVE the Date of Birth
    # Find DOB line index
    lines = [line.strip() for line in clean_text.split('\n') if line.strip()]
    dob_line_idx = -1
    for i, line in enumerate(lines):
        if re.search(r'(?:DOB|Date of Birth|Year of Birth|\d{2}[/-]\d{2}[/-]\d{4})', line, re.IGNORECASE):
            dob_line_idx = i
            break
            
    if dob_line_idx > 0:
        # Check line before DOB
        candidate_line = lines[dob_line_idx - 1]
        # Must be mostly letters, at least 2 words, Proper Case preferred
        if re.match(r'^[A-Za-z\.\s]+$', candidate_line) and len(candidate_line.split()) >= 2:
             if "Government" not in candidate_line and "India" not in candidate_line:
                 if process_name_match(candidate_line, result):
                     return result

    # 3. Fallback: Strict Proper Case check for lines (Medium confidence)
    # We do NOT use IGNORECASE here to avoid ALL CAPS headers like "GOVERNMENT OF INDIA"
    fallback_pattern = r'(?m)^([A-Z][a-z]+(?:\s+[A-Z][a-z\.]+){1,3})$'
    match = re.search(fallback_pattern, clean_text) # Case sensitive!
    if match:
        if "Government" not in match.group(1) and "India" not in match.group(1):
             process_name_match(match.group(1), result)
            
    return result

def process_name_match(full_name_raw: str, result: Dict[str, str]) -> bool:
    """Helper to clean and set name from a raw string. Returns True if valid name found."""
    # Stop at newlines or common delimiters
    full_name = re.split(r'[\n\r]', full_name_raw)[0]
    
    # Remove unwanted chars
    full_name = re.sub(r'[^\w\s\.]', '', full_name).strip()
    
    # Filter bad matches
    if len(full_name) < 3 or "Government" in full_name or "India" in full_name:
        return False
        
    name_parts = full_name.split()
    if len(name_parts) >= 2:
        result["firstName"] = name_parts[0]
        result["lastName"] = " ".join(name_parts[1:])
        return True
    elif len(name_parts) == 1:
        result["firstName"] = name_parts[0]
        result["lastName"] = ""
        return True
    
    return False

def parse_date_of_birth(text: str) -> Optional[str]:
    """
    Extract date of birth from ID card text.
    
    Args:
        text: Extracted text content
        
    Returns:
        DOB in YYYY-MM-DD format if found
    """
    # Pattern for DOB label
    dob_patterns = [
        r'(?:DOB|Date of Birth|जन्म तिथि|Year of Birth|YOB)\s*[:\-]?\s*(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4})',
        r'(?:DOB|Date of Birth|जन्म तिथि)\s*[:\-]?\s*(\d{4}[/\-\.]\d{1,2}[/\-\.]\d{1,2})',
        r'\b(\d{2}[/\-\.]\d{2}[/\-\.]\d{4})\b',  # DD/MM/YYYY pattern
    ]
    
    for pattern in dob_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            date_str = match.group(1)
            try:
                # Try different date formats
                for fmt in ['%d/%m/%Y', '%d-%m-%Y', '%d.%m.%Y', '%Y/%m/%d', '%Y-%m-%d']:
                    try:
                        parsed = datetime.strptime(date_str, fmt)
                        return parsed.strftime('%Y-%m-%d')
                    except ValueError:
                        continue
            except Exception:
                pass
    
    return None


def parse_gender(text: str) -> Optional[str]:
    """
    Extract gender from ID card text.
    
    Args:
        text: Extracted text content
        
    Returns:
        Gender as 'Male', 'Female', or 'Other'
    """
    text_lower = text.lower()
    
    # Check for male indicators
    if any(indicator in text_lower for indicator in ['male', 'पुरुष', ' m ', '/m', 'gender: m']):
        # Make sure it's not "female"
        if 'female' not in text_lower and 'महिला' not in text_lower:
            return 'Male'
    
    # Check for female indicators
    if any(indicator in text_lower for indicator in ['female', 'महिला', ' f ', '/f', 'gender: f']):
        return 'Female'
    
    # Explicit male check (after female check to avoid matching 'male' in 'female')
    if re.search(r'\bmale\b', text_lower):
        return 'Male'
    
    return None


def extract_patient_details(image: Image.Image) -> Dict[str, Any]:
    """
    Main function to extract all patient details from ID card.
    
    Args:
        image: PIL Image of the ID card
        
    Returns:
        Dictionary containing extracted patient information
    """
    logger.info("Starting patient details extraction...")
    
    # Extract raw text from image
    extracted_text = extract_text_from_image(image)
    
    # Parse individual fields
    aadhaar_raw = parse_aadhaar_number(extracted_text)
    name_parts = parse_name(extracted_text)
    dob = parse_date_of_birth(extracted_text)
    gender = parse_gender(extracted_text)
    phone = parse_phone_number(extracted_text)
    
    # Build result with masked Aadhaar
    result = {
        "firstName": name_parts.get("firstName", ""),
        "lastName": name_parts.get("lastName", ""),
        "dateOfBirth": dob,
        "gender": gender,
        "phone": phone,
        "maskedAadhaar": mask_aadhaar_number(aadhaar_raw) if aadhaar_raw else None,
        "rawAadhaar": aadhaar_raw,  # Internal use only, will be stripped before response
        "extractedText": extracted_text,  # For debugging
        "confidence": "high" if (name_parts.get("firstName") and aadhaar_raw) else "low"
    }
    
    logger.info(f"Extraction complete. Confidence: {result['confidence']}")
    return result
