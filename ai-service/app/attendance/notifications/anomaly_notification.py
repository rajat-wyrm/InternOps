import json
import logging
from app.core.config import settings
from app.core.database import get_pool

logger = logging.getLogger(__name__)

ATTENDANCE_NOTIFICATION_ENABLED = getattr(settings, "ATTENDANCE_NOTIFICATION_ENABLED", True)

async def trigger_anomaly_notifications(anomalies: list) -> None:
    """
    Trigger notifications for direct managers and record audit logs.
    """
    if not anomalies:
        return

    pool = await get_pool()
    async with pool.acquire() as conn:
        for anomaly in anomalies:
            anomaly_id = anomaly["id"]
            intern_id = anomaly["intern_id"]
            flag_type = anomaly["flag_type"]
            severity = anomaly["severity"]
            reason = anomaly["reason"]

            # 1. Fetch manager details and intern details
            intern_row = await conn.fetchrow(
                """
                SELECT full_name, email, manager_id
                FROM users
                WHERE id = $1 AND deleted_at IS NULL
                """,
                intern_id
            )

            if not intern_row:
                logger.warning(f"Could not find intern {intern_id} for notification trigger.")
                continue

            intern_name = intern_row["full_name"] or intern_row["email"]
            manager_id = intern_row["manager_id"]
            notification_status = "SKIPPED_DISABLED"

            # 2. Insert notification if enabled and manager exists
            if ATTENDANCE_NOTIFICATION_ENABLED and manager_id:
                try:
                    notification_msg = (
                        f"AI Attendance Anomaly Alert: Intern {intern_name} has a flagged pattern "
                        f"({flag_type} - {severity}): {reason}"
                    )

                    await conn.execute(
                        """
                        INSERT INTO notifications (user_id, message, read, created_at)
                        VALUES ($1, $2, FALSE, NOW())
                        """,
                        manager_id,
                        notification_msg
                    )
                    notification_status = "SENT"
                    logger.info(f"Notification sent to manager {manager_id} for anomaly {anomaly_id}.")
                except Exception as e:
                    notification_status = "FAILED"
                    logger.error(f"Failed to send notification to manager {manager_id}: {e}")
            else:
                if not manager_id:
                    notification_status = "NO_MANAGER"
                    logger.info(f"Skipped notification for anomaly {anomaly_id}: intern has no manager.")
                else:
                    logger.info(f"Skipped notification for anomaly {anomaly_id}: notifications disabled.")

            # 3. Update anomaly record with the notification status
            await conn.execute(
                """
                UPDATE attendance_anomalies
                SET notification_status = $1, updated_at = NOW()
                WHERE id = $2
                """,
                notification_status,
                anomaly_id
            )

            # 4. Insert Audit Log
            try:
                audit_details = {
                    "anomaly_id": str(anomaly_id),
                    "intern_id": str(intern_id),
                    "intern_name": intern_name,
                    "flag_type": flag_type,
                    "severity": severity,
                    "reason": reason,
                    "notification_status": notification_status
                }

                await conn.execute(
                    """
                    INSERT INTO audit_logs (
                        action,
                        resource_type,
                        resource_id,
                        details,
                        created_at
                    )
                    VALUES ($1, $2, $3, $4, NOW())
                    """,
                    "ATTENDANCE_ANOMALY_DETECTED",
                    "attendance_anomaly",
                    anomaly_id,
                    json.dumps(audit_details)
                )
            except Exception as e:
                logger.error(f"Failed to write audit log for anomaly {anomaly_id}: {e}")
