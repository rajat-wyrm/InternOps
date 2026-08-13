import logging
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status
from pydantic import UUID4

from app.core.auth import User, get_current_user
from app.core.rbac import require_roles
from app.core.database import get_pool
from app.attendance.schemas.anomaly_schema import (
    AnomalyResponse,
    AnomalyListResponse,
    TriggerAnalysisResponse
)
from app.attendance.jobs.attendance_anomaly_job import AttendanceAnomalyJob

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/attendance/anomalies", tags=["Attendance Anomalies"])

async def get_manager_subordinate_ids(conn, manager_id: str) -> List[str]:
    """Retrieve all recursive subordinate user IDs for a given manager."""
    rows = await conn.fetch(
        """
        WITH RECURSIVE subordinates AS (
           SELECT id FROM users WHERE manager_id = $1::uuid AND deleted_at IS NULL
           UNION ALL
           SELECT u.id FROM users u
           INNER JOIN subordinates s ON u.manager_id = s.id
           WHERE u.deleted_at IS NULL
        )
        SELECT id FROM subordinates
        """,
        manager_id
    )
    return [str(row["id"]) for row in rows]

async def run_anomaly_job_async():
    """Helper to run the background job."""
    try:
        job = AttendanceAnomalyJob()
        await job.run()
    except Exception as e:
        logger.error(f"Background anomaly job failed: {e}")

@router.post(
    "/analyze",
    response_model=TriggerAnalysisResponse,
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(require_roles("ADMIN", "SENIOR_TL", "TL"))],
)
async def trigger_analysis(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """
    Trigger the AI attendance anomaly detection analysis job in the background.
    """
    background_tasks.add_task(run_anomaly_job_async)
    return TriggerAnalysisResponse(
        status="accepted",
        message="AI attendance anomaly detection job has been scheduled in the background."
    )

@router.get(
    "",
    response_model=AnomalyListResponse,
    dependencies=[Depends(require_roles("ADMIN", "SENIOR_TL", "TL", "CAPTAIN"))]
)
async def list_anomalies(
    current_user: User = Depends(get_current_user),
    intern_id: Optional[str] = None,
    flag_type: Optional[str] = None,
    viewed: Optional[bool] = None
):
    """
    List all detected attendance anomalies.
    Enforces manager hierarchy boundaries so TLs/Captains only see their subordinates.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        # Check if user is Admin. If not, restrict to subordinates
        is_admin = "ADMIN" in current_user.roles
        subordinate_ids = []
        if not is_admin:
            subordinate_ids = await get_manager_subordinate_ids(conn, current_user.id)
            if not subordinate_ids:
                return AnomalyListResponse(anomalies=[], total=0)

        # Build SQL query dynamically
        query = """
            SELECT 
                a.id, a.intern_id, a.flag_type, a.severity, a.reason, a.details,
                a.viewed_by, a.viewed_at, a.notification_status, a.created_at, a.updated_at,
                u.full_name AS intern_name, u.email AS intern_email,
                v.full_name AS viewed_by_name
            FROM attendance_anomalies a
            JOIN users u ON u.id = a.intern_id
            LEFT JOIN users v ON v.id = a.viewed_by
            WHERE 1=1
        """
        params = []
        param_idx = 1

        if not is_admin:
            query += f" AND a.intern_id = ANY(${param_idx}::uuid[])"
            params.append(subordinate_ids)
            param_idx += 1

        if intern_id:
            query += f" AND a.intern_id = ${param_idx}::uuid"
            params.append(intern_id)
            param_idx += 1

        if flag_type:
            query += f" AND a.flag_type = ${param_idx}"
            params.append(flag_type)
            param_idx += 1

        if viewed is not None:
            if viewed:
                query += " AND a.viewed_at IS NOT NULL"
            else:
                query += " AND a.viewed_at IS NULL"

        query += " ORDER BY a.created_at DESC"

        rows = await conn.fetch(query, *params)
        
        anomalies = []
        for r in rows:
            details_val = None
            if r["details"]:
                if isinstance(r["details"], str):
                    details_val = json.loads(r["details"])
                else:
                    details_val = dict(r["details"])

            anomalies.append(AnomalyResponse(
                id=str(r["id"]),
                intern_id=str(r["intern_id"]),
                flag_type=r["flag_type"],
                severity=r["severity"],
                reason=r["reason"],
                details=details_val,
                viewed_by=str(r["viewed_by"]) if r["viewed_by"] else None,
                viewed_by_name=r["viewed_by_name"],
                viewed_at=r["viewed_at"],
                notification_status=r["notification_status"],
                created_at=r["created_at"],
                updated_at=r["updated_at"],
                intern_name=r["intern_name"],
                intern_email=r["intern_email"]
            ))

        return AnomalyListResponse(anomalies=anomalies, total=len(anomalies))

@router.post(
    "/{anomaly_id}/view",
    response_model=AnomalyResponse,
    dependencies=[Depends(require_roles("ADMIN", "SENIOR_TL", "TL", "CAPTAIN"))]
)
async def mark_anomaly_viewed(
    anomaly_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Mark an anomaly flag as viewed by the manager/admin.
    Verifies that the caller has access to the intern's data.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        # Fetch the anomaly to verify ownership
        anomaly_row = await conn.fetchrow(
            """
            SELECT intern_id FROM attendance_anomalies WHERE id = $1::uuid
            """,
            anomaly_id
        )

        if not anomaly_row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Anomaly not found"
            )

        intern_id = str(anomaly_row["intern_id"])
        is_admin = "ADMIN" in current_user.roles

        # Verify access
        if not is_admin:
            subordinates = await get_manager_subordinate_ids(conn, current_user.id)
            if intern_id not in subordinates:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: You can only view anomalies for members in your hierarchy."
                )

        # Update viewed status
        await conn.execute(
            """
            UPDATE attendance_anomalies
            SET viewed_by = $1::uuid, viewed_at = NOW(), updated_at = NOW()
            WHERE id = $2::uuid
            """,
            current_user.id,
            anomaly_id
        )

        # Create audit log
        try:
            intern_row = await conn.fetchrow("SELECT full_name, email FROM users WHERE id = $1::uuid", intern_id)
            intern_name = intern_row["full_name"] or intern_row["email"] if intern_row else intern_id
            
            audit_details = {
                "anomaly_id": anomaly_id,
                "intern_id": intern_id,
                "intern_name": intern_name,
                "viewed_by_user_id": current_user.id,
                "action": "viewed"
            }
            await conn.execute(
                """
                INSERT INTO audit_logs (
                    action,
                    resource_type,
                    resource_id,
                    user_id,
                    details,
                    created_at
                )
                VALUES ($1, $2, $3, $4, $5, NOW())
                """,
                "ATTENDANCE_ANOMALY_VIEWED",
                "attendance_anomaly",
                anomaly_id,
                current_user.id,
                json.dumps(audit_details)
            )
        except Exception as e:
            logger.error(f"Failed to log audit record for anomaly viewing: {e}")

        # Fetch updated record to return
        updated = await conn.fetchrow(
            """
            SELECT 
                a.id, a.intern_id, a.flag_type, a.severity, a.reason, a.details,
                a.viewed_by, a.viewed_at, a.notification_status, a.created_at, a.updated_at,
                u.full_name AS intern_name, u.email AS intern_email,
                v.full_name AS viewed_by_name
            FROM attendance_anomalies a
            JOIN users u ON u.id = a.intern_id
            LEFT JOIN users v ON v.id = a.viewed_by
            WHERE a.id = $1::uuid
            """,
            anomaly_id
        )

        return AnomalyResponse(
            id=str(updated["id"]),
            intern_id=str(updated["intern_id"]),
            flag_type=updated["flag_type"],
            severity=updated["severity"],
            reason=updated["reason"],
            details=json.loads(updated["details"]) if isinstance(updated["details"], str) else dict(updated["details"]) if updated["details"] else None,
            viewed_by=str(updated["viewed_by"]) if updated["viewed_by"] else None,
            viewed_by_name=updated["viewed_by_name"],
            viewed_at=updated["viewed_at"],
            notification_status=updated["notification_status"],
            created_at=updated["created_at"],
            updated_at=updated["updated_at"],
            intern_name=updated["intern_name"],
            intern_email=updated["intern_email"]
        )
