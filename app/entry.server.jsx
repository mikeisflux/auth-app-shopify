import { PassThrough } from "node:stream";
import { Response } from "@remix-run/node";
import { RemixServer } from "@remix-run/react";
import isbot from "isbot";
import { renderToPipeableStream } from "react-dom/server";

const ABORT_DELAY = 5000;

export default function handleRequest(request, statusCode, headers, context) {
  if (isbot(request.headers.get("user-agent"))) {
    return handleBotRequest(request, statusCode, headers, context);
  }

  return handleBrowserRequest(request, statusCode, headers, context);
}

function handleBotRequest(request, statusCode, headers, context) {
  return new Promise((resolve, reject) => {
    let didError = false;

    const { pipe, abort } = renderToPipeableStream(
      <RemixServer context={context} url={request.url} abortDelay={ABORT_DELAY} />,
      {
        onAllReady() {
          const body = new PassThrough();

          headers.set("Content-Type", "text/html");
          resolve(new Response(body, { status: didError ? 500 : statusCode, headers }));
          pipe(body);
        },
        onShellError(error) {
          reject(error);
        },
        onError(error) {
          didError = true;
          console.error(error);
        }
      }
    );

    setTimeout(abort, ABORT_DELAY);
  });
}

function handleBrowserRequest(request, statusCode, headers, context) {
  return new Promise((resolve, reject) => {
    let didError = false;

    const { pipe, abort } = renderToPipeableStream(
      <RemixServer context={context} url={request.url} abortDelay={ABORT_DELAY} />,
      {
        onShellReady() {
          const body = new PassThrough();

          headers.set("Content-Type", "text/html");
          resolve(new Response(body, { status: didError ? 500 : statusCode, headers }));
          pipe(body);
        },
        onShellError(error) {
          reject(error);
        },
        onError(error) {
          didError = true;
          console.error(error);
        }
      }
    );

    setTimeout(abort, ABORT_DELAY);
  });
}
