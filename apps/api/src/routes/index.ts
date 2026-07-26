import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { Router, Request, Response, NextFunction } from "express";
import "reflect-metadata";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface RouteMetadata {
  method: "get" | "post" | "put" | "patch" | "delete" | "all";
  path: string;
  handlerName: string | symbol;
  middlewares?: any[];
}

interface ControllerMetadata {
  prefix: string;
  middlewares?: any[];
}

interface RouteModule {
  default?: any;
  router?: Router;
  routes?: Router;
  controllers?: any[];
  providers?: any[];
  imports?: any[];
}

interface LoadedRoute {
  mount: string;
  rel: string;
  type: "functional" | "controller" | "module";
  module?: any;
}

// ============================================================================
// METADATA KEYS
// ============================================================================

const CONTROLLER_METADATA = Symbol("controller:metadata");
const ROUTES_METADATA = Symbol("routes:metadata");

// ============================================================================
// DECORATORS
// ============================================================================

/**
 * Marca una clase como controlador con un prefijo de ruta opcional
 * @example @Controller('/users')
 */
export function Controller(prefix: string = ""): ClassDecorator {
  return (target: any) => {
    Reflect.defineMetadata(
      CONTROLLER_METADATA,
      { prefix: prefix.startsWith("/") ? prefix : `/${prefix}` },
      target,
    );
  };
}

/**
 * Crea un decorador de método HTTP
 */
function createMethodDecorator(method: RouteMetadata["method"]) {
  return (path: string = ""): MethodDecorator => {
    return (target: any, propertyKey: string | symbol) => {
      const routes: RouteMetadata[] =
        Reflect.getMetadata(ROUTES_METADATA, target.constructor) || [];

      routes.push({
        method,
        path: path.startsWith("/") ? path : `/${path}`,
        handlerName: propertyKey,
      });

      Reflect.defineMetadata(ROUTES_METADATA, routes, target.constructor);
    };
  };
}

export const Get = createMethodDecorator("get");
export const Post = createMethodDecorator("post");
export const Put = createMethodDecorator("put");
export const Patch = createMethodDecorator("patch");
export const Delete = createMethodDecorator("delete");
export const All = createMethodDecorator("all");

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Normaliza la ruta a estilo POSIX (forward slashes)
 */
function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").replace(/\/+/g, "/");
}

/**
 * Calcula el mount path basado en la ubicación del archivo
 */
function calculateMountPath(routesDir: string, fullPath: string): string {
  const rel = path.relative(routesDir, fullPath);
  const dirName = path.dirname(rel);
  const fileName = path.basename(fullPath);
  const base = fileName.replace(/\.(routes?|controller)\.(ts|js)$/i, "");

  let mount = "";

  if (dirName === ".") {
    // Archivo en el root de routes
    mount = `/${base}`;
  } else {
    const parts = dirName.split(path.sep);
    const lastPart = parts[parts.length - 1];

    // Si el nombre base coincide con el último directorio, usar solo el directorio
    if (base === lastPart) {
      mount = `/${parts.join("/")}`;
    } else {
      mount = `/${parts.join("/")}/${base}`;
    }
  }

  return normalizePath(mount);
}

/**
 * Intenta cargar un módulo usando diferentes estrategias
 */
async function loadModule(filePath: string): Promise<any | null> {
  const candidates = [filePath, filePath.replace(/\.ts$/i, ".js")];

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;

    try {
      // Intenta ESM import
      return await import(pathToFileURL(candidate).href);
    } catch (errImport) {
      try {
        // Fallback a CommonJS require
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        return require(candidate);
      } catch (errRequire) {
        // Continuar con el siguiente candidato
        continue;
      }
    }
  }

  return null;
}

/**
 * Verifica si un objeto es un controlador decorado
 */
function isController(obj: any): boolean {
  if (typeof obj !== "function") return false;
  return Reflect.hasMetadata(CONTROLLER_METADATA, obj);
}

/**
 * Crea un router a partir de un controlador decorado
 */
function createRouterFromController(Controller: any): Router {
  const router = Router();
  const controllerMetadata: ControllerMetadata | undefined =
    Reflect.getMetadata(CONTROLLER_METADATA, Controller);
  const routes: RouteMetadata[] =
    Reflect.getMetadata(ROUTES_METADATA, Controller) || [];

  if (!controllerMetadata) {
    throw new Error(`Controller metadata not found for ${Controller.name}`);
  }

  // Instanciar el controlador
  const instance = new Controller();

  // Registrar cada ruta
  for (const route of routes) {
    const handler = instance[route.handlerName];

    if (typeof handler !== "function") {
      console.warn(
        `[Router] Handler ${String(route.handlerName)} is not a function in ${Controller.name}`,
      );
      continue;
    }

    // Bind del handler a la instancia
    const boundHandler = handler.bind(instance);

    // Wrapper para manejar promises y errores
    const asyncHandler = (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(boundHandler(req, res, next)).catch(next);
    };

    // Registrar la ruta
    const routePath = route.path === "/" ? "" : route.path;
    router[route.method](routePath, asyncHandler);

    console.log(
      `  └─ ${route.method.toUpperCase().padEnd(6)} ${controllerMetadata.prefix}${routePath} -> ${Controller.name}.${String(route.handlerName)}`,
    );
  }

  return router;
}

/**
 * Procesa un módulo que puede contener controladores, routers funcionales, etc.
 */
function processModule(mod: RouteModule, moduleName: string): Router | null {
  const router = Router();
  let hasRoutes = false;

  // 1. Si exporta controladores (estilo NestJS)
  if (Array.isArray(mod.controllers)) {
    for (const Controller of mod.controllers) {
      if (isController(Controller)) {
        const controllerMetadata: ControllerMetadata = Reflect.getMetadata(
          CONTROLLER_METADATA,
          Controller,
        );
        const controllerRouter = createRouterFromController(Controller);
        router.use(controllerMetadata.prefix, controllerRouter);
        hasRoutes = true;
      }
    }
  }

  // 2. Si el export default es un controlador
  if (isController(mod.default)) {
    const controllerMetadata: ControllerMetadata = Reflect.getMetadata(
      CONTROLLER_METADATA,
      mod.default,
    );
    const controllerRouter = createRouterFromController(mod.default);
    router.use(controllerMetadata.prefix || "", controllerRouter);
    hasRoutes = true;
  }

  // 3. Si exporta un router funcional tradicional
  const functionalRouter = mod.default || mod.router || mod.routes;

  if (
    !hasRoutes &&
    functionalRouter &&
    typeof functionalRouter === "function"
  ) {
    return functionalRouter;
  }

  return hasRoutes ? router : null;
}

// ============================================================================
// MAIN ROUTER BUILDER
// ============================================================================

export interface AppRouterOptions {
  /** Directorio base de las rutas (por defecto: __dirname) */
  routesDir?: string;
  /** Patrones de archivos a procesar */
  patterns?: RegExp[];
  /** Mostrar logs detallados */
  verbose?: boolean;
  /** Prefijo global para todas las rutas */
  globalPrefix?: string;
}

/**
 * Construye el router principal escaneando recursivamente la carpeta de rutas
 * Soporta tanto routers funcionales como controladores decorados estilo NestJS
 */
export async function buildAppRouter(
  options: AppRouterOptions = {},
): Promise<Router> {
  const {
    routesDir = __dirname,
    patterns = [
      /\.routes?\.(ts|js)$/,
      /\.controller\.(ts|js)$/,
      /\.module\.(ts|js)$/,
    ],
    verbose = true,
    globalPrefix = "",
  } = options;

  const router = Router();
  const loadedRoutes: LoadedRoute[] = [];

  async function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }

      // Ignorar archivos index
      if (/index\.(routes?|controller|module)?\.(ts|js)$/i.test(entry.name)) {
        continue;
      }

      // Verificar si coincide con algún patrón
      const matchesPattern = patterns.some((pattern) =>
        pattern.test(entry.name),
      );

      if (!matchesPattern) continue;

      const rel = path.relative(routesDir, fullPath);
      const mount = calculateMountPath(routesDir, fullPath);

      try {
        const loaded = await loadModule(fullPath);

        if (!loaded) {
          console.error(
            `[Router] Failed to load module: ${rel} (no valid export found)`,
          );
          continue;
        }

        const processedRouter = processModule(loaded, entry.name);

        if (processedRouter) {
          const finalMount = globalPrefix
            ? normalizePath(`${globalPrefix}${mount}`)
            : mount;

          router.use(finalMount, processedRouter);

          loadedRoutes.push({
            mount: finalMount,
            rel,
            type: isController(loaded.default) ? "controller" : "functional",
            module: loaded,
          });

          if (verbose) {
            console.log(`[Router] ✓ Mounted ${finalMount} <- ${rel}`);
          }
        } else {
          console.warn(
            `[Router] Module loaded but no valid router or controller found: ${rel}`,
          );
        }
      } catch (err) {
        console.error(`[Router] Error processing ${rel}:`, err);
      }
    }
  }

  console.log("\n[Router] Starting route discovery...\n");
  await walk(routesDir);

  if (verbose) {
    console.log(`\n[Router] ✓ Loaded ${loadedRoutes.length} route modules\n`);
  }

  return router;
}

export default buildAppRouter;
