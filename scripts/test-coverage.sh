#!/bin/bash

# GSD Task Manager - Test Coverage Script
# Runs Vitest with coverage and outputs a summary report

# Don't exit immediately on error - we want to generate coverage even if tests fail
set +e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  GSD Task Manager - Test Coverage Report"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Run tests with coverage
echo "Running tests with coverage..."
bun run test -- --coverage --no-coverage.thresholds 2>&1
TEST_EXIT_CODE=$?

echo ""
if [ $TEST_EXIT_CODE -ne 0 ]; then
  echo "⚠️  Some tests failed (exit code: $TEST_EXIT_CODE)"
  echo ""
fi

# Check if coverage directory exists
if [ ! -d "coverage" ]; then
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  ⚠️  Coverage Not Generated"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "Coverage was not generated. This usually happens when:"
  echo ""
  echo "  1. Tests have severe errors (unhandled rejections, worker crashes)"
  echo "  2. Test environment cleanup issues preventing graceful shutdown"
  echo "  3. Vitest process exits abnormally before writing coverage"
  echo ""
  echo "To fix this:"
  echo ""
  echo "  1. Run 'bun run test' to see detailed test failures"
  echo "  2. Fix tests that have unhandled promises or cleanup issues"
  echo "  3. Look for errors about 'test environment torn down'"
  echo "  4. Ensure all tests properly clean up timers/promises"
  echo ""
  echo "Once tests pass (or only have assertion failures), coverage will generate."
  echo ""
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Coverage Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Display summary from coverage-summary.json if available
if [ -f "coverage/coverage-summary.json" ]; then
  # Extract overall coverage percentages using node
  node -e "
    const fs = require('fs');
    const summary = JSON.parse(fs.readFileSync('coverage/coverage-summary.json', 'utf8'));
    const total = summary.total;

    console.log('Overall Coverage:');
    console.log('  Statements   : ' + total.statements.pct + '%');
    console.log('  Branches     : ' + total.branches.pct + '%');
    console.log('  Functions    : ' + total.functions.pct + '%');
    console.log('  Lines        : ' + total.lines.pct + '%');
    console.log('');

    // Check if coverage meets threshold (80%)
    const threshold = 80;
    const passing = total.lines.pct >= threshold;

    if (passing) {
      console.log('✅ Coverage meets target threshold (' + threshold + '%)');
    } else {
      console.log('⚠️  Coverage below target threshold (' + threshold + '%)');
      console.log('   Current: ' + total.lines.pct + '% | Target: ' + threshold + '%');
    }
  "
else
  echo "⚠️  coverage-summary.json not found"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Detailed coverage report available at:"
echo "   coverage/index.html"
echo ""
echo "To view in browser, run:"
echo "   open coverage/index.html"
echo ""

# Exit with test exit code
exit $TEST_EXIT_CODE
