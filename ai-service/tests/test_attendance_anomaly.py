import pytest
import datetime
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.attendance.services.attendance_pattern_analyzer import (
    calculate_std_dev,
    time_to_minutes,
    format_time_am_pm,
    AttendancePatternAnalyzer
)
from app.attendance.services.anomaly_detector import AnomalyDetector
from app.api.v1.endpoints.attendance import router
from app.core.auth import get_current_user, User


# ==============================================================================
# Unit Tests for Helper Functions
# ==============================================================================

def test_time_to_minutes():
    assert time_to_minutes(datetime.time(9, 0, 0)) == 540.0
    assert time_to_minutes(datetime.time(9, 15, 30)) == 555.5
    assert time_to_minutes("09:15:30") == 555.5
    assert time_to_minutes("09:15") == 555.0
    assert time_to_minutes("invalid") == 0.0

def test_format_time_am_pm():
    assert format_time_am_pm(datetime.time(9, 15, 0)) == "09:15 AM"
    assert format_time_am_pm(datetime.time(13, 5, 0)) == "01:05 PM"
    assert format_time_am_pm("09:15") == "09:15 AM"

def test_calculate_std_dev():
    assert calculate_std_dev([10.0, 10.0, 10.0]) == 0.0
    # Standard dev of [10, 20] is ~7.07
    assert abs(calculate_std_dev([10.0, 20.0]) - 7.071) < 0.01
    assert calculate_std_dev([10.0]) == 0.0
    assert calculate_std_dev([]) == 0.0


# ==============================================================================
# Unit Tests for AnomalyDetector Rules
# ==============================================================================

def test_anomaly_detector_rules():
    detector = AnomalyDetector()
    detector.repetitive_threshold = 3  # lower for testing
    detector.zscore_threshold = 1.0

    fake_stats = {
        "intern_1": {
            "intern_id": "intern_1",
            "department_id": "dept_A",
            "manager_id": "manager_1",
            "working_days_count": 10,
            "present_days_count": 10,
            "absence_days_count": 0,
            "attendance_pct": 100.0,
            "arrival_freq": {"09:15 AM": 5},  # 5 identical late arrivals -> repetitive late
            "arrival_times_mins": [555.0, 555.0, 555.0, 555.0, 555.0],
            "arrival_std_dev": 0.0  # 0 variance -> suspicious consistency
        },
        "intern_2": {
            "intern_id": "intern_2",
            "department_id": "dept_A",
            "manager_id": "manager_1",
            "working_days_count": 10,
            "present_days_count": 4,
            "absence_days_count": 6,  # 6 absences (dept avg will be 2.0 -> unusual absence & outlier)
            "attendance_pct": 40.0,
            "arrival_freq": {},
            "arrival_times_mins": [530.0, 535.0, 532.0, 528.0],
            "arrival_std_dev": 2.9
        },
        "intern_3": {
            "intern_id": "intern_3",
            "department_id": "dept_A",
            "manager_id": "manager_1",
            "working_days_count": 10,
            "present_days_count": 10,
            "absence_days_count": 0,
            "attendance_pct": 100.0,
            "arrival_freq": {},
            "arrival_times_mins": [530.0, 538.0, 542.0, 528.0, 535.0],
            "arrival_std_dev": 5.8
        }
    }

    anomalies = detector.detect_anomalies(fake_stats)
    
    # Verify u1 triggers Repetitive Late and Suspicious Consistency
    u1_flags = [a for a in anomalies if a["intern_id"] == "intern_1"]
    flag_types = {f["flag_type"] for f in u1_flags}
    assert "repetitive_late_pattern" in flag_types
    assert "suspicious_consistency" in flag_types

    # Verify u2 triggers Unusual Absence and Outlier
    u2_flags = [a for a in anomalies if a["intern_id"] == "intern_2"]
    u2_flag_types = {f["flag_type"] for f in u2_flags}
    assert "unusual_absence_pattern" in u2_flag_types
    assert "attendance_outlier" in u2_flag_types


# ==============================================================================
# Endpoint Integration Tests
# ==============================================================================

@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_current_user] = lambda: User(id="manager_1", roles=["TL"])
    return TestClient(app, raise_server_exceptions=False)

def test_trigger_analyze_endpoint(client, monkeypatch):
    # Mock AttendanceAnomalyJob.run so we don't hit the DB in endpoints test
    class MockJob:
        async def run(self):
            return {"status": "success", "anomalies_saved": 0}

    monkeypatch.setattr("app.api.v1.endpoints.attendance.AttendanceAnomalyJob", lambda: MockJob())

    r = client.post("/attendance/anomalies/analyze")
    assert r.status_code == 202
    assert r.json() == {
        "status": "accepted",
        "message": "AI attendance anomaly detection job has been scheduled in the background."
    }

def test_list_anomalies_requires_auth(client):
    app = FastAPI()
    app.include_router(router)
    # No dependency override -> no user -> should fail or expect auth header
    unauth_client = TestClient(app, raise_server_exceptions=False)
    r = unauth_client.get("/attendance/anomalies")
    assert r.status_code == 401
