import { HTTPException } from "hono/http-exception";

export type ErrorCode =
  | "SOURCE_NOT_FOUND"
  | "SOURCE_EXISTS"
  | "EXCHANGE_NOT_FOUND"
  | "SERVICE_NOT_FOUND"
  | "NOT_REPLAYABLE"
  | "INVALID_SIGNATURE";

export function fail(status: 400 | 401 | 404 | 409, code: ErrorCode) {
  return new HTTPException(status, {
    res: Response.json({ code }, { status }),
  });
}
