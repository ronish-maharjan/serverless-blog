import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand
} from "@aws-sdk/client-cognito-identity-provider";

import {
  DynamoDBClient
} from "@aws-sdk/client-dynamodb";

import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
  UpdateCommand
} from "@aws-sdk/lib-dynamodb";

import type {
  APIGatewayProxyHandlerV2
} from "aws-lambda";

import { randomUUID } from "node:crypto";

const dynamodb = DynamoDBDocumentClient.from(
  new DynamoDBClient({})
);

const cognito = new CognitoIdentityProviderClient({});

const tableName = process.env.BLOG_TABLE_NAME;
const clientId = process.env.COGNITO_CLIENT_ID;

if (!tableName) {
  throw new Error("BLOG_TABLE_NAME is missing");
}

if (!clientId) {
  throw new Error("COGNITO_CLIENT_ID is missing");
}

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  published: boolean;
  authorId: string;
  createdAt: string;
  updatedAt: string;
}

interface LoginRequest {
  username: string;
  password: string;
}

interface PostRequest {
  title: string;
  excerpt?: string;
  content: string;
  published?: boolean;
}

function json(
  statusCode: number,
  data: unknown
) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8"
    },
    body: JSON.stringify(data)
  };
}

function parseBody<T>(body: string | undefined): T {
  if (!body) {
    throw new Error("Request body is required");
  }

  return JSON.parse(body) as T;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

interface JwtClaims {
  sub?: string;
}

interface JwtAuthorizer {
  jwt?: {
    claims?: JwtClaims;
  };
}

interface RequestContextWithAuthorizer {
  authorizer?: JwtAuthorizer;
}

function getUserId(
  event: Parameters<APIGatewayProxyHandlerV2>[0]
): string {
  const requestContext =
    event.requestContext as
      typeof event.requestContext &
      RequestContextWithAuthorizer;

  const sub = requestContext.authorizer?.jwt?.claims?.sub;

  if (!sub) {
    throw new Error("Authenticated user is missing");
  }

  return sub;
}

async function login(
  request: LoginRequest
) {
  const result = await cognito.send(
    new InitiateAuthCommand({
      ClientId: clientId,
      AuthFlow: "USER_PASSWORD_AUTH",
      AuthParameters: {
        USERNAME: request.username,
        PASSWORD: request.password
      }
    })
  );

  if (!result.AuthenticationResult?.IdToken) {
    throw new Error(
      "Cognito did not return an ID token"
    );
  }

  return {
    token: result.AuthenticationResult.IdToken,
    expiresIn: result.AuthenticationResult.ExpiresIn
  };
}

async function listPosts() {
  const result = await dynamodb.send(
    new ScanCommand({
      TableName: tableName
    })
  );

  const posts = (result.Items ?? []) as BlogPost[];

  posts.sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );

  return posts;
}

async function getPost(id: string) {
  const result = await dynamodb.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        id
      }
    })
  );

  return result.Item as BlogPost | undefined;
}

async function createPost(
  event: Parameters<APIGatewayProxyHandlerV2>[0]
) {
  const userId = getUserId(event);

  const request = parseBody<PostRequest>(
    event.body
  );

  if (!request.title?.trim()) {
    throw new Error("Title is required");
  }

  if (!request.content?.trim()) {
    throw new Error("Content is required");
  }

  const now = new Date().toISOString();

  const post: BlogPost = {
    id: randomUUID(),
    title: request.title.trim(),
    slug: slugify(request.title),
    excerpt: request.excerpt?.trim() ?? "",
    content: request.content.trim(),
    published: request.published ?? true,
    authorId: userId,
    createdAt: now,
    updatedAt: now
  };

  await dynamodb.send(
    new PutCommand({
      TableName: tableName,
      Item: post
    })
  );

  return post;
}

async function updatePost(
  event: Parameters<APIGatewayProxyHandlerV2>[0],
  id: string
) {
  getUserId(event);

  const request = parseBody<PostRequest>(
    event.body
  );

  if (!request.title?.trim()) {
    throw new Error("Title is required");
  }

  if (!request.content?.trim()) {
    throw new Error("Content is required");
  }

  const now = new Date().toISOString();

  const result = await dynamodb.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { id },
      UpdateExpression:
        "SET #title = :title, #slug = :slug, #excerpt = :excerpt, #content = :content, #published = :published, #updatedAt = :updatedAt",
      ExpressionAttributeNames: {
        "#title": "title",
        "#slug": "slug",
        "#excerpt": "excerpt",
        "#content": "content",
        "#published": "published",
        "#updatedAt": "updatedAt"
      },
      ExpressionAttributeValues: {
        ":title": request.title.trim(),
        ":slug": slugify(request.title),
        ":excerpt": request.excerpt?.trim() ?? "",
        ":content": request.content.trim(),
        ":published": request.published ?? true,
        ":updatedAt": now
      },
      ReturnValues: "ALL_NEW"
    })
  );

  return result.Attributes as BlogPost;
}

async function deletePost(id: string) {
  await dynamodb.send(
    new DeleteCommand({
      TableName: tableName,
      Key: { id }
    })
  );
}

export const handler: APIGatewayProxyHandlerV2 = async (
  event
) => {
  console.log(
    JSON.stringify({
      routeKey: event.routeKey,
      rawPath: event.rawPath,
      requestId: event.requestContext.requestId
    })
  );

  try {
    const routeKey = event.routeKey;

    if (routeKey === "POST /api/auth/login") {
      const request = parseBody<LoginRequest>(
        event.body
      );

      const result = await login(request);

      return json(200, result);
    }

    if (routeKey === "GET /api/posts") {
      const posts = await listPosts();

      return json(200, posts);
    }

    if (routeKey === "GET /api/posts/{id}") {
      const id = event.pathParameters?.id;

      if (!id) {
        return json(400, {
          error: "Post ID is required"
        });
      }

      const post = await getPost(id);

      if (!post) {
        return json(404, {
          error: "Post not found"
        });
      }

      return json(200, post);
    }

    if (routeKey === "POST /api/posts") {
      const post = await createPost(event);

      return json(201, post);
    }

    if (routeKey === "PUT /api/posts/{id}") {
      const id = event.pathParameters?.id;

      if (!id) {
        return json(400, {
          error: "Post ID is required"
        });
      }

      const post = await updatePost(
        event,
        id
      );

      return json(200, post);
    }

    if (routeKey === "DELETE /api/posts/{id}") {
      const id = event.pathParameters?.id;

      if (!id) {
        return json(400, {
          error: "Post ID is required"
        });
      }

      getUserId(event);

      await deletePost(id);

      return json(200, {
        message: "Post deleted"
      });
    }

    return json(404, {
      error: "Route not found"
    });
  } catch (error) {
    console.error("Backend error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Internal server error";

    /*
     * Don't expose implementation details in the real
     * production version. This is intentionally simple
     * for the class project.
     */
    return json(400, {
      error: message
    });
  }
};

