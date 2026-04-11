#!/bin/bash
# =============================================================================
# EAON — Unified Test Runner
# Executes all test suites (Hardhat, K6, Cypress) and collects reports
# Results are saved to results/local/{timestamp}/ for each execution
# Usage: npm run test:full
# =============================================================================

set -o pipefail

TIMESTAMP=$(date +%Y%m%dT%H%M%S)
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RUN_DIR="$PROJECT_DIR/results/local/$TIMESTAMP"
LATEST_LINK="$PROJECT_DIR/results/local/latest"

# Staging dirs (where tools write by default, moved to RUN_DIR after each phase)
HARDHAT_STAGING="$PROJECT_DIR/results/local/hardhat"
K6_STAGING="$PROJECT_DIR/results/local/k6"
CYPRESS_STAGING="$PROJECT_DIR/results/local/cypress"

# Track phase results
HARDHAT_STATUS="skipped"
K6_STATUS="skipped"
CYPRESS_STATUS="skipped"
HARDHAT_DURATION=0
K6_DURATION=0
CYPRESS_DURATION=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

banner() {
  echo ""
  echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
  echo -e "${CYAN}  $1${NC}"
  echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
  echo ""
}

phase_result() {
  local name=$1 status=$2 duration=$3
  if [ "$status" = "passed" ]; then
    echo -e "  ${GREEN}✔${NC} $name — ${GREEN}PASSED${NC} (${duration}s)"
  elif [ "$status" = "failed" ]; then
    echo -e "  ${RED}✘${NC} $name — ${RED}FAILED${NC} (${duration}s)"
  else
    echo -e "  ${YELLOW}–${NC} $name — ${YELLOW}SKIPPED${NC}"
  fi
}

# Move staging dir contents to timestamped run dir, then clean staging
collect_results() {
  local phase_name=$1 staging_dir=$2
  local dest="$RUN_DIR/$phase_name"
  mkdir -p "$dest"
  if [ -d "$staging_dir" ] && [ "$(ls -A "$staging_dir" 2>/dev/null)" ]; then
    cp -r "$staging_dir"/. "$dest"/
    rm -rf "$staging_dir"
  fi
}

cleanup_docker() {
  echo "Cleaning up Docker containers..."
  docker-compose down --remove-orphans 2>/dev/null || true
  docker-compose -f docker-compose.k6.yml down -v --remove-orphans 2>/dev/null || true
  fuser -k 3001/tcp 2>/dev/null || true
}

print_failed_logs() {
  local phase_name=$1 log_file=$2
  if [ -f "$log_file" ]; then
    echo ""
    echo -e "${RED}═══ $phase_name — Last 40 lines ═══${NC}"
    tail -40 "$log_file"
    echo -e "${RED}═══════════════════════════════════${NC}"
  fi
}

# ─────────────────────────────────────────────────────────────
# Setup
# ─────────────────────────────────────────────────────────────
banner "EAON Full Test Suite — $TIMESTAMP"

mkdir -p "$RUN_DIR/logs"

# Clean staging dirs from previous runs
rm -rf "$HARDHAT_STAGING" "$K6_STAGING" "$CYPRESS_STAGING"
mkdir -p "$HARDHAT_STAGING" "$K6_STAGING" "$CYPRESS_STAGING"

# Ensure clean Docker state
cleanup_docker
sleep 2

# ─────────────────────────────────────────────────────────────
# Phase 1: Hardhat Tests (unit + integration + scenarios)
# ─────────────────────────────────────────────────────────────
banner "Phase 1/3: Hardhat Tests"

PHASE_START=$(date +%s)
HARDHAT_LOG="$RUN_DIR/logs/hardhat.log"

echo "Running Hardhat test suite (unit + integration + scenarios)..."
if npx hardhat test 2>&1 | tee "$HARDHAT_LOG"; then
  HARDHAT_STATUS="passed"
else
  HARDHAT_STATUS="failed"
  print_failed_logs "Hardhat Tests" "$HARDHAT_LOG"
fi

echo ""
echo "Generating gas report..."
REPORT_GAS=true npx hardhat test 2>&1 | tee "$RUN_DIR/logs/hardhat-gas.log" || true

PHASE_END=$(date +%s)
HARDHAT_DURATION=$((PHASE_END - PHASE_START))

# Collect reports from staging to timestamped dir
collect_results "hardhat" "$HARDHAT_STAGING"

echo ""
phase_result "Hardhat" "$HARDHAT_STATUS" "$HARDHAT_DURATION"

# ─────────────────────────────────────────────────────────────
# Phase 2: K6 Performance Tests
# ─────────────────────────────────────────────────────────────
banner "Phase 2/3: K6 Performance Tests"

PHASE_START=$(date +%s)
K6_LOG="$RUN_DIR/logs/k6-setup.log"

echo "Starting K6 Docker stack..."
if docker-compose -f docker-compose.k6.yml up -d --remove-orphans 2>&1 | tee "$K6_LOG"; then
  echo "Waiting for services to be ready (up to 120s)..."
  if npx wait-on \
    tcp:localhost:8545 \
    tcp:localhost:3000 \
    tcp:localhost:4001 \
    tcp:localhost:4002 \
    tcp:localhost:4003 \
    tcp:localhost:4000 \
    -t 120000 --delay 5000 2>&1 | tee -a "$K6_LOG"; then

    echo "Deploying contracts for K6..."
    bash scripts/deploy-k6.sh 2>&1 | tee -a "$K6_LOG" || true

    echo ""
    echo "Running K6 test suites..."

    K6_ALL_PASSED=true
    K6_PASSED_TESTS=""
    K6_FAILED_TESTS=""

    for test in eaon-baseline.js eaon-crash-fault.js eaon-byzantine-fault.js \
                eaon-scalability-5vus.js eaon-scalability-10vus.js eaon-scalability-20vus.js \
                eaon-stress.js; do
      TEST_NAME="${test%.js}"
      TEST_LOG="$RUN_DIR/logs/k6-${TEST_NAME}.log"
      echo ""
      echo -e "${YELLOW}→ Running: $test${NC}"
      if bash scripts/run-k6.sh "$test" 2>&1 | tee "$TEST_LOG"; then
        echo -e "${GREEN}  ✔ $test completed${NC}"
        K6_PASSED_TESTS="$K6_PASSED_TESTS $TEST_NAME"
      else
        echo -e "${RED}  ✘ $test failed (exit code: $?)${NC}"
        K6_ALL_PASSED=false
        K6_FAILED_TESTS="$K6_FAILED_TESTS $TEST_NAME"
        print_failed_logs "k6 — $TEST_NAME" "$TEST_LOG"
      fi
    done

    if $K6_ALL_PASSED; then
      K6_STATUS="passed"
    else
      K6_STATUS="failed"
    fi
  else
    echo -e "${RED}Services failed to start${NC}"
    K6_STATUS="failed"
    print_failed_logs "K6 Setup" "$K6_LOG"
  fi
else
  echo -e "${RED}Docker stack failed to start${NC}"
  K6_STATUS="failed"
  print_failed_logs "K6 Docker" "$K6_LOG"
fi

echo ""
echo "Tearing down K6 stack..."
docker-compose -f docker-compose.k6.yml down -v --remove-orphans 2>&1 | tee "$RUN_DIR/logs/k6-teardown.log" || true

PHASE_END=$(date +%s)
K6_DURATION=$((PHASE_END - PHASE_START))

# Collect reports from staging to timestamped dir
collect_results "k6" "$K6_STAGING"

echo ""
phase_result "K6" "$K6_STATUS" "$K6_DURATION"

# ─────────────────────────────────────────────────────────────
# Phase 3: Cypress E2E Tests
# ─────────────────────────────────────────────────────────────
banner "Phase 3/3: Cypress E2E Tests"

PHASE_START=$(date +%s)
CYPRESS_LOG="$RUN_DIR/logs/cypress.log"

# Clean state
cleanup_docker
sleep 2

echo "Starting E2E Docker stack..."
if docker-compose up -d hardhat-node deployer mock-hems oracle-node-1 oracle-node-2 oracle-node-3 2>&1 | tee "$CYPRESS_LOG"; then
  echo "Waiting for services to be ready (up to 120s)..."
  if npx wait-on \
    tcp:localhost:8545 \
    tcp:localhost:3000 \
    tcp:localhost:4001 \
    tcp:localhost:4002 \
    tcp:localhost:4003 \
    -t 120000 --delay 5000 2>&1 | tee -a "$CYPRESS_LOG"; then

    echo "Starting frontend and running Cypress..."
    if npx start-server-and-test frontend:dev:3001 http://localhost:3001 cypress:report 2>&1 | tee -a "$CYPRESS_LOG"; then
      CYPRESS_STATUS="passed"
    else
      CYPRESS_STATUS="failed"
      print_failed_logs "Cypress E2E" "$CYPRESS_LOG"
    fi
  else
    echo -e "${RED}Services failed to start${NC}"
    CYPRESS_STATUS="failed"
    print_failed_logs "Cypress Setup" "$CYPRESS_LOG"
  fi
else
  echo -e "${RED}Docker stack failed to start${NC}"
  CYPRESS_STATUS="failed"
  print_failed_logs "Cypress Docker" "$CYPRESS_LOG"
fi

# Copy screenshots to staging before collection
if [ -d "$PROJECT_DIR/cypress/screenshots" ] && [ "$(ls -A "$PROJECT_DIR/cypress/screenshots" 2>/dev/null)" ]; then
  echo "Copying screenshots to results..."
  mkdir -p "$CYPRESS_STAGING/screenshots"
  cp -r "$PROJECT_DIR/cypress/screenshots"/. "$CYPRESS_STAGING/screenshots"/
fi

echo ""
echo "Tearing down E2E stack..."
docker-compose down --remove-orphans 2>&1 | tee "$RUN_DIR/logs/cypress-teardown.log" || true
fuser -k 3001/tcp 2>/dev/null || true

PHASE_END=$(date +%s)
CYPRESS_DURATION=$((PHASE_END - PHASE_START))

# Collect reports from staging to timestamped dir
collect_results "cypress" "$CYPRESS_STAGING"

echo ""
phase_result "Cypress" "$CYPRESS_STATUS" "$CYPRESS_DURATION"

# ─────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────
TOTAL_DURATION=$((HARDHAT_DURATION + K6_DURATION + CYPRESS_DURATION))

banner "Test Suite Complete"

phase_result "Hardhat (unit/integration/scenarios)" "$HARDHAT_STATUS" "$HARDHAT_DURATION"
phase_result "K6 (performance/load)"               "$K6_STATUS"      "$K6_DURATION"
phase_result "Cypress (E2E/UI)"                     "$CYPRESS_STATUS" "$CYPRESS_DURATION"

echo ""
echo -e "  Total duration: ${TOTAL_DURATION}s"
echo -e "  Results:        $RUN_DIR/"
echo ""

# Generate summary JSON
cat > "$RUN_DIR/summary.json" <<EOF
{
  "timestamp": "$TIMESTAMP",
  "totalDuration": $TOTAL_DURATION,
  "phases": {
    "hardhat": {
      "status": "$HARDHAT_STATUS",
      "duration": $HARDHAT_DURATION,
      "reports": {
        "html": "hardhat/hardhat-report.html",
        "json": "hardhat/hardhat-report.json",
        "gasReport": "hardhat/gas-report.txt"
      },
      "logs": ["logs/hardhat.log", "logs/hardhat-gas.log"]
    },
    "k6": {
      "status": "$K6_STATUS",
      "duration": $K6_DURATION,
      "passed": [$(echo "$K6_PASSED_TESTS" | xargs -n1 2>/dev/null | sed 's/.*/"&"/' | paste -sd, 2>/dev/null || echo "")],
      "failed": [$(echo "$K6_FAILED_TESTS" | xargs -n1 2>/dev/null | sed 's/.*/"&"/' | paste -sd, 2>/dev/null || echo "")],
      "reports": {
        "directory": "k6/"
      },
      "logs": ["logs/k6-setup.log", "logs/k6-teardown.log"$(echo "$K6_PASSED_TESTS $K6_FAILED_TESTS" | xargs -n1 2>/dev/null | sed 's/.*/, "logs\/k6-&.log"/' | tr -d '\n' || echo "")]
    },
    "cypress": {
      "status": "$CYPRESS_STATUS",
      "duration": $CYPRESS_DURATION,
      "reports": {
        "html": "cypress/e2e-report.html",
        "json": "cypress/.jsons/",
        "screenshots": "cypress/screenshots/"
      },
      "logs": ["logs/cypress.log", "logs/cypress-teardown.log"]
    }
  }
}
EOF

# Update 'latest' symlink
ln -sfn "$RUN_DIR" "$LATEST_LINK"

echo -e "  Summary:        $RUN_DIR/summary.json"
echo -e "  Latest link:    $LATEST_LINK -> $TIMESTAMP"
echo ""

# Exit with failure if any phase failed
if [ "$HARDHAT_STATUS" = "failed" ] || [ "$K6_STATUS" = "failed" ] || [ "$CYPRESS_STATUS" = "failed" ]; then
  exit 1
fi
