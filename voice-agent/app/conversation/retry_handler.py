"""
Retry Handler
Implements retry logic with exponential backoff for API calls and LLM requests
"""

import asyncio
from typing import Callable, Any, Optional, List, Type
from functools import wraps
import structlog

logger = structlog.get_logger()


class RetryConfig:
    """Configuration for retry behavior."""
    
    def __init__(
        self,
        max_retries: int = 3,
        base_delay: float = 1.0,
        max_delay: float = 30.0,
        exponential_base: float = 2.0,
        retryable_exceptions: Optional[List[Type[Exception]]] = None
    ):
        self.max_retries = max_retries
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.exponential_base = exponential_base
        self.retryable_exceptions = retryable_exceptions or [
            ConnectionError,
            TimeoutError,
            asyncio.TimeoutError,
        ]


# Default configurations for different scenarios
RETRY_CONFIGS = {
    "llm": RetryConfig(
        max_retries=3,
        base_delay=1.0,
        max_delay=10.0,
    ),
    "his_api": RetryConfig(
        max_retries=2,
        base_delay=0.5,
        max_delay=5.0,
    ),
    "speech": RetryConfig(
        max_retries=2,
        base_delay=0.5,
        max_delay=3.0,
    ),
}


class RetryHandler:
    """
    Handles retries with exponential backoff.
    """
    
    def __init__(self, config: RetryConfig = None):
        self.config = config or RetryConfig()
    
    def _calculate_delay(self, attempt: int) -> float:
        """Calculate delay for current attempt with exponential backoff."""
        delay = self.config.base_delay * (self.config.exponential_base ** attempt)
        return min(delay, self.config.max_delay)
    
    def _is_retryable(self, exception: Exception) -> bool:
        """Check if exception is retryable."""
        return any(
            isinstance(exception, exc_type)
            for exc_type in self.config.retryable_exceptions
        )
    
    async def execute(
        self,
        func: Callable,
        *args,
        operation_name: str = "operation",
        **kwargs
    ) -> Any:
        """
        Execute function with retry logic.
        
        Args:
            func: Async function to execute
            *args: Positional arguments for func
            operation_name: Name for logging
            **kwargs: Keyword arguments for func
            
        Returns:
            Result of func
            
        Raises:
            Last exception if all retries fail
        """
        last_exception = None
        
        for attempt in range(self.config.max_retries + 1):
            try:
                if asyncio.iscoroutinefunction(func):
                    result = await func(*args, **kwargs)
                else:
                    result = func(*args, **kwargs)
                
                if attempt > 0:
                    logger.info(f"{operation_name} succeeded after {attempt + 1} attempts")
                
                return result
                
            except Exception as e:
                last_exception = e
                
                if not self._is_retryable(e):
                    logger.error(f"{operation_name} failed with non-retryable error",
                               error=str(e),
                               error_type=type(e).__name__)
                    raise
                
                if attempt < self.config.max_retries:
                    delay = self._calculate_delay(attempt)
                    logger.warning(f"{operation_name} failed, retrying",
                                  attempt=attempt + 1,
                                  max_retries=self.config.max_retries,
                                  delay=delay,
                                  error=str(e))
                    await asyncio.sleep(delay)
                else:
                    logger.error(f"{operation_name} failed after all retries",
                               attempts=attempt + 1,
                               error=str(e))
        
        raise last_exception


def with_retry(config: RetryConfig = None, operation_name: str = None):
    """
    Decorator for adding retry logic to async functions.
    
    Usage:
        @with_retry(RETRY_CONFIGS["llm"], "LLM classification")
        async def classify_intent(text):
            ...
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            handler = RetryHandler(config)
            name = operation_name or func.__name__
            return await handler.execute(func, *args, operation_name=name, **kwargs)
        return wrapper
    return decorator


class CircuitBreaker:
    """
    Circuit breaker pattern for preventing cascade failures.
    """
    
    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: float = 60.0,
        half_open_requests: int = 1
    ):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.half_open_requests = half_open_requests
        
        self._failures = 0
        self._last_failure_time = None
        self._state = "closed"  # closed, open, half-open
    
    @property
    def is_open(self) -> bool:
        """Check if circuit is open (blocking requests)."""
        if self._state == "open":
            # Check if recovery timeout has passed
            if self._last_failure_time:
                import time
                elapsed = time.time() - self._last_failure_time
                if elapsed >= self.recovery_timeout:
                    self._state = "half-open"
                    logger.info("Circuit breaker entering half-open state")
                    return False
            return True
        return False
    
    def record_success(self):
        """Record successful call."""
        self._failures = 0
        if self._state == "half-open":
            self._state = "closed"
            logger.info("Circuit breaker closed")
    
    def record_failure(self):
        """Record failed call."""
        self._failures += 1
        if self._failures >= self.failure_threshold:
            self._state = "open"
            import time
            self._last_failure_time = time.time()
            logger.warning("Circuit breaker opened",
                          failures=self._failures,
                          recovery_timeout=self.recovery_timeout)
    
    async def execute(self, func: Callable, *args, **kwargs) -> Any:
        """Execute function with circuit breaker protection."""
        if self.is_open:
            raise CircuitBreakerOpenError("Circuit breaker is open, request blocked")
        
        try:
            result = await func(*args, **kwargs)
            self.record_success()
            return result
        except Exception as e:
            self.record_failure()
            raise


class CircuitBreakerOpenError(Exception):
    """Raised when circuit breaker is open."""
    pass
