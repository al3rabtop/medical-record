import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerAuthRoutes } from "./auth";
import { registerAdminImportRoute } from "./adminImport";
import { registerAdminBootstrapRoute } from "./adminBootstrap";
import { registerExtractRoute } from "./extract";
import { registerCanonicalizeRoute } from "./canonicalize";
import { registerFixAbbrRoute } from "./fixAbbr";
import { registerDocumentRoutes } from "./documentRoutes";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerAuthRoutes(app);
  registerAdminImportRoute(app);
  registerAdminBootstrapRoute(app);
  registerExtractRoute(app);
  registerCanonicalizeRoute(app);
  registerFixAbbrRoute(app);
  registerDocumentRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || "8080", 10);
  const portSource = process.env.PORT ? "process.env.PORT" : "fallback default";

  server.listen(port, "0.0.0.0", () => {
    console.log(
      `Server running on http://0.0.0.0:${port}/ (port source: ${portSource})`
    );
  });
}

startServer().catch(console.error);
