#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# InternOps Load Test Runner
# Runs all load test scenarios using k6 and Artillery
# ============================================================

TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPORTS_DIR="${TEST_DIR}/reports"

echo "===================================================="
echo "  InternOps Load Test Suite"
echo "  $(date)"
echo "===================================================="
echo ""

check_cmd() {
    if ! command -v "$1" &>/dev/null; then
        echo "[!] $1 not found. Install $2"
        return 1
    fi
    echo "[+] $1 found"
    return 0
}

K6_AVAILABLE=false
ARTILLERY_AVAILABLE=false
NODE_AVAILABLE=false

check_cmd k6 "from https://k6.io/docs/get-started/installation/" && K6_AVAILABLE=true
check_cmd artillery "with: npm install -g artillery" && ARTILLERY_AVAILABLE=true
check_cmd node "from https://nodejs.org/" && NODE_AVAILABLE=true

echo ""
echo "===================================================="
echo "  Test Suites"
echo "===================================================="
echo "  1) Baseline     - 10 users, 10 min"
echo "  2) Normal       - 100 users, 30 min"
echo "  3) Peak         - 2000 users, 30 min"
echo "  4) Stress       - gradual to 5000+"
echo "  5) Spike        - 50 to 500 burst"
echo "  6) Endurance    - 100 users, 2-4 hrs"
echo "  7) Full Suite   - all of the above"
echo "  8) Smoke        - 5 users, 30s"
echo ""
read -rp "Select test suite (1-8): " CHOICE

run_k6() {
    local name="$1"
    local script="$2"
    shift 2
    if [ "$K6_AVAILABLE" = true ]; then
        echo "[*] Running k6 ${name}..."
        mkdir -p "$REPORTS_DIR"
        cd "$TEST_DIR/k6"
        k6 run --summary-export "${REPORTS_DIR}/${name}-summary.json" "$script" "$@"
        echo "[+] k6 ${name} complete"
    fi
}

run_artillery() {
    local name="$1"
    local config="$2"
    if [ "$ARTILLERY_AVAILABLE" = true ]; then
        echo "[*] Running Artillery ${name}..."
        mkdir -p "$REPORTS_DIR"
        cd "$TEST_DIR/artillery"
        artillery run --output "${REPORTS_DIR}/${name}-artillery.json" "$config"
        echo "[+] Artillery ${name} complete"
    fi
}

generate_report() {
    if [ "$NODE_AVAILABLE" = true ]; then
        echo "[*] Generating HTML report..."
        cd "$TEST_DIR/reports"
        node generate-report.js
        echo "[+] Report generated"
    fi
}

case "$CHOICE" in
    1)
        echo "[*] Running Baseline Test"
        run_k6 "baseline" "stress-test.js" --stage "2m:10" --stage "5m:10" --stage "2m:0"
        run_artillery "baseline" "baseline.yml"
        ;;
    2)
        echo "[*] Running Normal Load Test"
        run_k6 "normal" "mixed-workload.js"
        run_artillery "normal" "normal-load.yml"
        ;;
    3)
        echo "[*] Running Peak Load Test"
        run_k6 "peak" "stress-test.js"
        run_artillery "peak" "peak-load.yml"
        ;;
    4)
        echo "[*] Running Stress Test"
        run_k6 "stress" "stress-test.js"
        run_artillery "stress" "peak-load.yml"
        ;;
    5)
        echo "[*] Running Spike Test"
        run_k6 "spike" "spike-test.js"
        run_artillery "spike" "peak-load.yml"
        ;;
    6)
        echo "[*] Running Endurance Test (2+ hours)"
        run_k6 "endurance" "endurance-test.js"
        ;;
    7)
        echo "[*] Running Full Test Suite"
        run_k6 "baseline" "stress-test.js" --stage "2m:10" --stage "5m:10" --stage "2m:0"
        run_artillery "baseline" "baseline.yml"
        run_k6 "normal" "mixed-workload.js"
        run_artillery "normal" "normal-load.yml"
        run_k6 "peak" "stress-test.js"
        run_artillery "peak" "peak-load.yml"
        run_k6 "stress" "stress-test.js"
        run_artillery "stress" "peak-load.yml"
        run_k6 "spike" "spike-test.js"
        run_artillery "spike" "peak-load.yml"
        echo "[+] Full test suite complete!"
        ;;
    8)
        echo "[*] Running Quick Smoke Test"
        run_k6 "smoke" "spike-test.js" --vus 5 --duration 30s
        ;;
    *)
        echo "Invalid choice. Exiting."
        exit 1
        ;;
esac

generate_report

echo ""
echo "===================================================="
echo "  Load testing complete!"
echo "  Reports: ${REPORTS_DIR}/"
echo "===================================================="
