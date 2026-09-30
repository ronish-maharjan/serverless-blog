import {
  GetObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";

import type {
  APIGatewayProxyResultV2,
  Handler
} from "aws-lambda";

const s3 = new S3Client({});

const bucket = process.env.FRONTEND_BUCKET;

if (!bucket) {
  throw new Error("FRONTEND_BUCKET environment variable is missing");
}

const contentTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

function getContentType(key: string): string {
  const dot = key.lastIndexOf(".");

  if (dot === -1) {
    return "application/octet-stream";
  }

  const extension = key.slice(dot).toLowerCase();

  return contentTypes[extension] ?? "application/octet-stream";
}

function getObjectKey(rawPath: string): string {
  if (rawPath === "/" || rawPath === "") {
    return "index.html";
  }

  const decoded = decodeURIComponent(rawPath);

  const key = decoded.replace(/^\/+/, "");

  if (key.includes("..")) {
    throw new Error("Invalid path");
  }

  return key;
}

async function getFile(key: string) {
  const result = await s3.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key
    })
  );

  if (!result.Body) {
    throw new Error("S3 object has no body");
  }

  const bytes = await result.Body.transformToByteArray();

  return {
    bytes,
    contentType: result.ContentType ?? getContentType(key)
  };
}

export const handler: Handler = async (
  event
): Promise<APIGatewayProxyResultV2> => {
  const rawPath = event.rawPath || "/";

  console.log("Frontend request:", rawPath);

  // An unknown /api/... route should not accidentally return index.html.
  if (rawPath.startsWith("/api/")) {
    return {
      statusCode: 404,
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        error: "API route not found"
      })
    };
  }

  let key: string;

  try {
    key = getObjectKey(rawPath);
  } catch {
    return {
      statusCode: 400,
      headers: {
        "content-type": "text/plain"
      },
      body: "Bad request"
    };
  }

  try {
    const file = await getFile(key);

    return {
      statusCode: 200,
      headers: {
        "content-type": file.contentType,
        "cache-control": "no-cache"
      },
      isBase64Encoded: true,
      body: Buffer.from(file.bytes).toString("base64")
    };
  } catch (error) {
    console.error("S3 read failed:", error);

    /*
     * For routes such as:
     *
     * /blog
     * /projects/my-project
     *
     * a frontend SPA may want index.html as the fallback.
     *
     * We only do this for extensionless paths.
     */
    if (!key.includes(".")) {
      try {
        const fallback = await getFile("index.html");

        return {
          statusCode: 200,
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-cache"
          },
          isBase64Encoded: true,
          body: Buffer.from(fallback.bytes).toString("base64")
        };
      } catch {
        console.error("index.html fallback failed");
      }
    }

    return {
      statusCode: 404,
      headers: {
        "content-type": "text/plain; charset=utf-8"
      },
      body: "Not Found"
    };
  }
};
