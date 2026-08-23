import logging
import statistics
from typing import Dict, List, Any
from app.core.config import settings

logger = logging.getLogger(__name__)

# We check if these settings exist on config, else we use sensible defaults
ATTENDANCE_ANOMALY_ENABLED = getattr(settings, "ATTENDANCE_ANOMALY_ENABLED", True)
ATTENDANCE_REPETITIVE_PATTERN_THRESHOLD = getattr(settings, "ATTENDANCE_REPETITIVE_PATTERN_THRESHOLD", 15)
ATTENDANCE_OUTLIER_ZSCORE = getattr(settings, "ATTENDANCE_OUTLIER_ZSCORE", 2.5)

class AnomalyDetector:
    def __init__(self):
        self.repetitive_threshold = ATTENDANCE_REPETITIVE_PATTERN_THRESHOLD
        self.zscore_threshold = ATTENDANCE_OUTLIER_ZSCORE

    def detect_anomalies(self, all_stats: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Evaluate thresholds and detect anomalies across all interns.
        """
        if not ATTENDANCE_ANOMALY_ENABLED:
            logger.info("AI Attendance Anomaly Detection is disabled via config.")
            return []

        anomalies = []
        if not all_stats:
            return []

        # 1. Group stats by department for department-level baseline calculations
        dept_groups: Dict[str, List[Dict[str, Any]]] = {}
        for i_id, stats in all_stats.items():
            dept_id = stats["department_id"] or "unknown"
            if dept_id not in dept_groups:
                dept_groups[dept_id] = []
            dept_groups[dept_id].append(stats)

        # 2. Compute department baselines
        dept_baselines = {}
        for dept_id, group in dept_groups.items():
            absences = [s["absence_days_count"] for s in group]
            attendance_pcts = [s["attendance_pct"] for s in group]

            avg_absences = sum(absences) / len(absences) if absences else 0.0
            avg_pct = sum(attendance_pcts) / len(attendance_pcts) if attendance_pcts else 100.0
            
            # Standard deviation for z-score
            std_dev_pct = statistics.stdev(attendance_pcts) if len(attendance_pcts) >= 2 else 0.0

            dept_baselines[dept_id] = {
                "avg_absences": avg_absences,
                "avg_pct": avg_pct,
                "std_dev_pct": std_dev_pct
            }

        # 3. Detect anomalies for each intern
        for i_id, stats in all_stats.items():
            dept_id = stats["department_id"] or "unknown"
            baseline = dept_baselines.get(dept_id, {"avg_absences": 0.0, "avg_pct": 100.0, "std_dev_pct": 0.0})

            # --- Rule 1: Repetitive Late Arrival ---
            # Check if any specific late arrival time occurs >= threshold
            # We look at the arrival_freq which maps "HH:MM AM/PM" -> count
            for time_str, count in stats["arrival_freq"].items():
                if count >= self.repetitive_threshold:
                    severity = "high" if count >= self.repetitive_threshold + 5 else "medium"
                    anomalies.append({
                        "intern_id": i_id,
                        "flag_type": "repetitive_late_pattern",
                        "severity": severity,
                        "reason": f"Arrived exactly at {time_str} for {count} consecutive working days.",
                        "details": {
                            "arrival_time": time_str,
                            "occurrences": count,
                            "threshold": self.repetitive_threshold
                        }
                    })

            # --- Rule 2: Unusual Absence Pattern ---
            # Flag if absence frequency exceeds department baseline by a margin
            absence_count = stats["absence_days_count"]
            avg_dept_absences = baseline["avg_absences"]
            # Exceeds department average by 1.5x, and has at least 3 absences (to avoid flagging on low numbers)
            if absence_count > avg_dept_absences * 1.5 and absence_count >= 3:
                severity = "high" if absence_count > avg_dept_absences * 3.0 else "medium"
                anomalies.append({
                    "intern_id": i_id,
                    "flag_type": "unusual_absence_pattern",
                    "severity": severity,
                    "reason": f"Absence frequency of {absence_count} days exceeds department baseline of {avg_dept_absences:.1f} days.",
                    "details": {
                        "absence_count": absence_count,
                        "department_average": avg_dept_absences
                    }
                })

            # --- Rule 3: Attendance Outlier ---
            # Flag if attendance pct is a statistical outlier compared to department average
            attendance_pct = stats["attendance_pct"]
            dept_mean = baseline["avg_pct"]
            dept_std = baseline["std_dev_pct"]
            if dept_std > 0.0:
                z_score = (dept_mean - attendance_pct) / dept_std
                # If z-score is positive (meaning intern has lower attendance than mean) and >= zscore_threshold
                if z_score >= self.zscore_threshold:
                    severity = "high" if z_score >= 3.5 else "medium"
                    anomalies.append({
                        "intern_id": i_id,
                        "flag_type": "attendance_outlier",
                        "severity": severity,
                        "reason": f"Attendance rate of {attendance_pct:.1f}% is a statistical outlier compared to department average of {dept_mean:.1f}% (z-score: {z_score:.2f}).",
                        "details": {
                            "attendance_pct": attendance_pct,
                            "department_average": dept_mean,
                            "z_score": z_score,
                            "threshold": self.zscore_threshold
                        }
                    })

            # --- Rule 4: Suspicious Consistency ---
            # Flag if arrival times show extremely low variance
            # Only check if they have at least 5 present records to have statistical meaning
            present_days = stats["present_days_count"]
            std_dev = stats["arrival_std_dev"]
            if present_days >= 5 and len(stats["arrival_times_mins"]) >= 5:
                # 1.0 minute variance threshold (std_dev of arrival times is < 1.0 minutes)
                if std_dev < 1.0:
                    severity = "high" if std_dev < 0.25 else "medium"
                    anomalies.append({
                        "intern_id": i_id,
                        "flag_type": "suspicious_consistency",
                        "severity": severity,
                        "reason": f"Arrival times show abnormally low variation (std dev: {std_dev:.2f} mins) over {present_days} days.",
                        "details": {
                            "standard_deviation_minutes": std_dev,
                            "present_days": present_days
                        }
                    })

        return anomalies
