import logging
import json
from app.core.database import get_pool
from app.attendance.services.attendance_pattern_analyzer import AttendancePatternAnalyzer
from app.attendance.services.anomaly_detector import AnomalyDetector
from app.attendance.notifications.anomaly_notification import trigger_anomaly_notifications

logger = logging.getLogger(__name__)

class AttendanceAnomalyJob:
    def __init__(self, window_days: int = 30):
        self.analyzer = AttendancePatternAnalyzer(window_days=window_days)
        self.detector = AnomalyDetector()

    async def run(self) -> dict:
        """
        Execute the anomaly detection process.
        Returns execution statistics.
        """
        logger.info("Starting AI Attendance Anomaly Detection background job...")
        
        try:
            # 1. Analyze attendance patterns
            stats = await self.analyzer.analyze_all_patterns()
            if not stats:
                return {
                    "status": "success",
                    "message": "No interns found to analyze.",
                    "anomalies_detected": 0,
                    "anomalies_saved": 0
                }

            # 2. Detect anomalies using rules
            detected = self.detector.detect_anomalies(stats)
            logger.info(f"Anomaly detection complete. Identified {len(detected)} potential anomalies.")

            saved_anomalies = []
            pool = await get_pool()
            
            async with pool.acquire() as conn:
                async with conn.transaction():
                    for anomaly in detected:
                        intern_id = anomaly["intern_id"]
                        flag_type = anomaly["flag_type"]
                        severity = anomaly["severity"]
                        reason = anomaly["reason"]
                        details = anomaly["details"]

                        # Deduplication logic:
                        # 1. Delete existing unviewed anomalies of the same type for this intern
                        # to avoid cluttering the manager's dashboard.
                        await conn.execute(
                            """
                            DELETE FROM attendance_anomalies
                            WHERE intern_id = $1 AND flag_type = $2 AND viewed_at IS NULL
                            """,
                            intern_id,
                            flag_type
                        )

                        # 2. Skip if there is an existing viewed anomaly of the same type
                        # generated in the last 3 days, to prevent notification fatigue.
                        recent_viewed = await conn.fetchrow(
                            """
                            SELECT id FROM attendance_anomalies
                            WHERE intern_id = $1 AND flag_type = $2 
                              AND viewed_at IS NOT NULL
                              AND created_at >= NOW() - INTERVAL '3 days'
                            """,
                            intern_id,
                            flag_type
                        )

                        if recent_viewed:
                            logger.info(f"Skipping duplicate anomaly alert for intern {intern_id} ({flag_type}) as one was viewed recently.")
                            continue

                        # 3. Save new anomaly
                        row = await conn.fetchrow(
                            """
                            INSERT INTO attendance_anomalies (
                                intern_id,
                                flag_type,
                                severity,
                                reason,
                                details,
                                notification_status,
                                created_at,
                                updated_at
                            )
                            VALUES ($1, $2, $3, $4, $5, 'PENDING', NOW(), NOW())
                            RETURNING id, intern_id, flag_type, severity, reason
                            """,
                            intern_id,
                            flag_type,
                            severity,
                            reason,
                            json.dumps(details)
                        )
                        saved_anomalies.append(dict(row))

            # 3. Trigger manager notifications and write audit logs
            if saved_anomalies:
                await trigger_anomaly_notifications(saved_anomalies)

            logger.info(f"Job completed successfully. Saved {len(saved_anomalies)} new anomalies.")
            return {
                "status": "success",
                "message": f"Processed {len(stats)} interns. Saved {len(saved_anomalies)} anomalies.",
                "anomalies_detected": len(detected),
                "anomalies_saved": len(saved_anomalies)
            }

        except Exception as e:
            logger.error(f"Error executing attendance anomaly detection job: {e}", exc_info=True)
            raise e
