import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import logger from "@uns-kit/core/logger.js";

type JwtPayloadWithEmail = {
  email?: unknown;
};

const resolveUser = (req: Request): string => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return "Anonymous";
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.decode(token) as JwtPayloadWithEmail | null;
    if (decoded?.email && typeof decoded.email === "string") {
      return decoded.email;
    }
    return "Unknown";
  } catch {
    return "Unknown";
  }
};

export const logRequestContext = (req: Request, _res: Response, next: NextFunction): void => {
  logger.info({
    timestamp: new Date().toISOString(),
    user: resolveUser(req),
    endpoint: `${req.method} ${req.originalUrl || req.url}`,
    message: "Request received",
  });
  next();
};
