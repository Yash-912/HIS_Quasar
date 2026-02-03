"""
Voice Agent Configuration
Loads settings from environment variables
"""

from typing import Literal
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # HIS Backend
    his_api_url: str = "http://localhost:5001/api/v1"
    his_api_username: str = "voice_agent"
    his_api_password: str = ""
    
    # LLM Configuration
    llm_provider: Literal["gemini", "openai", "ollama", "openrouter"] = "openrouter"
    gemini_api_key: str = ""
    openai_api_key: str = ""
    openrouter_api_key: str = ""
    openrouter_model: str = "openai/gpt-4o-mini"  # Default OpenRouter model
    ollama_base_url: str = "http://localhost:11434"
    
    # Google Cloud
    google_application_credentials: str = ""
    
    # Voice Settings
    voice_agent_port: int = 5003
    voice_language: str = "en-IN"  # Indian English
    voice_gender: Literal["MALE", "FEMALE", "NEUTRAL"] = "FEMALE"
    
    # Session Management
    session_timeout_seconds: int = 300  # 5 minutes
    max_conversation_turns: int = 20
    
    # Logging
    log_level: str = "INFO"
    log_format: Literal["json", "text"] = "json"
    
    # Security
    jwt_secret_key: str = ""
    encryption_key: str = ""  # For transcript encryption
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
