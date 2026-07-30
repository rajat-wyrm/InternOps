import time
import asyncio
from enum import Enum
from typing import Optional

class CircuitState(Enum):
    CLOSED = "closed"
    OPEN = "open" 
    HALF_OPEN = "half_open"

class CircuitBreaker:
    def __init__(self, failure_threshold: int = 3, recovery_timeout: int = 30):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.failure_count = 0
        self.last_failure_time = 0
        self.state = CircuitState.CLOSED
    
    def can_execute(self) -> bool:
        if self.state == CircuitState.CLOSED:
            return True
        if self.state == CircuitState.OPEN:
            if time.time() - self.last_failure_time > self.recovery_timeout:
                self.state = CircuitState.HALF_OPEN
                return True
            return False
        return True # HALF_OPEN
    
    def record_success(self):
        self.failure_count = 0
        self.state = CircuitState.CLOSED
    
    def record_failure(self):
        self.failure_count += 1
        self.last_failure_time = time.time()
        if self.failure_count >= self.failure_threshold:
            self.state = CircuitState.OPEN

class BaseAIProvider:
    def __init__(self):
        self.circuit_breaker = CircuitBreaker()
    
    async def call_with_failover(self, providers: list):
        for i, provider in enumerate(providers):
            if not provider.circuit_breaker.can_execute():
                continue
            try:
                # exponential backoff: 1s, 2s, 4s
                await asyncio.sleep(2 ** i)
                result = await provider.generate()
                provider.circuit_breaker.record_success()
                return result
            except Exception:
                provider.circuit_breaker.record_failure()
        raise Exception("All providers failed")