import { ConfigDirectorLogger } from "./types";

export const fetchWithTimeout = async (
  timeout: number,
  resource: string | URL | Request,
  options: RequestInit | undefined,
  logger: ConfigDirectorLogger,
) => {
  const abortController = new AbortController();
  const abortTimeoutId = setTimeout(() => {
    logger.debug("[fetchWithTimeout] Reached timeout, aborting request");
    abortController.abort();
  }, timeout);

  try {
    const response = await fetch(resource, {
      ...options,
      signal: abortController.signal,
    });
    clearTimeout(abortTimeoutId);
    return response;
  } catch (error) {
    logger.warn("[fetchWithTimeout] Fetch error: ", error);
    clearTimeout(abortTimeoutId);
    throw error;
  }
};
