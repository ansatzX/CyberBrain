"""Escalation service package."""

from .escalation_client import (
    EscalationClient,
    add_escalation,
    cancel_escalation,
    get_client,
    get_status,
    register_session,
    shutdown_service,
    start_service,
    unregister_session,
)

__all__ = [
    "EscalationClient",
    "add_escalation",
    "cancel_escalation",
    "get_client",
    "get_status",
    "register_session",
    "shutdown_service",
    "start_service",
    "unregister_session",
]
