#!/usr/bin/env node

/**
 * Simple test runner para validar funciones de purchase-service
 * Ejecuta sin dependencias de Vitest
 */

// ==================== FUNCIONES TEST ====================

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function describe(name, fn) {
    console.log(`\n📋 ${name}`);
    fn();
}

function it(name, fn) {
    totalTests++;
    try {
        fn();
        passedTests++;
        console.log(`  ✅ ${name}`);
    } catch (error) {
        failedTests++;
        console.error(`  ❌ ${name}`);
        console.error(`     ${error.message}`);
    }
}

function expect(value) {
    return {
        toBe(expected) {
            if (value !== expected) {
                throw new Error(`Expected ${expected}, got ${value}`);
            }
        },
        toBeCloseTo(expected, precision = 2) {
            const tolerance = Math.pow(10, -precision);
            if (Math.abs(value - expected) > tolerance) {
                throw new Error(
                    `Expected close to ${expected}, got ${value} (precision: ${precision})`
                );
            }
        },
        toBeGreaterThan(expected) {
            if (!(value > expected)) {
                throw new Error(`Expected > ${expected}, got ${value}`);
            }
        },
        toBeGreaterThanOrEqual(expected) {
            if (!(value >= expected)) {
                throw new Error(`Expected >= ${expected}, got ${value}`);
            }
        },
        toBeLessThan(expected) {
            if (!(value < expected)) {
                throw new Error(`Expected < ${expected}, got ${value}`);
            }
        },
        toBeLessThanOrEqual(expected) {
            if (!(value <= expected)) {
                throw new Error(`Expected <= ${expected}, got ${value}`);
            }
        },
        toThrow(ErrorType) {
            try {
                value();
                throw new Error("Expected to throw, but did not");
            } catch (error) {
                if (ErrorType && !(error instanceof ErrorType)) {
                    throw new Error(
                        `Expected ${ErrorType.name}, got ${error.constructor.name}`
                    );
                }
            }
        },
        not: {
            toThrow(ErrorType) {
                try {
                    value();
                } catch (error) {
                    throw new Error(
                        `Expected not to throw, but threw ${error.constructor.name}`
                    );
                }
            },
        },
        toHaveProperty(prop) {
            if (!(prop in value)) {
                throw new Error(`Expected to have property ${prop}`);
            }
        },
        toBeInstanceOf(Type) {
            if (!(value instanceof Type)) {
                throw new Error(`Expected instance of ${Type.name}`);
            }
        },
        toBeDefined() {
            if (value === undefined) {
                throw new Error("Expected to be defined");
            }
        },
        toContain(substring) {
            if (!value.includes(substring)) {
                throw new Error(
                    `Expected to contain "${substring}" in "${value}"`
                );
            }
        },
    };
}

// ==================== FUNCIONES DESDE purchase-service ====================

class PurchaseError extends Error {
    constructor(message, code, context) {
        super(
            `${message} [${code}]${context ? ` - ${JSON.stringify(context)}` : ""}`
        );
        this.name = "PurchaseError";
        this.code = code;
        this.context = context;
    }
}

function validateAuthentication(token) {
    if (!token) {
        throw new PurchaseError(
            "Token de autenticación requerido",
            "NOT_AUTHENTICATED"
        );
    }
}

function validateWalletAddress(address) {
    if (!address || typeof address !== "string") {
        throw new PurchaseError(
            "Dirección de wallet requerida",
            "INVALID_WALLET"
        );
    }

    if (address.trim().length === 0) {
        throw new PurchaseError(
            "Dirección de wallet no puede estar vacía",
            "INVALID_WALLET"
        );
    }

    // Validación básica de dirección Solana (base58, longitud típica 44)
    if (address.length < 20 || address.length > 50) {
        throw new PurchaseError(
            "Dirección de wallet inválida",
            "INVALID_WALLET"
        );
    }

    // Validar caracteres base58 (sin 0, O, I, l)
    const base58Regex = /^[1-9A-HJ-NP-Z]+$/;
    if (!base58Regex.test(address)) {
        throw new PurchaseError(
            "Dirección de wallet contiene caracteres inválidos",
            "INVALID_WALLET"
        );
    }
}

function validateTokenAmount(amount) {
    if (typeof amount !== "number" || !isFinite(amount)) {
        throw new PurchaseError(
            "Cantidad de tokens debe ser un número válido",
            "INVALID_AMOUNT"
        );
    }

    if (amount <= 0) {
        throw new PurchaseError(
            "Cantidad de tokens debe ser mayor a cero",
            "INVALID_AMOUNT"
        );
    }
}

function validatePrices(tokenPriceUsd, solPriceUsd) {
    if (!isFinite(tokenPriceUsd) || tokenPriceUsd <= 0) {
        throw new PurchaseError(
            "Precio del token debe ser un número positivo",
            "INVALID_PRICE"
        );
    }

    if (!isFinite(solPriceUsd) || solPriceUsd <= 0) {
        throw new PurchaseError(
            "Precio de SOL debe ser un número positivo",
            "INVALID_PRICE"
        );
    }
}

function calculatePrices(amount, tokenPriceUsd, solPriceUsd, isTestMode) {
    // Validar entrada
    validateTokenAmount(amount);
    validatePrices(tokenPriceUsd, solPriceUsd);

    // Constantes de fees
    const GAS_FEE = 0.000005;
    const PLATFORM_FEE = 0.000005;

    // Calcular precio del token en SOL
    const tokenPriceInSol = tokenPriceUsd / solPriceUsd;

    // Calcular costo total en SOL (sin fees)
    const totalTokenCostInSol = isTestMode ? 0 : amount * tokenPriceInSol;

    // Calcular total con fees
    const totalFees = GAS_FEE + PLATFORM_FEE;
    const totalCostInSol = totalTokenCostInSol + totalFees;

    return {
        tokenPriceInSol,
        totalTokenCostInSol,
        gasFee: GAS_FEE,
        platformFee: PLATFORM_FEE,
        totalFees,
        totalCostInSol,
    };
}

// ==================== TESTS ====================

console.log("\n🧪 INICIANDO SUITE DE TESTS\n");
console.log("=".repeat(60));

// Tests: Validaciones
describe("✓ Validaciones - Autenticación", () => {
    it("debería pasar con token válido", () => {
        expect(() => validateAuthentication("token-valid-123")).not.toThrow();
    });

    it("debería lanzar error con token vacío", () => {
        expect(() => validateAuthentication("")).toThrow(PurchaseError);
    });

    it("debería lanzar error con token null", () => {
        expect(() => validateAuthentication(null)).toThrow(PurchaseError);
    });
});

describe("✓ Validaciones - Wallet Address", () => {
    it("debería pasar con dirección válida", () => {
        expect(() =>
            validateWalletAddress("11111111111111111111111111111112")
        ).not.toThrow();
    });

    it("debería lanzar error con dirección vacía", () => {
        expect(() => validateWalletAddress("")).toThrow(PurchaseError);
    });

    it("debería lanzar error con dirección inválida", () => {
        expect(() => validateWalletAddress("invalid!@#")).toThrow(
            PurchaseError
        );
    });
});

describe("✓ Validaciones - Token Amount", () => {
    it("debería pasar con cantidad positiva", () => {
        expect(() => validateTokenAmount(100)).not.toThrow();
    });

    it("debería pasar con cantidad decimal", () => {
        expect(() => validateTokenAmount(1.5)).not.toThrow();
    });

    it("debería lanzar error con cantidad 0", () => {
        expect(() => validateTokenAmount(0)).toThrow(PurchaseError);
    });

    it("debería lanzar error con cantidad negativa", () => {
        expect(() => validateTokenAmount(-10)).toThrow(PurchaseError);
    });

    it("debería lanzar error con Infinity", () => {
        expect(() => validateTokenAmount(Infinity)).toThrow(PurchaseError);
    });

    it("debería lanzar error con NaN", () => {
        expect(() => validateTokenAmount(NaN)).toThrow(PurchaseError);
    });
});

describe("✓ Validaciones - Prices", () => {
    it("debería pasar con precios válidos", () => {
        expect(() => validatePrices(0.01, 150)).not.toThrow();
    });

    it("debería lanzar error cuando precio token es 0", () => {
        expect(() => validatePrices(0, 150)).toThrow(PurchaseError);
    });

    it("debería lanzar error cuando precio SOL es 0", () => {
        expect(() => validatePrices(0.01, 0)).toThrow(PurchaseError);
    });

    it("debería lanzar error cuando precio token es negativo", () => {
        expect(() => validatePrices(-0.01, 150)).toThrow(PurchaseError);
    });

    it("debería lanzar error cuando precio SOL es Infinity", () => {
        expect(() => validatePrices(0.01, Infinity)).toThrow(PurchaseError);
    });
});

// Tests: Cálculo de Precios
describe("✓ Cálculo - Precios en SOL", () => {
    it("debería calcular correctamente en modo normal", () => {
        const result = calculatePrices(100, 0.01, 150, false);

        const expectedTokenPrice = 0.01 / 150;
        const expectedTotal = (100 * 0.01) / 150;

        expect(result.tokenPriceInSol).toBeCloseTo(expectedTokenPrice, 8);
        expect(result.totalTokenCostInSol).toBeCloseTo(expectedTotal, 8);
    });

    it("debería incluir fees en el cálculo", () => {
        const result = calculatePrices(100, 0.01, 150, false);

        expect(result.gasFee).toBeGreaterThan(0);
        expect(result.platformFee).toBeGreaterThan(0);
        expect(result.totalFees).toBe(result.gasFee + result.platformFee);
    });

    it("debería calcular correctamente el costo total con fees", () => {
        const result = calculatePrices(100, 0.01, 150, false);

        const expected = result.totalTokenCostInSol + result.totalFees;
        expect(result.totalCostInSol).toBeCloseTo(expected, 10);
    });

    it("debería aplicar costo cero en modo test", () => {
        const resultNormal = calculatePrices(100, 0.01, 150, false);
        const resultTest = calculatePrices(100, 0.01, 150, true);

        expect(resultTest.totalTokenCostInSol).toBe(0);
        expect(resultTest.totalFees).toBeGreaterThan(0);
        expect(resultTest.totalCostInSol).toBeLessThan(
            resultNormal.totalCostInSol
        );
    });
});

describe("✓ Cálculo - Edge Cases", () => {
    it("debería manejar cantidad muy pequeña", () => {
        const result = calculatePrices(0.001, 0.01, 150, false);

        expect(result.totalTokenCostInSol).toBeGreaterThan(0);
        expect(isFinite(result.totalTokenCostInSol)).toBe(true);
    });

    it("debería manejar cantidad muy grande", () => {
        const result = calculatePrices(1000000, 0.01, 150, false);

        const expected = (1000000 * 0.01) / 150;
        expect(result.totalTokenCostInSol).toBeCloseTo(expected, 4);
        expect(isFinite(result.totalCostInSol)).toBe(true);
    });

    it("debería manejar SOL price muy bajo", () => {
        const result = calculatePrices(100, 0.01, 0.1, false);

        const expected = (100 * 0.01) / 0.1;
        expect(result.totalTokenCostInSol).toBeCloseTo(expected, 4);
    });

    it("debería manejar SOL price muy alto", () => {
        const result = calculatePrices(100, 0.01, 1000, false);

        const expected = (100 * 0.01) / 1000;
        expect(result.totalTokenCostInSol).toBeCloseTo(expected, 8);
    });

    it("debería validar precios antes de calcular", () => {
        expect(() => calculatePrices(100, 0, 150, false)).toThrow(
            PurchaseError
        );
        expect(() => calculatePrices(100, 0.01, 0, false)).toThrow(
            PurchaseError
        );
    });

    it("debería validar cantidad antes de calcular", () => {
        expect(() => calculatePrices(0, 0.01, 150, false)).toThrow(
            PurchaseError
        );
        expect(() => calculatePrices(-100, 0.01, 150, false)).toThrow(
            PurchaseError
        );
    });
});

describe("✓ Cálculo - Estructura", () => {
    it("debería devolver estructura completa", () => {
        const result = calculatePrices(100, 0.01, 150, false);

        expect(result).toHaveProperty("tokenPriceInSol");
        expect(result).toHaveProperty("totalTokenCostInSol");
        expect(result).toHaveProperty("gasFee");
        expect(result).toHaveProperty("platformFee");
        expect(result).toHaveProperty("totalFees");
        expect(result).toHaveProperty("totalCostInSol");
    });

    it("debería mantener todos los valores finitos", () => {
        const result = calculatePrices(100, 0.01, 150, false);

        expect(isFinite(result.tokenPriceInSol)).toBe(true);
        expect(isFinite(result.totalTokenCostInSol)).toBe(true);
        expect(isFinite(result.gasFee)).toBe(true);
        expect(isFinite(result.platformFee)).toBe(true);
        expect(isFinite(result.totalFees)).toBe(true);
        expect(isFinite(result.totalCostInSol)).toBe(true);
    });

    it("debería garantizar totalCostInSol >= totalTokenCostInSol", () => {
        for (let i = 1; i <= 10; i++) {
            const result = calculatePrices(i * 100, 0.01, 150, false);
            expect(result.totalCostInSol).toBeGreaterThanOrEqual(
                result.totalTokenCostInSol
            );
        }
    });
});

describe("✓ Error Handling - PurchaseError", () => {
    it("debería crear error con mensaje y código", () => {
        const error = new PurchaseError("Test error", "TEST_CODE");

        expect(error.message).toContain("Test error");
        expect(error.message).toContain("TEST_CODE");
    });

    it("debería ser instancia de Error", () => {
        const error = new PurchaseError("Test error", "TEST_CODE");

        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(PurchaseError);
    });

    it("debería tener nombre descriptivo", () => {
        const error = new PurchaseError("Test error", "TEST_CODE");

        expect(error.name).toBe("PurchaseError");
    });
});

describe("✓ Integración - Flujo Completo", () => {
    it("debería completar validación y cálculo", () => {
        expect(() => {
            validateAuthentication("token-valid");
            validateWalletAddress("11111111111111111111111111111112");
            validateTokenAmount(100);
            validatePrices(0.01, 150);

            const result = calculatePrices(100, 0.01, 150, false);
            expect(result.totalCostInSol).toBeGreaterThan(0);
        }).not.toThrow();
    });

    it("debería fallar en la primera validación inválida", () => {
        expect(() => {
            validateAuthentication("");
            validateWalletAddress("11111111111111111111111111111112");
            validateTokenAmount(100);
        }).toThrow(PurchaseError);
    });
});

// ==================== RESUMEN ====================

console.log("\n" + "=".repeat(60));
console.log("\n📊 RESUMEN DE TESTS\n");
console.log(`Total Tests:   ${totalTests}`);
console.log(`✅ Pasados:     ${passedTests}`);
console.log(`❌ Fallidos:    ${failedTests}`);
console.log(`Success Rate:  ${((passedTests / totalTests) * 100).toFixed(1)}%`);

if (failedTests === 0) {
    console.log("\n🎉 ¡TODOS LOS TESTS PASARON!\n");
    process.exit(0);
} else {
    console.log("\n⚠️  ALGUNOS TESTS FALLARON\n");
    process.exit(1);
}
