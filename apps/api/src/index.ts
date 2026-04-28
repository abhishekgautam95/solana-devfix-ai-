import express, { type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { scanGithubRepository, ScannerError } from "@solana-devfix-ai/scanner";
import { ScanRequestSchema } from "@solana-devfix-ai/shared";

const app = express();
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "127.0.0.1";
const scanTimeoutMs = Number(process.env.SCAN_TIMEOUT_MS ?? 120_000);

app.use(express.json({ limit: "64kb" }));

app.get("/health", (_request: Request, response: Response) => {
  response.json({ status: "ok" });
});

app.post("/scan", async (request: Request, response: Response, next: NextFunction) => {
  try {
    const body = ScanRequestSchema.parse(request.body);
    const report = await scanGithubRepository(body.repoUrl, { timeoutMs: scanTimeoutMs });

    response.json(report);
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  if (error instanceof z.ZodError) {
    response.status(400).json({
      error: "Invalid request body",
      details: error.flatten()
    });
    return;
  }

  if (error instanceof ScannerError) {
    response.status(error.statusCode).json({
      error: error.message
    });
    return;
  }

  response.status(500).json({
    error: "Unexpected scanner error"
  });
});

app.listen(port, host, () => {
  console.log(`Solana DevFix AI API listening at http://${host}:${port}`);
});
