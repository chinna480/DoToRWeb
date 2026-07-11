#!/bin/bash
# ── DoToR Project Setup ────────────────────────────
# Run this script after cloning to configure git hooks.
# ──────────────────────────────────────────────────

echo "🔧 Setting up DoToR pre-push hook..."
git config core.hooksPath .githooks
echo "✅ Git hooks path configured to .githooks/"
echo ""
echo "The pre-push hook will run these checks before every push:"
echo "  1. npx tsc --noEmit     (TypeScript type checking)"
echo "  2. npx expo export --platform=android (JS bundle verification)"
echo ""
echo "To skip hooks for a single push:  git push --no-verify"
echo "To disable permanently:            export SKIP_PRE_PUSH=1"
