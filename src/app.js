const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const hpp = require('hpp');
const swaggerUi = require('swagger-ui-express');
const config = require('./config/env');
const openapi = require('./docs/openapi');
const routes = require('./routes');
const { globalLimiter } = require('./middleware/rateLimiters');
const {
  requestId,
  requireJson,
  sanitizeBody,
  rejectSqlInjection,
  enforceCorsWhitelist,
} = require('./middleware/security');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();

if (config.trustProxy) {
  app.set('trust proxy', 1);
}

app.disable('x-powered-by');
app.set('json escape', true);

app.use(helmet({
  frameguard: { action: 'deny' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
    },
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(requestId);
app.use(enforceCorsWhitelist);
app.use(cors({
  origin(origin, callback) {
    if (!origin || config.corsOrigins.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
}));
app.use(cookieParser());
app.use(requireJson);
app.use(express.json({ limit: config.bodyLimit }));
app.use(sanitizeBody);
app.use(hpp());
app.use(rejectSqlInjection);
app.use(globalLimiter);

app.get('/health', (_req, res) => {
  res.json({ data: { status: 'ok' } });
});

app.get('/api-docs.json', (_req, res) => {
  res.json(openapi);
});
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapi, { customSiteTitle: 'WMS API' }));

app.use(routes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
