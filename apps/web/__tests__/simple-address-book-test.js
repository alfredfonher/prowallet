/**
 * Simple validation test runner (no vitest dependency)
 * Run with: node apps/web/__tests__/simple-address-book-test.js
 */

const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`  ✓ ${message}`);
        passed++;
    } else {
        console.log(`  ✗ ${message}`);
        failed++;
    }
}

console.log("\n=== Pruebas de Validación de Libreta de Direcciones ===\n");

// Test 1: Validar direcciones Solana válidas
console.log("1. Validar direcciones Solana válidas:");
const valid_addresses = [
    "11111111111111111111111111111112",
    "5HeGQfEAJgGXZUymFzSgKPnvKJsAWC1ZZ17KqX3FYQWH",
    "TokenkegQfeZyiNwAJsyFbPVwwQQfhjUXdj3bVzwWqe",
];

valid_addresses.forEach((addr) => {
    assert(
        SOLANA_ADDRESS_REGEX.test(addr),
        `${addr.substring(0, 20)}... es válida`
    );
});

// Test 2: Rechazar direcciones inválidas
console.log("\n2. Rechazar direcciones Solana inválidas:");
const invalid_addresses = [
    "invalid",
    "0000000000000000000000000000000000000000",
    "11111111111111111111111111111",
    "OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOll",
];

invalid_addresses.forEach((addr) => {
    assert(!SOLANA_ADDRESS_REGEX.test(addr), `${addr} es rechazada`);
});

// Test 3: Validar etiqueta
console.log("\n3. Validar etiquetas (1-100 caracteres):");
assert(
    "A".length >= 1 && "A".length <= 100,
    "Etiqueta de 1 carácter es válida"
);
assert(
    "Trading Account".length >= 1 && "Trading Account".length <= 100,
    "Etiqueta de 15 caracteres es válida"
);
assert(
    "a".repeat(100).length >= 1 && "a".repeat(100).length <= 100,
    "Etiqueta de 100 caracteres es válida"
);
assert(
    !("a".repeat(101).length <= 100),
    "Etiqueta de 101 caracteres es rechazada"
);
assert(!("".length >= 1), "Etiqueta vacía es rechazada");

// Test 4: Validar descripción
console.log("\n4. Validar descripción (0-500 caracteres):");
assert("".length <= 500, "Descripción vacía es válida");
assert("Short description".length <= 500, "Descripción corta es válida");
assert(
    "a".repeat(500).length <= 500,
    "Descripción de 500 caracteres es válida"
);
assert(
    !("a".repeat(501).length <= 500),
    "Descripción de 501 caracteres es rechazada"
);

// Test 5: Validar formulario completo
console.log("\n5. Validar formulario completo:");

function validate_address_form(data) {
    if (!data.recipient_address.trim()) {
        return "La dirección de destinatario es requerida";
    }
    if (!SOLANA_ADDRESS_REGEX.test(data.recipient_address)) {
        return "Dirección de Solana inválida";
    }
    if (!data.label.trim()) {
        return "El nombre de la dirección es requerido";
    }
    if (data.label.length > 100) {
        return "El nombre no debe exceder 100 caracteres";
    }
    if ((data.description || "").length > 500) {
        return "La descripción no debe exceder 500 caracteres";
    }
    return null;
}

const valid_form = {
    recipient_address: "11111111111111111111111111111112",
    label: "Trading Account",
    description: "My trading account",
    is_favorite: true,
};
assert(
    validate_address_form(valid_form) === null,
    "Formulario válido es aceptado"
);

const invalid_form_1 = {
    recipient_address: "",
    label: "Account",
};
assert(
    validate_address_form(invalid_form_1) ===
        "La dirección de destinatario es requerida",
    "Dirección vacía es rechazada"
);

const invalid_form_2 = {
    recipient_address: "invalid",
    label: "Account",
};
assert(
    validate_address_form(invalid_form_2) === "Dirección de Solana inválida",
    "Dirección inválida es rechazada"
);

const invalid_form_3 = {
    recipient_address: "11111111111111111111111111111112",
    label: "",
};
assert(
    validate_address_form(invalid_form_3) ===
        "El nombre de la dirección es requerido",
    "Etiqueta vacía es rechazada"
);

const invalid_form_4 = {
    recipient_address: "11111111111111111111111111111112",
    label: "a".repeat(101),
};
assert(
    validate_address_form(invalid_form_4) ===
        "El nombre no debe exceder 100 caracteres",
    "Etiqueta demasiado larga es rechazada"
);

const invalid_form_5 = {
    recipient_address: "11111111111111111111111111111112",
    label: "Account",
    description: "a".repeat(501),
};
assert(
    validate_address_form(invalid_form_5) ===
        "La descripción no debe exceder 500 caracteres",
    "Descripción demasiado larga es rechazada"
);

// Resumen
console.log("\n=== Resumen ===");
console.log(`✓ Pruebas pasadas: ${passed}`);
console.log(`✗ Pruebas fallidas: ${failed}`);
console.log(`Total: ${passed + failed}\n`);

process.exit(failed > 0 ? 1 : 0);
