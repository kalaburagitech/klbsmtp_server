const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Email SaaS API",
      version: "1.0.0",
      description: "Multi-tenant email automation SaaS API"
    },
    servers: [{ url: "https://klbsmtp.kalaburagitech.com/api/v1" }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        apiKeyAuth: { type: "apiKey", in: "header", name: "x-api-key" }
      },
      schemas: {
        AdminLoginRequest: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string" }
          }
        },
        Organization: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            apiKey: { type: "string" },
            dailyLimit: { type: "integer" },
            status: { type: "string", enum: ["active", "inactive"] }
          }
        },
        SendEmailRequest: {
          type: "object",
          properties: {
            to: { type: "string", format: "email" },
            subject: { type: "string" },
            html: { type: "string" },
            attachments: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  filename: { type: "string" },
                  content: { type: "string" },
                  encoding: { type: "string", example: "base64" },
                  contentType: { type: "string" }
                }
              }
            },
            emails: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  to: { type: "string", format: "email" },
                  subject: { type: "string" },
                  html: { type: "string" },
                  attachments: { type: "array", items: { type: "object" } }
                }
              }
            }
          }
        }
      }
    }
  },
  apis: ["./src/modules/**/*.js"]
};

const specs = swaggerJsdoc(options);

function mountSwagger(app) {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs));
}

module.exports = mountSwagger;
