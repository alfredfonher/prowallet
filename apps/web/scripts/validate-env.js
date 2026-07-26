#!/usr/bin/env node
/**
 * Validador de configuración de entorno
 * Verifica que NEXT_PUBLIC_ENVIRONMENT esté correctamente configurado
 */

const path = require("path");
const fs = require("fs");

const envLocalPath = path.join(__dirname, "..", ".env.local");

console.log("🔍 Validando configuración de entorno...\n");

// Leer .env.local
if (!fs.existsSync(envLocalPath)) {
    console.error("❌ .env.local no encontrado");
    process.exit(1);
}

const envContent = fs.readFileSync(envLocalPath, "utf8");
const envLines = envContent.split("\n");

// Buscar NEXT_PUBLIC_ENVIRONMENT
const envLine = envLines.find((line) =>
    line.trim().startsWith("NEXT_PUBLIC_ENVIRONMENT=")
);

if (!envLine) {
    console.error(
        "❌ NEXT_PUBLIC_ENVIRONMENT no está configurado en .env.local"
    );
    console.error(
        "\nAñade esta línea a .env.local:\n  NEXT_PUBLIC_ENVIRONMENT=local\n"
    );
    process.exit(1);
}

const envValue = envLine.split("=")[1]?.trim();

if (!envValue || (envValue !== "local" && envValue !== "production")) {
    console.error(
        `❌ Valor inválido para NEXT_PUBLIC_ENVIRONMENT: "${envValue}"`
    );
    console.error('   Valores válidos: "local" o "production"\n');
    process.exit(1);
}

console.log(`✅ NEXT_PUBLIC_ENVIRONMENT="${envValue}"`);

// Validar URLs según el entorno
const apiUrlLocal = envLines
    .find((line) => line.trim().startsWith("NEXT_PUBLIC_API_URL_LOCAL="))
    ?.split("=")[1]
    ?.trim();

const apiUrlCloud = envLines
    .find((line) => line.trim().startsWith("NEXT_PUBLIC_API_URL_CLOUD="))
    ?.split("=")[1]
    ?.trim();

console.log(`✅ API URL Local: ${apiUrlLocal}`);
console.log(`✅ API URL Cloud: ${apiUrlCloud}`);

// Advertencia si estamos en local pero sin servidor local
if (envValue === "local" && !apiUrlLocal?.includes("localhost")) {
    console.warn(
        "\n⚠️  NEXT_PUBLIC_ENVIRONMENT=local pero NEXT_PUBLIC_API_URL_LOCAL no es localhost"
    );
}

console.log("\n✅ Configuración válida. El sistema usará:");
console.log(`   Ambiente: ${envValue}`);
console.log(
    `   API URL: ${envValue === "local" ? apiUrlLocal : apiUrlCloud}\n`
);
