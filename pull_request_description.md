# Pull Request: Eliminate UI Latency and Optimize Notification & Dashboard Performance

## Description

This Pull Request optimizes key user-facing workflows in the **Notification** and **Dashboard** modules to eliminate artificial/unnecessary loading delays, full-page blocking overlays, and slow interactive states.

---

## 1. Notification Module: Optimistic UI Updates

### The Issue:

Previously, performing actions on notifications (Marking as Read, Deleting a single notification, Marking All Read, deleting All) initiated a standard React Query mutation that waited for the backend database transaction to complete before invalidating cache queries. This caused:

- Visible loading buttons with "Marking..."/spinners that remained on the screen for up to 300-600ms.
- A perceived "laggy" experience for basic UI changes.
- Flashing button loading states.

### The Fix:

We refactored all 4 notification mutation configurations in `Notifications.jsx` (`markReadMut`, `markAllReadMut`, `deleteMut`, `deleteAllMut`) to use React Query's `onMutate` optimistic caching updates:

- **Immediate State Transition:** The local query cache value for the corresponding page is instantly modified as soon as the user triggers the action.
  - Marked notifications are immediately set to `read: true` in the cache, removing the "Mark read" button instantly from the DOM.
  - Deleted notifications are instantly filtered out from the cache list.
- **Error Rollback:** If the network request fails, React Query intercepts the failure and rolls the cache back to the snapshotted pre-mutation state.
- **Squeaky Clean Tests:** Updated `frontend/src/__tests__/Notifications.test.jsx`. The previous tests were asserting the old slow behavior (waiting for the button to show "Marking..." and be temporarily disabled). We updated them to assert the new instant behavior (ensuring notifications immediately transition to the updated state in the DOM without waiting for the promise to resolve).

---

## 2. Dashboard Module: Eliminate Blocking Cascades

### The Issue:

The main User Dashboard (`Home.jsx`) suffered from a data-fetching waterfall:

1. First, it loaded the profile `/users/me` while holding the page hostage with a full-screen `Loading profile...` message.
2. After the profile API returned, it mounted either `<ManagerHome>` or `<InternHome>`, which immediately issued sub-queries (team members, attendance statistics, ratings).
3. The page was then locked again with a full-screen `Loading dashboard...` overlay.
4. Only after all sub-queries finished did the user see the dashboard.

### The Fix:

- **Instant Shell Rendering:** Removed the blocking check on `/users/me` and the dashboard loadings. The dashboard's layout, greeting, and Quick Actions section are now rendered **instantly** using the cached authenticated user object from the Zustand store.
- **Zero Delay Caching:** Configured React Query with a `staleTime: 5 * 60 * 1000` (5 minutes) for the profile, team members, and intern home stats. Returning passengers will see their dashboard render immediately using the previously stored cached state.
- **Non-Blocking Progressive Indicators:** If a query is run for the representation of the very first load (no cache in memory), cards show a clean, non-disruptive `...` skeleton loading state instead of taking over the entire viewport with a blocking screen, and specific lists show progressive loading indicators.

---

## Verification & Testing

All client-side unit tests have been successfully verified and pass:

- `authStore.test.jsx` (4 tests) - **PASS**
- `DashboardLayout.test.jsx` (3 tests) - **PASS**
- `Notifications.test.jsx` (2 tests) - **PASS** (Optimistic updates verified)
- `ui.test.jsx` (11 tests) - **PASS**
- `Login.test.jsx` (4 tests) - **PASS**

Total: **24 Tests Passed**
