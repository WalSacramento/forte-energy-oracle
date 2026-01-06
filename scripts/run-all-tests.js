/**
 * Run All Tests Script
 * Executes all test suites and generates report
 */

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const TEST_SUITES = [
    { name: "Unit Tests", command: "npm run test:unit" },
    { name: "Scenario Tests", command: "npm run test:scenarios" }
];

async function main() {
    console.log("═══════════════════════════════════════════");
    console.log("       EAON Complete Test Suite            ");
    console.log("═══════════════════════════════════════════\n");

    const results = [];
    const startTime = Date.now();

    for (const suite of TEST_SUITES) {
        console.log(`\n───────────────────────────────────────────`);
        console.log(`Running: ${suite.name}`);
        console.log(`───────────────────────────────────────────\n`);

        const suiteStart = Date.now();
        
        try {
            await runCommand(suite.command);
            results.push({
                name: suite.name,
                status: "PASS",
                duration: Date.now() - suiteStart
            });
            console.log(`\n✅ ${suite.name}: PASSED`);
        } catch (error) {
            results.push({
                name: suite.name,
                status: "FAIL",
                duration: Date.now() - suiteStart,
                error: error.message
            });
            console.log(`\n❌ ${suite.name}: FAILED`);
        }
    }

    const totalDuration = Date.now() - startTime;

    // Print summary
    console.log("\n═══════════════════════════════════════════");
    console.log("              TEST SUMMARY                 ");
    console.log("═══════════════════════════════════════════");
    
    for (const result of results) {
        const status = result.status === "PASS" ? "✅" : "❌";
        console.log(`${status} ${result.name}: ${result.status} (${result.duration}ms)`);
    }

    console.log(`\nTotal Duration: ${(totalDuration / 1000).toFixed(2)}s`);

    const passed = results.filter(r => r.status === "PASS").length;
    const failed = results.filter(r => r.status === "FAIL").length;

    console.log(`Passed: ${passed}/${results.length}`);
    console.log(`Failed: ${failed}/${results.length}`);

    if (failed > 0) {
        console.log("\n⚠️  Some tests failed!");
        process.exit(1);
    } else {
        console.log("\n🎉 All tests passed!");
    }

    // Save results
    const resultsPath = path.join(__dirname, "..", "performance", "results", `test-run-${Date.now()}.json`);
    fs.writeFileSync(resultsPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        duration: totalDuration,
        results
    }, null, 2));
    console.log(`\nResults saved to: ${resultsPath}`);
}

function runCommand(command) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, {
            stdio: "inherit",
            shell: true,
            cwd: path.join(__dirname, "..")
        });

        child.on("close", (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Command exited with code ${code}`));
            }
        });

        child.on("error", reject);
    });
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});


