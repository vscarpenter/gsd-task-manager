#!/bin/bash

# GSD Task Manager - Test Coverage Script
# Runs Vitest with coverage and outputs a summary report

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  GSD Task Manager - Test Coverage Report"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Run tests with coverage
echo "Running tests with coverage..."
pnpm test -- --coverage

# Check if coverage directory exists
if [ ! -d "coverage" ]; then
  echo ""
  echo "⚠️  Coverage directory not found. Tests may have failed."
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
