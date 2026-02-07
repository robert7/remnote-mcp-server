#!/usr/bin/env bash
# Code quality checker - runs all quality checks
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counter for failures
FAILURES=0

echo "========================================="
echo "Running Code Quality Checks"
echo "========================================="
echo ""

# 1. TypeScript Type Checking
echo -e "${YELLOW}[1/5] Running TypeScript type check...${NC}"
if npm run typecheck; then
  echo -e "${GREEN}✓ Type check passed${NC}"
else
  echo -e "${RED}✗ Type check failed${NC}"
  FAILURES=$((FAILURES + 1))
fi
echo ""

# 2. ESLint
echo -e "${YELLOW}[2/5] Running ESLint...${NC}"
if npm run lint; then
  echo -e "${GREEN}✓ Lint check passed${NC}"
else
  echo -e "${RED}✗ Lint check failed${NC}"
  FAILURES=$((FAILURES + 1))
fi
echo ""

# 3. Prettier Format Check
echo -e "${YELLOW}[3/5] Running Prettier format check...${NC}"
if npm run format:check; then
  echo -e "${GREEN}✓ Format check passed${NC}"
else
  echo -e "${RED}✗ Format check failed${NC}"
  echo -e "${YELLOW}  Run 'npm run format' to fix formatting${NC}"
  FAILURES=$((FAILURES + 1))
fi
echo ""

# 4. Tests
echo -e "${YELLOW}[4/5] Running tests...${NC}"
if npm test; then
  echo -e "${GREEN}✓ Tests passed${NC}"
else
  echo -e "${RED}✗ Tests failed${NC}"
  FAILURES=$((FAILURES + 1))
fi
echo ""

# 5. Coverage Check
echo -e "${YELLOW}[5/5] Running coverage check...${NC}"
if npm run test:coverage; then
  echo -e "${GREEN}✓ Coverage check passed${NC}"
else
  echo -e "${RED}✗ Coverage check failed${NC}"
  FAILURES=$((FAILURES + 1))
fi
echo ""

# Summary
echo "========================================="
if [ $FAILURES -eq 0 ]; then
  echo -e "${GREEN}All checks passed! ✓${NC}"
  exit 0
else
  echo -e "${RED}$FAILURES check(s) failed ✗${NC}"
  exit 1
fi
