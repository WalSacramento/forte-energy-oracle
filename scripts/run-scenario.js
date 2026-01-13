/**
 * Run Scenario Script
 * Executes a specific test scenario
 */

const { spawn } = require("child_process");
const path = require("path");

const SCENARIOS = {
    S1: "test/scenarios/S1_Normal.test.js",
    S2: "test/scenarios/S2_CrashFault.test.js",
    S3: "test/scenarios/S3_ByzantineFault.test.js",
    S4: "test/scenarios/S4_SubtleManipulation.test.js",
    S5: "test/scenarios/S5_NetworkLatency.test.js",
    S6: "test/scenarios/S6_StressTest.test.js",
    S7: "test/scenarios/S7_ReputationRecovery.test.js"
};

async function main() {
    const scenario = process.argv[2]?.toUpperCase();

    if (!scenario) {
        console.log("Usage: node run-scenario.js <scenario>");
        console.log("\nAvailable scenarios:");
        for (const [key, file] of Object.entries(SCENARIOS)) {
            console.log(`  ${key}: ${file}`);
        }
        process.exit(1);
    }

    if (scenario === "ALL") {
        console.log("Running all scenarios...\n");
        for (const [key, file] of Object.entries(SCENARIOS)) {
            console.log(`\n═══ Running ${key} ═══`);
            await runTest(file);
        }
        return;
    }

    const testFile = SCENARIOS[scenario];
    if (!testFile) {
        console.error(`Unknown scenario: ${scenario}`);
        console.log("Available:", Object.keys(SCENARIOS).join(", "));
        process.exit(1);
    }

    console.log(`Running scenario ${scenario}...`);
    await runTest(testFile);
}

function runTest(testFile) {
    return new Promise((resolve, reject) => {
        const child = spawn("npx", ["hardhat", "test", testFile], {
            stdio: "inherit",
            shell: true,
            cwd: path.join(__dirname, "..")
        });

        child.on("close", (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Test exited with code ${code}`));
            }
        });

        child.on("error", reject);
    });
}

main().catch((error) => {
    console.error(error.message);
    process.exit(1);
});



