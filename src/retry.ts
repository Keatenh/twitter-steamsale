import { AxiosError } from "axios";

/**
 * Type defining the OnRetryEventParameter calls in the library.
 * @param event Event from RETRY_EVENTS
 * @param retryCount the retry attempt
 * @param e an HttpRetryError or Error
 * Use this type when passing in a hanlder for retry events in the libraries exposed methods.
 */
export type OnRetryEvent = (
  event: string,
  retryCount: number,
  e: HttpRetryError | Error
) => void;

/**
 * Class HttpRetryError that extends Error
 */
export class HttpRetryError extends Error {
  public httpStatus: number;
  public httpStatusText: string;
  public responseData: any;
  public headers: any;
  /**
   * Constructor for the HttpRetryError
   * extends Error
   * @param message Error message
   * @param httpStatus the HTTP status of the error
   * @param httpStatusText the HTTP status text
   * @param responseData the HTTP Response data
   * @param headers the HTTP response headers
   */
  public constructor(
    message: string,
    httpStatus: number,
    httpStatusText: string,
    responseData: any,
    headers: any
  ) {
    super(message);
    Object.setPrototypeOf(this, HttpRetryError.prototype);
    this.httpStatus = httpStatus;
    this.httpStatusText = httpStatusText;
    this.responseData = responseData;
    this.headers = headers;
  }
}

/**
 * A function that creates an HttpRetryError from an Axios Error
 * Meant for internal use with [[httpPostWithRetry]] and [[httpGetWithRetry]]
 * @param e Axios Error
 */
export function createHttpRetryError(e: AxiosError): HttpRetryError {
  return new HttpRetryError(
    e.message,
    e.response?.status || 0,
    e.response?.statusText || "undefined error response in AxiosError",
    e.response?.data,
    e.response?.headers
  );
}

/**
 * Function that distinguishes an Error from an AxiosError
 * @param e any
 */
export function isAxiosError(e: Error | AxiosError): e is AxiosError {
  return (e as AxiosError).response !== undefined;
}

/**
 * Function that determines if the error from the http request is retryable
 * Meant for internal use with [[httpPostWithRetry]]
 * @param e Error
 */
export function httpTestRetryable(e: AxiosError): boolean {
  if (e.response && e.response.status > 399 && e.response.status < 500) {
    return false;
  }
  return true;
}

export const RETRY_EVENTS = {
  RETRY_BAIL: "RETRY_BAIL",
  RETRY_CONTINUE: "RETRY_CONTINUE",
};

/**
 * Function that handles the HTTP error to allow retry (throw) or proceed without retry (bail)
 * Meant for internal use with [[httpPostWithRetry]] and [[httpGetWithRetry]]
 * @param e Error
 * @param bail Function to call instead of throwing error
 * @param retryCount Current count of attempts, tracked by async-retry method
 * @param onRetryEvent function to inject functionality on retry events
 *
 */
export function httpHandleError(
  e: Error,
  bail: any,
  retryCount: number,
  onRetryEvent: OnRetryEvent
): void {
  let axiosErr: AxiosError | Error = e;
  if (isAxiosError(e)) {
    axiosErr = e;
    if (!httpTestRetryable(e)) {
      onRetryEvent(
        RETRY_EVENTS.RETRY_BAIL,
        retryCount,
        createHttpRetryError(e)
      );
      bail(e);
    } else {
      onRetryEvent(
        RETRY_EVENTS.RETRY_CONTINUE,
        retryCount,
        createHttpRetryError(e)
      );
      throw e;
    }
  } else {
    onRetryEvent(RETRY_EVENTS.RETRY_CONTINUE, retryCount, axiosErr);
    throw e;
  }
}
