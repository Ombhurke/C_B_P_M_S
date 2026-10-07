"""Small append-only audit helper for security-relevant customer and job events."""
import time
import uuid


def record_audit(records, action, actor=None, target=None, metadata=None):
    event_id = "audit-" + uuid.uuid4().hex
    records.put("audit_events", event_id, {
        "id": event_id,
        "action": action,
        "actor": actor,
        "target": target,
        "metadata": metadata or {},
        "created_at_epoch": time.time(),
    })
