# Load Testing

## Overview

This directory contains the backend load-testing suite for InternOps. It is designed to evaluate API performance under different traffic patterns using a combination of k6 and Artillery.

The suite includes:

- Baseline testing for steady-state behavior
- Mixed-workload scenarios that exercise multiple modules
- Stress and spike tests for peak traffic conditions
- Endurance tests for long-running stability checks

## Directory Structure

```text
backend/tests/load/
├── artillery/          # Artillery test definitions
├── k6/                 # k6 test scripts and helpers
├── generators/         # Data generation utilities
├── config.js           # Shared k6 configuration
├── runner.sh           # Linux/macOS test runner
├── runner.bat          # Windows test runner
├── reports/            # Generated summaries and reports
```

## Prerequisites

Before running the load tests, ensure the following are available:

- Node.js 18+ and npm
- k6 installed and available on your PATH
- Artillery installed globally:
  - `npm install -g artillery`
- A running backend instance at the target URL, typically `BASE_URL=http://127.0.0.1:5000/api/v1`
- Required services for the application, such as the database and any dependent APIs, are running

## Installation

From the repository root, install the backend dependencies if they are not already present:

```bash
cd backend
npm install
```

Install the load-test tooling:

```bash
npm install -g artillery
```

If you are using the provided runners, no additional setup is required beyond having k6 and Artillery available in your shell.

## Running Load Tests

### Baseline Test

Use the baseline test to confirm the application behaves normally at a light load.

```bash
cd backend/tests/load
./runner.sh
```

On Windows:

```bat
cd backend\tests\load
runner.bat
```

Select option 1 from the interactive menu to run the baseline suite.

### Mixed Workload

The mixed workload test simulates a realistic blended traffic pattern across authentication, attendance, progress, reports, notifications, and admin flows.

Run it directly with k6:

```bash
cd backend/tests/load/k6
k6 run mixed-workload.js
```

### Stress Test

Use the stress test to push the system beyond normal operating load and measure degradation behavior.

```bash
cd backend/tests/load/k6
k6 run stress-test.js
```

### Spike Test

The spike test evaluates behavior during short, abrupt surges in traffic.

```bash
cd backend/tests/load/k6
k6 run spike-test.js
```

### Endurance Test

The endurance test is intended for long-running stability checks and may take several hours to complete.

```bash
cd backend/tests/load/k6
k6 run endurance-test.js
```

## Configuration

The load-test configuration is defined in the following files:

- `backend/tests/load/config.js` for k6 configuration and thresholds
- `load-test.yml` at the repository root for the Artillery-based scenario definition
- `backend/tests/load/artillery/*.yml` for scenario-specific Artillery workloads

Common settings include:

- Target URL: `http://127.0.0.1:5000/api/v1`
- Authenticated user journeys for intern and admin flows
- Thresholds for request duration and failure rate

## Performance Thresholds

The default thresholds used by the k6 suite are:

- Baseline: p95 under 300 ms and p99 under 500 ms
- Normal load: p95 under 500 ms and p99 under 1000 ms
- Peak load: p95 under 1000 ms and p99 under 2000 ms
- Stress testing: p95 under 2000 ms and p99 under 4000 ms
- Failure rate should remain below the configured tolerance for each scenario

Adjust these values if your environment has different performance expectations.

## Test Reports

Reports are generated in the `backend/tests/load/reports` directory.

The runner scripts will produce:

- JSON summaries from k6
- Artillery output files
- HTML reports when the report generator is available

You can also inspect raw JSON results directly for trend analysis or integration with monitoring tools.

## Troubleshooting

If a load test does not run as expected, check the following:

- Ensure the backend is running and reachable at the configured target URL
- Confirm k6 and Artillery are installed and available on your PATH
- Verify the database, Redis, and other runtime services are healthy
- Check authentication credentials and endpoint availability if requests begin failing
- Review the generated reports in the `reports` folder for detailed failure information
- If running on Windows, use the batch runner rather than the shell script

For repeated failures, start with a smaller test configuration and gradually increase load to isolate the bottleneck.
