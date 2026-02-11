#!/usr/bin/env bash
# Automated npm publishing script - enforces documented workflow
set -e

# Ensure Node.js and npm are available
source ./node-check.sh || exit 1

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================="
echo "npm Publishing Workflow"
echo "========================================="
echo ""

# Extract version from package.json
VERSION=$(node -p "require('./package.json').version")
PACKAGE_NAME=$(node -p "require('./package.json').name")

echo -e "Package: ${YELLOW}${PACKAGE_NAME}${NC}"
echo -e "Version: ${YELLOW}v${VERSION}${NC}"
echo ""

# ========================================
# Pre-Flight Checks
# ========================================

echo -e "${YELLOW}[1/9] Checking git working directory...${NC}"
if [[ -n $(git status --porcelain) ]]; then
  echo -e "${RED}✗ Git working directory is not clean${NC}"
  echo -e "${RED}  Commit or stash your changes before publishing${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Git working directory is clean${NC}"
echo ""

echo -e "${YELLOW}[2/9] Checking npm authentication...${NC}"
if ! npm whoami &>/dev/null; then
  echo -e "${RED}✗ Not authenticated to npm${NC}"
  echo -e "${RED}  Run 'npm login' first${NC}"
  exit 1
fi
NPM_USER=$(npm whoami)
echo -e "${GREEN}✓ Authenticated as ${NPM_USER}${NC}"
echo ""

echo -e "${YELLOW}[3/9] Verifying package.json...${NC}"
if [[ ! -f "package.json" ]]; then
  echo -e "${RED}✗ package.json not found${NC}"
  exit 1
fi
echo -e "${GREEN}✓ package.json exists${NC}"
echo ""

# ========================================
# Pre-Publication Checks
# ========================================

echo -e "${YELLOW}[4/9] Running code quality checks...${NC}"
if ! ./code-quality.sh; then
  echo -e "${RED}✗ Code quality checks failed${NC}"
  echo -e "${RED}  Fix errors before publishing${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Code quality checks passed${NC}"
echo ""

echo -e "${YELLOW}[5/9] Verifying package contents...${NC}"
echo ""
npm pack --dry-run
echo ""
if [[ ! -d "dist" ]]; then
  echo -e "${RED}✗ dist/ directory not found${NC}"
  echo -e "${RED}  Build should run automatically via prepublishOnly${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Package contents verified${NC}"
echo ""

# ========================================
# Publishing Workflow
# ========================================

echo -e "${YELLOW}[6/9] Running npm publish dry-run...${NC}"
echo ""
npm publish --dry-run
echo ""
echo -e "${GREEN}✓ Dry-run completed${NC}"
echo ""

echo -e "${YELLOW}[7/9] Confirm publication${NC}"
echo ""
echo -e "${YELLOW}About to publish:${NC}"
echo -e "  Package: ${PACKAGE_NAME}"
echo -e "  Version: v${VERSION}"
echo -e "  User:    ${NPM_USER}"
echo ""
read -p "Proceed with npm publish? (y/N): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${YELLOW}Publication cancelled${NC}"
  exit 0
fi
echo ""

echo -e "${YELLOW}Publishing to npm...${NC}"
npm publish
echo -e "${GREEN}✓ Published successfully${NC}"
echo ""

echo -e "${YELLOW}[8/9] Verifying publication...${NC}"
PUBLISHED_VERSION=$(npm view ${PACKAGE_NAME} version)
if [[ "${PUBLISHED_VERSION}" == "${VERSION}" ]]; then
  echo -e "${GREEN}✓ Version ${VERSION} is live on npm${NC}"
else
  echo -e "${RED}✗ Version mismatch: expected ${VERSION}, got ${PUBLISHED_VERSION}${NC}"
  exit 1
fi
echo ""

# ========================================
# Post-Publication
# ========================================

echo -e "${YELLOW}[9/9] Creating git tag...${NC}"
git tag -a "v${VERSION}" -m "Release v${VERSION}"
git push origin "v${VERSION}"
echo -e "${GREEN}✓ Tag v${VERSION} created and pushed${NC}"
echo ""

# ========================================
# Success Summary
# ========================================

echo "========================================="
echo -e "${GREEN}Publication Complete! ✓${NC}"
echo "========================================="
echo ""
echo -e "Package:  ${GREEN}https://www.npmjs.com/package/${PACKAGE_NAME}${NC}"
echo -e "Version:  ${GREEN}v${VERSION}${NC}"
echo -e "Tag:      ${GREEN}v${VERSION}${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Create GitHub release from tag v${VERSION}"
echo "     → https://github.com/robert7/remnote-mcp-server/releases/new"
echo "  2. Copy CHANGELOG.md section for release notes"
echo "  3. Add new [Unreleased] section to CHANGELOG.md"
echo ""
