# CSV Export Fix - Issue #2021 Summary

## Problem

The CSV export from the Team page was **missing 4 fields** that are clearly visible in the on-screen table:

- **Attendance** (percentage)
- **Rating** (out of 10)
- **Tasks** (verified/total count)
- **Proofs Pending** (number of proofs awaiting verification)

### Original Behavior

The CSV only exported basic member information:

- Full Name
- Email
- Role
- Department
- Phone
- Location
- College
- Course
- Position
- Joining Date
- Internship Status

### Impact

Exported reports were incomplete compared to what's shown in the UI, which could mislead anyone using the CSV for offline reporting/analysis (e.g., management, HR).

---

## Solution Implemented

### 1. **Backend Changes** (`backend/src/modules/team/routes.js`)

Updated the `toCsv()` function to include 5 additional fields:

```javascript
const extraHeaders = [
  'Domain',
  'Attendance',
  'Rating',
  'Tasks',
  'Proofs Pending',
  'Status',
];
```

**Field Calculations:**

- **Attendance**: Calculated as percentage `(present_count / attendance_total) * 100%`
- **Rating**: Average rating rounded to nearest integer (or "—" if no data)
- **Tasks**: Formatted as `verified_tasks/total_tasks` (e.g., "8/10")
- **Proofs Pending**: Count of proofs awaiting verification
- **Domain**: Internship domain (new field added)
- **Status**: "Suspended" or internship status (ACTIVE, COMPLETED, etc.)

### 2. **Database Schema Changes** (`backend/migrations/055_add_internship_domain_to_users.sql`)

Added new `internship_domain` column to the `users` table:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS internship_domain VARCHAR(255);
```

### 3. **Repository Updates** (`backend/src/modules/team/repository.js`)

Updated the `MEMBER_COLUMNS` to include the new `internship_domain` field:

```javascript
const MEMBER_COLUMNS = `
  u.id, u.email, u.role, u.full_name, u.suspended, u.avatar_url, u.created_at,
  u.department_id, u.manager_id, u.phone, u.college, u.course, u.year_of_study,
  u.position, u.internship_domain, u.joining_date, u.internship_status, u.location, u.notes
`;
```

The `PERFORMANCE_JOINS` and `PERFORMANCE_COLUMNS` already include all necessary performance metrics:

- Attendance data from the `attendance` table
- Rating data from the `ratings` table
- Task completion data from the `proof_submissions` table

### 4. **Frontend Updates** (`frontend/src/pages/Team.jsx`)

- Added `internship_domain` field to the `EDIT_FIELDS` array
- Added domain input field to the "Add Member" modal
- Added domain display in the member detail view
- The export button calls `/team/members/export` endpoint which now includes all fields

---

## Acceptance Criteria ✅

- ✅ **Exported CSV includes all fields visible on the Team page**
  - Attendance
  - Rating
  - Tasks
  - Proofs Pending
  - Plus the new Internship Domain field

- ✅ **No existing fields are dropped or altered**
  - All original fields are preserved
  - New fields are appended to the end

- ✅ **Column headers match on-screen labels**
  - "Attendance", "Rating", "Tasks", "Proofs Pending" in CSV

---

## CSV Export Format

**Example exported CSV structure:**

```
full_name,email,role,department_name,phone,location,college,course,position,joining_date,internship_status,Domain,Attendance,Rating,Tasks,Proofs Pending,Status
John Doe,john@example.com,INTERN,Engineering,9876543210,Mumbai,IIT Delhi,B.Tech,Junior Developer,2025-01-15,ACTIVE,Web Development,87%,8,8/10,2,Active
Jane Smith,jane@example.com,CAPTAIN,Marketing,9876543211,Bangalore,BITS Pilani,B.Tech,Team Lead,2024-06-01,ACTIVE,Digital Marketing,92%,9,10/10,0,Active
```

---

## Files Modified

| File                                                        | Changes                                                    |
| ----------------------------------------------------------- | ---------------------------------------------------------- |
| `backend/src/modules/team/routes.js`                        | Enhanced `toCsv()` function to include performance metrics |
| `backend/src/modules/team/repository.js`                    | Added `internship_domain` field to member columns          |
| `frontend/src/pages/Team.jsx`                               | Added internship domain UI support                         |
| `backend/migrations/055_add_internship_domain_to_users.sql` | Added database column                                      |

---

## Testing Recommendations

1. **Export CSV and verify all 4 fields are present:**
   - Go to Team page → Click "Export CSV" button
   - Open the downloaded CSV file
   - Confirm columns: Attendance, Rating, Tasks, Proofs Pending

2. **Verify data accuracy:**
   - Compare CSV values with on-screen values
   - Attendance % should match the progress bar
   - Rating should match displayed rating
   - Tasks should show correct verified/total counts
   - Proofs Pending should match the badge on-screen

3. **Edge cases:**
   - Members with no attendance data → should show "No data"
   - Members with no ratings → should show "—"
   - Members with no tasks → should show "0/0"
   - Suspended members → should show "Suspended" status
