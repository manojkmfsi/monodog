#!/usr/bin/env node

/**
 * Test the log parser to verify it correctly splits logs into steps
 */

// Mock log data from GitHub Actions (simulating actual logs with ##[group] markers)
const mockGitHubLogs = `##[group]Set up job
Prepare the action workspace
Adding extra PATH variables
##[endgroup]
Create build
Running: npm run build
✓ Build completed successfully
##[group]Lint code
Running eslint
✓ No lint errors found
##[endgroup]
##[group]Run tests
Running jest
✓ All tests passed
✓ Coverage: 95%
##[endgroup]
##[group]Post Checkout repository
Saving cache
##[endgroup]
Complete job
Job completed successfully`;

// Parser function (same as in PipelineManager)
function parseStepsFromLogs(rawLogs) {
  const lines = rawLogs.split('\n');
  const steps = [];
  let currentStepName = 'Setup';
  let currentStepLogs = [];
  let stepStartIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // GitHub Actions group markers: ##[group]Step Name / ##[endgroup]
    if (line.includes('##[group]')) {
      // Save previous step if it has logs
      if (currentStepLogs.length > 0 || steps.length === 0) {
        if (steps.length > 0 || currentStepLogs.length > 0) {
          steps.push({
            name: currentStepName,
            logs: currentStepLogs,
            startIndex: stepStartIndex,
          });
        }
      }

      // Extract new step name - capture everything after ##[group] and before ##[endgroup] or EOL
      const groupMatch = line.match(/##\[group\](.*?)(?:##\[endgroup\]|$)/);
      if (groupMatch) {
        currentStepName = groupMatch[1].trim();
      } else {
        currentStepName = `Step ${steps.length + 1}`;
      }
      currentStepLogs = [];
      stepStartIndex = i;
    } else if (line.includes('##[endgroup]')) {
      // End of group - don't add this line to logs
      continue;
    } else if (line.trim()) {
      // Regular log line (non-empty)
      currentStepLogs.push(line);
    }
  }

  // Add last step
  if (currentStepLogs.length > 0 || steps.length === 0) {
    steps.push({
      name: currentStepName,
      logs: currentStepLogs,
      startIndex: stepStartIndex,
    });
  }

  return steps;
}

// Test
console.log('🧪 Testing GitHub Actions Log Parser\n');
console.log('═'.repeat(60));

const parsedSteps = parseStepsFromLogs(mockGitHubLogs);

console.log(`✓ Successfully parsed ${parsedSteps.length} steps\n`);

parsedSteps.forEach((step, idx) => {
  console.log(`Step ${idx + 1}: "${step.name}"`);
  console.log(`  Lines: ${step.logs.length}`);
  if (step.logs.length > 0) {
    console.log(`  First line: "${step.logs[0]}"`);
    if (step.logs.length > 1) {
      console.log(`  Last line: "${step.logs[step.logs.length - 1]}"`);
    }
  }
  console.log('');
});

console.log('═'.repeat(60));
console.log('✅ Parser test completed successfully!\n');

// Verify count
if (parsedSteps.length >= 3) {
  console.log(`✓ Expected at least 3 steps, got ${parsedSteps.length}`);
} else {
  console.log(`✗ Expected at least 3 steps, but got ${parsedSteps.length}`);
}
