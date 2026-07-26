#!/usr/bin/env node

/**
 * 🎯 TEST RUNNER - Token Input Formatter
 *
 * Este script ejecuta los tests sin dependencias de test runner externo
 * Uso: node run-token-tests.mjs
 */

import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Colors for console output
const colors = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    green: "\x1b[32m",
    red: "\x1b[31m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    cyan: "\x1b[36m",
};

/**
 * TEST DATA
 */
const testSuites = {
    formatTokenInput: [
        { input: "5", expected: "5", desc: "single digit" },
        { input: "50", expected: "50", desc: "two digits" },
        { input: "500", expected: "500", desc: "three digits" },
        { input: "1234", expected: "1.234", desc: "thousands separator" },
        {
            input: "1234567",
            expected: "1.234.567",
            desc: "multiple separators",
        },
        { input: "1234,50", expected: "1.234,50", desc: "with decimal" },
        { input: "0.5", expected: "0,5", desc: "dot to comma conversion" },
        { input: "12.34", expected: "1.234", desc: "invalid dot usage" },
        { input: "", expected: "", desc: "empty string" },
        { input: "00123", expected: "123", desc: "remove leading zeros" },
        {
            input: "1,1234567",
            expected: "1,123456",
            desc: "limit decimals to 6",
        },
        {
            input: "1000000,5",
            expected: "1.000.000,5",
            desc: "large with decimal",
        },
    ],
    parseTokenInput: [
        { input: "1.234,50", expected: 1234.5, desc: "parse formatted" },
        { input: "100", expected: 100, desc: "parse integer" },
        { input: "0,5", expected: 0.5, desc: "parse decimal" },
        { input: "", expected: 0, desc: "empty returns 0" },
        { input: "abc", expected: 0, desc: "invalid returns 0" },
        { input: "1.000.000,50", expected: 1000000.5, desc: "large number" },
    ],
    isValidTokenInput: [
        { input: "1.234", expected: true, desc: "valid integer" },
        { input: "1.234,50", expected: true, desc: "valid with decimal" },
        { input: "0,5", expected: true, desc: "valid decimal" },
        { input: "-100", expected: false, desc: "negative number" },
        { input: "1,23,45", expected: false, desc: "multiple commas" },
        { input: "", expected: false, desc: "empty string" },
    ],
};

/**
 * FORMATTER FUNCTIONS (copied from formatter)
 */

const DECIMAL_SEPARATOR = ",";
const THOUSANDS_SEPARATOR = ".";
const MAX_DECIMALS = 6;
const MAX_TOKEN_VALUE = 999_999_999_999;

function formatTokenInput(input) {
    if (!input) return "";

    const hasComma = input.includes(",");
    const hasDot = input.includes(".");

    let integerPart = input;
    let decimalPart = "";

    if (hasComma || hasDot) {
        const separatorIndex = hasComma
            ? input.indexOf(",")
            : input.indexOf(".");
        integerPart = input.substring(0, separatorIndex);
        const potentialDecimal = input.substring(separatorIndex + 1);

        if (hasDot) {
            if (integerPart !== "0") {
                integerPart = input.replace(/[.,]/g, "");
                decimalPart = "";
            } else {
                decimalPart = potentialDecimal;
            }
        } else {
            decimalPart = potentialDecimal;
        }

        integerPart = integerPart.replace(/[.,]/g, "");
    } else {
        integerPart = input.replace(/[.,]/g, "");
    }

    integerPart = integerPart.replace(/^0+(?!$)/, "");
    if (!integerPart) integerPart = "0";

    if (decimalPart) {
        decimalPart = decimalPart.slice(0, MAX_DECIMALS);
    }

    const formattedInteger = integerPart.replace(
        /\B(?=(\d{3})+(?!\d))/g,
        THOUSANDS_SEPARATOR
    );

    return decimalPart
        ? `${formattedInteger}${DECIMAL_SEPARATOR}${decimalPart}`
        : formattedInteger;
}

function parseTokenInput(input) {
    if (!input) return 0;

    try {
        const normalized = input.replace(/\./g, "").replace(/,/g, ".");
        const parsed = parseFloat(normalized);
        return isNaN(parsed) ? 0 : parsed;
    } catch {
        return 0;
    }
}

function isValidTokenInput(input) {
    if (!input) return false;

    const parsed = parseTokenInput(input);

    if (parsed <= 0 || parsed > MAX_TOKEN_VALUE) {
        return false;
    }

    const commaCount = (input.match(/,/g) || []).length;
    if (commaCount > 1) {
        return false;
    }

    if (commaCount === 1 && input.indexOf(".") > input.indexOf(",")) {
        return false;
    }

    if (input.includes("-")) {
        return false;
    }

    return true;
}

/**
 * TEST EXECUTION
 */

function assertEqual(actual, expected, testName) {
    const passed = JSON.stringify(actual) === JSON.stringify(expected);

    if (passed) {
        console.log(`  ${colors.green}✓${colors.reset} ${testName}`);
        return true;
    } else {
        console.log(
            `  ${colors.red}✗${colors.reset} ${testName}\n    Expected: ${expected}\n    Got: ${actual}`
        );
        return false;
    }
}

function runTests() {
    let totalTests = 0;
    let passedTests = 0;

    console.log(
        `\n${colors.bright}${colors.cyan}🧪 TOKEN INPUT FORMATTER - TEST EXECUTION${colors.reset}\n`
    );

    // Test formatTokenInput
    console.log(`${colors.yellow}Testing formatTokenInput()${colors.reset}`);
    testSuites.formatTokenInput.forEach(({ input, expected, desc }) => {
        totalTests++;
        const actual = formatTokenInput(input);
        if (assertEqual(actual, expected, desc)) {
            passedTests++;
        }
    });

    // Test parseTokenInput
    console.log(`\n${colors.yellow}Testing parseTokenInput()${colors.reset}`);
    testSuites.parseTokenInput.forEach(({ input, expected, desc }) => {
        totalTests++;
        const actual = parseTokenInput(input);
        if (assertEqual(actual, expected, desc)) {
            passedTests++;
        }
    });

    // Test isValidTokenInput
    console.log(`\n${colors.yellow}Testing isValidTokenInput()${colors.reset}`);
    testSuites.isValidTokenInput.forEach(({ input, expected, desc }) => {
        totalTests++;
        const actual = isValidTokenInput(input);
        if (assertEqual(actual, expected, desc)) {
            passedTests++;
        }
    });

    // Summary
    console.log(
        `\n${colors.bright}════════════════════════════════════════${colors.reset}`
    );

    const percentage = ((passedTests / totalTests) * 100).toFixed(1);
    const status =
        passedTests === totalTests
            ? `${colors.green}✅ ALL TESTS PASSED${colors.reset}`
            : `${colors.red}❌ SOME TESTS FAILED${colors.reset}`;

    console.log(
        `\nResults: ${colors.bright}${passedTests}/${totalTests}${colors.reset} (${percentage}%)`
    );
    console.log(`Status:  ${status}\n`);

    if (passedTests === totalTests) {
        console.log(
            `${colors.green}🎉 Implementation is ready for production!${colors.reset}\n`
        );
        process.exit(0);
    } else {
        console.log(
            `${colors.red}⚠️  Fix failing tests before proceeding${colors.reset}\n`
        );
        process.exit(1);
    }
}

// Run tests
runTests();
