import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "ProWallet API",
      version: "1.0.0",
      description:
        "API para interactuar con el smart contract de ProWallet en Solana blockchain",
      contact: {
        name: "ProWallet Team",
        email: "contact@prowallet.io",
      },
      license: {
        name: "MIT",
        url: "https://opensource.org/licenses/MIT",
      },
    },
    servers: [
      {
        // url: process.env.BASE_URL || "https://servicioshilda.orioncaribe.com/",
        url: process.env.BASE_URL || "https://servicioshilda.orioncaribe.com/",
        description: "Servidor de desarrollo",
      },
      {
        url: "https://api.prowallet.io",
        description: "Servidor de producción",
      },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "X-API-Key",
        },
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description:
            "JWT token obtenido del login o autenticación por wallet",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            error: {
              type: "string",
              example: "Error message",
            },
          },
        },
        SuccessResponse: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: true,
            },
            message: {
              type: "string",
              example: "Operation completed successfully",
            },
          },
        },
        User: {
          type: "object",
          properties: {
            wallet: {
              type: "string",
              description: "Dirección de wallet Solana del usuario",
              example: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
            },
            shares: {
              type: "number",
              description: "Participaciones del usuario en el protocolo",
              example: 1000,
            },
            totalClaimed: {
              type: "number",
              description: "Total de recompensas reclamadas por el usuario",
              example: 250.75,
            },
            isWhitelisted: {
              type: "boolean",
              description: "Si el usuario está en la whitelist",
              example: true,
            },
            lastClaimTime: {
              type: "number",
              description: "Timestamp de la última reclamación",
              example: 1734567890,
            },
          },
        },
        ContractState: {
          type: "object",
          properties: {
            totalShares: {
              type: "number",
              description: "Total de participaciones en el protocolo",
              example: 10000,
            },
            totalRevenue: {
              type: "number",
              description: "Total de ingresos depositados",
              example: 50000.5,
            },
            totalDistributed: {
              type: "number",
              description: "Total de recompensas distribuidas",
              example: 30000.25,
            },
            isPaused: {
              type: "boolean",
              description: "Si el contrato está pausado",
              example: false,
            },
            emergencyStopped: {
              type: "boolean",
              description: "Si el contrato está en parada de emergencia",
              example: false,
            },
            merkleRoot: {
              type: "string",
              description: "Root del árbol Merkle para whitelist",
              example: "0x1234567890abcdef...",
            },
          },
        },
        MultisigConfig: {
          type: "object",
          properties: {
            threshold: {
              type: "number",
              description: "Número mínimo de firmas requeridas",
              example: 2,
            },
            owners: {
              type: "array",
              items: {
                type: "string",
              },
              description:
                "Lista de direcciones de los propietarios del multisig",
              example: [
                "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
                "2WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWX",
              ],
            },
            nonce: {
              type: "number",
              description: "Nonce actual del multisig",
              example: 5,
            },
          },
        },
        Proposal: {
          type: "object",
          properties: {
            id: {
              type: "number",
              description: "ID único de la propuesta",
              example: 1,
            },
            proposer: {
              type: "string",
              description: "Dirección del wallet que propuso",
              example: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
            },
            target: {
              type: "string",
              description: "Dirección objetivo de la propuesta",
              example: "2WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWX",
            },
            value: {
              type: "number",
              description: "Valor asociado con la propuesta",
              example: 1000,
            },
            data: {
              type: "string",
              description: "Datos codificados de la propuesta",
              example: "0x1234567890abcdef...",
            },
            executed: {
              type: "boolean",
              description: "Si la propuesta ha sido ejecutada",
              example: false,
            },
            confirmationCount: {
              type: "number",
              description: "Número de confirmaciones recibidas",
              example: 1,
            },
            confirmations: {
              type: "array",
              items: {
                type: "string",
              },
              description: "Lista de direcciones que han confirmado",
              example: ["9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"],
            },
          },
        },
        HealthStatus: {
          type: "object",
          properties: {
            status: {
              type: "string",
              example: "ok",
            },
            timestamp: {
              type: "string",
              format: "date-time",
              example: "2024-01-01T00:00:00.000Z",
            },
            uptime: {
              type: "number",
              description: "Tiempo de actividad en segundos",
              example: 3600,
            },
            version: {
              type: "string",
              example: "1.0.0",
            },
            environment: {
              type: "string",
              example: "development",
            },
          },
        },
        TokenInfo: {
          type: "object",
          properties: {
            mint: {
              type: "string",
              description: "Mint address del token",
              example: "BBZ8JF3SwhKVjpUMDe1ycFxLSCpXZPWErPWNpRduYjpH",
            },
            decimals: {
              type: "number",
              example: 9,
            },
            name: {
              type: "string",
              example: "ProWallet",
            },
            symbol: {
              type: "string",
              example: "GAP",
            },
            totalSupply: {
              type: "string",
            },
          },
        },
        PriceData: {
          type: "object",
          properties: {
            prowalletPrice: {
              type: "number",
              description: "Precio de GAP en SOL",
              example: 0.00025,
            },
            solPrice: {
              type: "number",
              description: "Precio de SOL en USD",
              example: 189.5,
            },
            priceUSD: {
              type: "number",
              description: "Precio de GAP en USD",
              example: 0.0475,
            },
            updatedAt: {
              type: "string",
              format: "date-time",
            },
          },
        },
        Purchase: {
          type: "object",
          properties: {
            purchaseId: {
              type: "string",
              description: "ID único de la compra",
            },
            wallet: {
              type: "string",
              description: "Wallet del comprador",
            },
            amount: {
              type: "number",
              description: "Cantidad de tokens",
            },
            totalCost: {
              type: "number",
              description: "Costo total en SOL",
            },
            status: {
              type: "string",
              enum: [
                "pending",
                "processing",
                "completed",
                "failed",
                "cancelled",
              ],
            },
            paymentMethod: {
              type: "string",
              enum: ["solana", "stripe", "coingate", "nowpayments"],
            },
            createdAt: {
              type: "string",
              format: "date-time",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
            },
          },
        },
        Transfer: {
          type: "object",
          properties: {
            transferId: {
              type: "string",
            },
            fromWallet: {
              type: "string",
            },
            toWallet: {
              type: "string",
            },
            amount: {
              type: "number",
            },
            status: {
              type: "string",
              enum: ["pending", "confirmed", "failed"],
            },
            signature: {
              type: "string",
              nullable: true,
            },
            createdAt: {
              type: "string",
              format: "date-time",
            },
          },
        },
        AuthChallenge: {
          type: "object",
          properties: {
            challenge: {
              type: "string",
              description: "Mensaje a firmar con la wallet",
            },
            message: {
              type: "string",
            },
            expiresIn: {
              type: "number",
              description: "Segundos hasta que expire",
            },
          },
        },
        JWTResponse: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
            },
            token: {
              type: "string",
              description: "JWT token para autenticación",
            },
            user: {
              type: "object",
              properties: {
                wallet: {
                  type: "string",
                },
                username: {
                  type: "string",
                  nullable: true,
                },
              },
            },
          },
        },
        ContractInfo: {
          type: "object",
          properties: {
            programId: {
              type: "string",
              description: "Program ID del contrato",
            },
            totalShares: {
              type: "number",
            },
            totalRevenue: {
              type: "number",
            },
            totalDistributed: {
              type: "number",
            },
            owner: {
              type: "string",
            },
            isPaused: {
              type: "boolean",
            },
          },
        },
      },
      responses: {
        BadRequest: {
          description: "Bad Request",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
              example: {
                error: "Invalid request parameters",
              },
            },
          },
        },
        Unauthorized: {
          description: "Unauthorized",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
              example: {
                error: "API key is required",
              },
            },
          },
        },
        NotFound: {
          description: "Not Found",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
              example: {
                error: "Resource not found",
              },
            },
          },
        },
        TooManyRequests: {
          description: "Too Many Requests",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
              example: {
                error: "Rate limit exceeded",
              },
            },
          },
        },
        InternalServerError: {
          description: "Internal Server Error",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
              example: {
                error: "Internal server error",
              },
            },
          },
        },
      },
    },
    security: [
      {
        ApiKeyAuth: [],
      },
    ],
    tags: [
      {
        name: "Health",
        description:
          "Health check endpoints para monitorear el estado del servidor",
      },
      {
        name: "Auth",
        description:
          "Autenticación y gestión de usuarios (wallet y username/password)",
      },
      {
        name: "Exchange",
        description: "Operaciones de intercambio de tokens",
      },
      {
        name: "Purchase",
        description: "Compra de tokens ProWallet",
      },
      {
        name: "Transfer",
        description: "Transferencia de tokens entre wallets",
      },
      {
        name: "ProWallet",
        description: "Información del contrato inteligente ProWallet",
      },
      {
        name: "Solana",
        description: "Proxy RPC para interactuar con Solana blockchain",
      },
      {
        name: "Admin",
        description: "Endpoints administrativos (requieren autenticación)",
      },
      {
        name: "Notifications",
        description: "Sistema de notificaciones en tiempo real via SSE",
      },
      {
        name: "Payments",
        description: "Webhooks para procesadores de pagos",
      },
    ],
  },
  apis: [
    "./src/routes/**/*.ts",
    "./src/controllers/**/*.ts",
    "./src/docs/**/*.ts",
  ],
};

let specs: any = {};
try {
  specs = swaggerJsdoc(options);
} catch (err: any) {
  // If swagger-jsdoc fails to parse JSDoc blocks (YAML syntax issues),
  // avoid crashing the app and export a minimal placeholder spec.
  // This keeps the server running while allowing docs to be fixed later.
  // Log the error for debugging.
  // eslint-disable-next-line no-console
  console.warn(
    "swagger-jsdoc parse error:",
    err && err.message ? err.message : err,
  );
  specs = {
    openapi: "3.0.0",
    info: {
      title: "ProWallet API (docs disabled due to parse error)",
      version: "0.0.0",
    },
  };
}

export { swaggerUi, specs };
