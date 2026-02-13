# Publishing to npm

Maintainer guide for publishing new versions of `remnote-mcp-server` to npm.

## Automated Publishing (Recommended)

The `npm-publish.sh` script automates the complete publishing workflow with proper error checking:

```bash
./npm-publish.sh
```

**What it does:**

1. Pre-flight checks (git clean, npm auth, package.json exists)
2. Runs full code quality suite (`./code-quality.sh`)
3. Verifies package contents (`npm pack --dry-run`)
4. Runs publish dry-run for review
5. Prompts for confirmation before actual publish
6. Publishes to npm
7. Verifies publication succeeded
8. Creates and pushes git tag (`vX.Y.Z`)
9. Displays next steps (GitHub release, CHANGELOG update)

**Note:** The script assumes version has already been bumped in `package.json` and `CHANGELOG.md` has been updated. See
"Pre-Publication Checklist" below.

## Manual Publishing

The following manual workflow is documented for reference and advanced use cases. For standard releases, use
`./npm-publish.sh` instead.

## Prerequisites

- npm account with publish permissions for `remnote-mcp-server`
- Authenticated via `npm login`
- Clean working directory (all changes committed)

## Pre-Publication Checklist

1. **Update version in package.json**

   ```bash
   npm version [major|minor|patch]
   ```

   - `major` - Breaking changes (e.g., 1.0.0 → 2.0.0)
   - `minor` - New features, backwards compatible (e.g., 0.1.0 → 0.2.0)
   - `patch` - Bug fixes, backwards compatible (e.g., 0.1.0 → 0.1.1)
2. **Document changes in CHANGELOG.md**
   - Move items from `[Unreleased]` to new version section
   - Add release date: `## [0.1.0] - 2026-02-07`
   - Ensure changes are categorized (Added, Changed, Fixed, etc.)
3. **Verify package contents**

   ```bash
   npm pack --dry-run
   ```

   - Check included files list
   - Verify `dist/` is built (runs automatically via `prepublishOnly`)
   - Ensure no sensitive files are included
4. **Run type checks**
   ```bash
   npm run typecheck
   ```

5. **Manual verification**
   - Start server: `npm start`
   - Verify WebSocket port listening: `lsof -i :3002`
   - Test MCP tools in Claude Code (e.g., `remnote_status`)

## Publishing Workflow

1. **Dry run**

   ```bash
   npm publish --dry-run
   ```

   - Review output for any warnings
   - Verify package size is reasonable
2. **Publish**

   ```bash
   npm publish
   ```

   - For pre-release versions: `npm publish --tag beta`
3. **Verify publication**
   ```bash
   npm view remnote-mcp-server
   ```

   - Check version, description, repository links
   - Visit: https://www.npmjs.com/package/remnote-mcp-server

## Post-Publication

1. **Create git tag**

   ```bash
   git tag -a v0.1.0 -m "Release v0.1.0"
   git push origin v0.1.0
   ```

2. **Create GitHub release**
   - Navigate to repository releases page
   - Create release from tag
   - Copy CHANGELOG.md section for release notes
3. **Update CHANGELOG.md**
   - Add new `[Unreleased]` section at top
   - Commit and push

## Common Issues

**Port 3002 already in use during testing:**

```bash
lsof -i :3002
kill -9 <PID>
```

**Build fails during prepublishOnly:**

- Check TypeScript errors: `npm run typecheck`
- Ensure all dependencies installed: `npm install`

**Package version already exists:**

- Increment version: `npm version patch`
- Republish

## Version Guidelines

Follow [Semantic Versioning](https://semver.org/):

- **0.x.y** - Initial development (API may change)
- **1.0.0** - First stable release (public API contract)
- **Major (x.0.0)** - Breaking changes to public API
- **Minor (0.x.0)** - New features, backwards compatible
- **Patch (0.0.x)** - Bug fixes, backwards compatible
