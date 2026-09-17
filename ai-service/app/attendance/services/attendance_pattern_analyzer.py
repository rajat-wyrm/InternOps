import datetime
import logging
import math
from typing import Dict, List, Set, Any
from app.core.database import get_pool

logger = logging.getLogger(__name__)

def calculate_std_dev(values: List[float]) -> float:
    """Calculate sample standard deviation of a list of floats."""
    n = len(values)
    if n < 2:
        return 0.0
    mean = sum(values) / n
    variance = sum((x - mean) ** 2 for x in values) / (n - 1)
    return math.sqrt(variance)

def time_to_minutes(t) -> float:
    """Convert datetime.time or HH:MM:SS string to minutes past midnight."""
    if isinstance(t, datetime.time):
        return t.hour * 60 + t.minute + t.second / 60.0
    elif isinstance(t, str):
        try:
            parts = list(map(int, t.split(':')))
            if len(parts) >= 2:
                sec = parts[2] if len(parts) > 2 else 0
                return parts[0] * 60 + parts[1] + sec / 60.0
        except Exception:
            pass
    return 0.0

def format_time_am_pm(t) -> str:
    """Format time object or string to HH:MM AM/PM."""
    if isinstance(t, datetime.time):
        return t.strftime("%I:%M %p")
    elif isinstance(t, str):
        try:
            parts = list(map(int, t.split(':')))
            if len(parts) >= 2:
                dt = datetime.time(parts[0], parts[1])
                return dt.strftime("%I:%M %p")
        except Exception:
            pass
    return str(t)

class AttendancePatternAnalyzer:
    def __init__(self, window_days: int = 30):
        self.window_days = window_days

    async def get_active_interns(self, conn) -> List[Dict[str, Any]]:
        """Fetch all non-deleted interns from the database."""
        rows = await conn.fetch(
            """
            SELECT id, department_id, manager_id, full_name, email
            FROM users
            WHERE role = 'INTERN' AND deleted_at IS NULL
            """
        )
        return [dict(row) for row in rows]

    async def analyze_all_patterns(self) -> Dict[str, Dict[str, Any]]:
        """
        Analyze attendance patterns for all active interns.
        Returns a dictionary mapping intern_id -> stats_dict.
        """
        pool = await get_pool()
        async with pool.acquire() as conn:
            # 1. Fetch interns
            interns = await self.get_active_interns(conn)
            if not interns:
                logger.info("No active interns found for pattern analysis.")
                return {}

            intern_ids = [str(i["id"]) for i in interns]
            intern_map = {str(i["id"]): i for i in interns}

            # 2. Define date window
            end_date = datetime.date.today()
            start_date = end_date - datetime.timedelta(days=self.window_days)

            # 3. Fetch attendance records in date range for these interns
            # Uses user_id = ANY(...) AND date >= ... to leverage index on user_id + date
            attendance_rows = await conn.fetch(
                """
                SELECT id, user_id, date, status, arrival_time, remarks
                FROM attendance
                WHERE user_id = ANY($1::uuid[])
                  AND date >= $2
                  AND deleted_at IS NULL
                """,
                intern_ids,
                start_date,
            )

            # 4. Fetch exemptions (public holidays, leaves, etc.)
            exemption_rows = await conn.fetch(
                """
                SELECT user_id, exemption_date, exemption_type, description
                FROM attendance_exemptions
                WHERE (user_id IS NULL OR user_id = ANY($1::uuid[]))
                  AND exemption_date >= $2
                  AND deleted_at IS NULL
                """,
                intern_ids,
                start_date,
            )

            # 5. Organise data by intern
            intern_attendance: Dict[str, List[Dict[str, Any]]] = {i_id: [] for i_id in intern_ids}
            for row in attendance_rows:
                i_id = str(row["user_id"])
                if i_id in intern_attendance:
                    intern_attendance[i_id].append(dict(row))

            intern_exemptions: Dict[str, Set[datetime.date]] = {i_id: set() for i_id in intern_ids}
            global_exemptions: Set[datetime.date] = set()

            for row in exemption_rows:
                u_id = row["user_id"]
                ex_date = row["exemption_date"]
                if u_id is None:
                    global_exemptions.add(ex_date)
                else:
                    su_id = str(u_id)
                    if su_id in intern_exemptions:
                        intern_exemptions[su_id].add(ex_date)

            # 6. Calculate working days (Mon-Fri) excluding exemptions
            # Prepare date list in window
            all_dates = []
            curr = start_date
            while curr <= end_date:
                all_dates.append(curr)
                curr += datetime.timedelta(days=1)

            # Analyze each intern
            results = {}
            for i_id, intern in intern_map.items():
                exempt_dates = global_exemptions.union(intern_exemptions[i_id])
                
                # Active working days (weekdays not in exemptions list)
                working_days = [d for d in all_dates if d.weekday() < 5 and d not in exempt_dates]
                working_days_set = set(working_days)

                att_records = intern_attendance[i_id]
                # Filter attendance records to only count working days
                att_by_date = {r["date"]: r for r in att_records if r["date"] in working_days_set}

                present_count = 0
                absence_count = 0
                late_arrivals = []
                arrival_times_mins = []
                arrival_freq = {}

                # Loop through working days to identify presence and absences
                for w_day in working_days:
                    record = att_by_date.get(w_day)
                    if not record:
                        # Missing attendance on working day counts as an absence
                        absence_count += 1
                        continue

                    status = record["status"]
                    if status == "ABSENT":
                        absence_count += 1
                    elif status in ("PRESENT", "HALF_DAY"):
                        present_count += 1
                        
                        arrival_time = record.get("arrival_time")
                        if arrival_time:
                            # Convert arrival time to minutes past midnight
                            mins = time_to_minutes(arrival_time)
                            arrival_times_mins.append(mins)

                            # Determine late arrivals (expected start: 09:00:00)
                            # Any arrival after 09:00:00 counts as late
                            late_limit_mins = time_to_minutes(datetime.time(9, 0, 0))
                            if mins > late_limit_mins:
                                # Format HH:MM representation
                                time_str = format_time_am_pm(arrival_time)
                                arrival_freq[time_str] = arrival_freq.get(time_str, 0) + 1
                                late_arrivals.append(arrival_time)

                total_working_days = len(working_days)
                attendance_pct = (present_count / total_working_days * 100.0) if total_working_days > 0 else 100.0
                arrival_std_dev = calculate_std_dev(arrival_times_mins) if len(arrival_times_mins) >= 2 else 0.0

                results[i_id] = {
                    "intern_id": i_id,
                    "full_name": intern["full_name"],
                    "email": intern["email"],
                    "department_id": str(intern["department_id"]) if intern["department_id"] else None,
                    "manager_id": str(intern["manager_id"]) if intern["manager_id"] else None,
                    "working_days_count": total_working_days,
                    "present_days_count": present_count,
                    "absence_days_count": absence_count,
                    "attendance_pct": attendance_pct,
                    "late_arrivals_count": len(late_arrivals),
                    "arrival_times_mins": arrival_times_mins,
                    "arrival_freq": arrival_freq,
                    "arrival_std_dev": arrival_std_dev
                }

            return results
