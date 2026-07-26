import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { StatusFlow, StatusFlowCodes } from "status-flow";
import { loggerService } from "../../services/logging/logger.service";
import { transferController } from "../../controllers/admin/transfer.controller";

const router: Router = Router();
const DATA_PATH = path.resolve(__dirname, "../../data/admin-metadata.json");

function readMetadata(): Record<string, any> {
  try {
    const raw = fs.readFileSync(DATA_PATH, "utf8");
    return JSON.parse(raw || "{}");
  } catch (e) {
    loggerService.logError(e as Error, {
      endpoint: "/admin/metadata",
      note: "readMetadata failed",
    });
    return {};
  }
}

function writeMetadata(data: Record<string, any>) {
  try {
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf8");
  } catch (e) {
    loggerService.logError(e as Error, {
      endpoint: "/admin/metadata",
      note: "writeMetadata failed",
    });
  }
}

/**
 * @swagger
 * /admin/metadata:
 *   get:
 *     summary: Listar todas las claves de metadatos
 *     description: Devuelve todos los metadatos administrativos almacenados
 *     tags: [Admin]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Metadatos listados exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                 requestId:
 *                   type: string
 *                 timestamp:
 *                   type: string
 */
router.get("/", (req: Request, res: Response) => {
  const requestId = (req as any).requestId || loggerService.generateRequestId();
  const data = readMetadata();
  res.json(
    StatusFlow({
      code: StatusFlowCodes.OK,
      lang: "es",
      extra: data,
    }),
  );
});

/**
 * @swagger
 * /admin/metadata/{key}:
 *   get:
 *     summary: Obtener un metadato específico
 *     description: Devuelve el valor de una clave de metadato administrativa
 *     tags: [Admin]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *         description: Clave del metadato
 *     responses:
 *       200:
 *         description: Valor del metadato obtenido exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                 requestId:
 *                   type: string
 *                 timestamp:
 *                   type: string
 */
router.get("/:key", (req: Request, res: Response) => {
  const requestId = (req as any).requestId || loggerService.generateRequestId();
  const { key } = req.params;
  const data = readMetadata();
  res.json(
    StatusFlow({
      code: StatusFlowCodes.OK,
      lang: "es",
      extra: data[key],
    }),
  );
});

/**
 * @swagger
 * /admin/metadata/{key}:
 *   put:
 *     summary: Actualizar un metadato
 *     description: Actualiza o crea el valor de una clave de metadato administrativa
 *     tags: [Admin]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *         description: Clave del metadato
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Objeto JSON con el valor a guardar
 *     responses:
 *       200:
 *         description: Metadato actualizado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                 requestId:
 *                   type: string
 *                 timestamp:
 *                   type: string
 */
router.put("/:key", (req: Request, res: Response) => {
  const requestId = (req as any).requestId || loggerService.generateRequestId();
  const { key } = req.params;
  const payload = req.body;
  const data = readMetadata();
  data[key] = payload;
  writeMetadata(data);
  res.json(
    StatusFlow({
      code: StatusFlowCodes.OK,
      lang: "es",
      extra: data[key],
    }),
  );
});

export default router;

// Mount transfer route
router.post(
  "/transfer/to-test",
  transferController.transferToTest.bind(transferController),
);
