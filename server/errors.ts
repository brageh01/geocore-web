import "server-only";

/**
 * A required environment variable is absent. Thrown lazily at the point of
 * use rather than at module load, so a missing key fails the one request that
 * needs it instead of the whole build.
 */
export class MissingEnvError extends Error {
  readonly variable: string;

  constructor(variable: string) {
    super(
      `${variable} is not set. Add it to .env.local — see .env.example for what it is and where to get it.`
    );
    this.name = "MissingEnvError";
    this.variable = variable;
  }
}

/**
 * An upstream provider returned a non-OK status, timed out, or was otherwise
 * unusable. `status` is the HTTP status the API route should surface.
 */
export class UpstreamError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "UpstreamError";
    this.status = status;
  }
}
