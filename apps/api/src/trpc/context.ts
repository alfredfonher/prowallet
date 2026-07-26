import { Request, Response } from "express";

export type TrpcContext = {
  req: Request;
  res: Response;
};

export function createContext({
  req,
  res,
}: {
  req: Request;
  res: Response;
}): TrpcContext {
  return { req, res };
}

export default createContext;
