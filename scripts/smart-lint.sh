#!/bin/sh

# Smart Lint Staging
# Only lints staged files for faster commits

echo "🔍 Smart Lint - Checking only staged files..."

# Get list of staged TypeScript/JavaScript files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx|js|jsx)$')

if [ -z "$STAGED_FILES" ]; then
  echo "ℹ️  No TypeScript/JavaScript files staged"
  exit 0
fi

echo "📄 Staged files to lint:"
echo "$STAGED_FILES"
echo ""

# Run ESLint only on staged files
echo "🔍 Running ESLint on staged files..."
npx eslint $STAGED_FILES --fix

if [ $? -ne 0 ]; then
  echo ""
  echo "❌ ESLint found errors in staged files"
  echo "💡 Fix the errors and try again"
  echo ""
  echo "Files with issues:"
  git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx|js|jsx)$'
  echo ""
  echo "To fix automatically:"
  echo "  npm run lint:fix"
  echo ""
  echo "To bypass this check (not recommended):"
  echo "  git commit --no-verify"
  exit 1
fi

# Run Prettier only on staged files
echo ""
echo "✨ Running Prettier on staged files..."
npx prettier --write $STAGED_FILES --ignore-unknown

if [ $? -ne 0 ]; then
  echo ""
  echo "❌ Prettier found errors in staged files"
  echo "💡 Fix the formatting and try again"
  echo ""
  exit 1
fi

# Check if linting/formatting made changes
CHANGED_FILES=$(git diff --name-only $STAGED_FILES)

if [ -n "$CHANGED_FILES" ]; then
  echo ""
  echo "✨ Auto-fixed issues in:"
  echo "$CHANGED_FILES"
  echo ""
  echo "💡 Staging fixed files..."
  git add $CHANGED_FILES
  echo "✅ Fixed files staged"
fi

echo ""
echo "✅ Smart Lint passed!"
echo "✨ All staged files are clean"
exit 0
