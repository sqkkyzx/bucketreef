# Copyright (c) 2026 Laurent Barbe
# Licensed under the Apache License, Version 2.0
import hashlib
from contextlib import contextmanager
from threading import Lock
from typing import Iterator, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session


_ACCESS_KEY_LOCK_NAMESPACE = 0x42524B59
_ACCESS_KEY_PROCESS_LOCK = Lock()


def _advisory_key(
    storage_endpoint_id: int,
    uid: str,
    tenant: Optional[str],
) -> int:
    normalized_uid = uid.strip()
    normalized_tenant = tenant.strip() if isinstance(tenant, str) else None
    qualified_uid = normalized_uid
    if normalized_tenant and not normalized_uid.startswith(f"{normalized_tenant}$"):
        qualified_uid = f"{normalized_tenant}${normalized_uid}"
    lock_identity = f"{storage_endpoint_id}\0{qualified_uid}"
    return int.from_bytes(
        hashlib.blake2s(lock_identity.encode("utf-8"), digest_size=4).digest(),
        byteorder="big",
        signed=True,
    )


@contextmanager
def rgw_access_key_creation_lock(
    db: Session,
    *,
    storage_endpoint_id: int,
    uid: str,
    tenant: Optional[str] = None,
) -> Iterator[None]:
    """Serialize key creation; PostgreSQL releases the lock with the caller's transaction."""
    advisory_key = _advisory_key(storage_endpoint_id, uid, tenant)

    with _ACCESS_KEY_PROCESS_LOCK:
        bind = db.get_bind()
        if bind.dialect.name == "postgresql":
            db.execute(
                text(
                    "SELECT pg_advisory_xact_lock("
                    ":lock_namespace, :identity_key"
                    ")"
                ),
                {
                    "lock_namespace": _ACCESS_KEY_LOCK_NAMESPACE,
                    "identity_key": advisory_key,
                },
            )
        yield
