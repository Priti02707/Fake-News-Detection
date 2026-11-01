"""Bounded, per-process abuse guard; deployment ingress limits remain recommended."""
import logging
import os
import re
import threading
import time
import uuid
from collections import defaultdict, deque

logger = logging.getLogger("verity.requests")
if not logger.handlers:
    logger.addHandler(logging.StreamHandler())
logger.setLevel(logging.INFO)
logger.propagate = False


class RequestGuard:
    def __init__(self, limit=120, window=60, capacity=1000):
        self.limit, self.window, self.capacity = limit, window, capacity
        self.requests = defaultdict(deque)
        self.lock = threading.Lock()

    def allowed(self, client, now=None):
        now = time.monotonic() if now is None else now
        with self.lock:
            expired = [key for key, values in self.requests.items() if not values or values[-1] <= now - self.window]
            for key in expired: del self.requests[key]
            if client not in self.requests and len(self.requests) >= self.capacity: return False
            values = self.requests[client]
            while values and values[0] <= now - self.window: values.popleft()
            if len(values) >= self.limit: return False
            values.append(now)
            return True


def correlation_id(value):
    return value if value and re.fullmatch(r"[A-Za-z0-9_-]{8,64}", value) else uuid.uuid4().hex


guard = RequestGuard()
