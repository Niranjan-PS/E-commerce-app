import express from 'express';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import dotenv from 'dotenv';
dotenv.config();
import passport from './passport.js';
import userRoutes from "./routes/userRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import { errorMiddleware } from './middlewares/error.js';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
app.use(cookieParser());
app.use(express.json());


app.use(session({
  secret: process.env.JWT_SECRET_KEY || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));


// Enhanced global cache control middleware
app.use((req, res, next) => {
  // Comprehensive cache prevention
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, private, max-age=0");
  res.set("Pragma", "no-cache");
  res.set("Expires", "-1");
  res.setHeader('Surrogate-Control', 'no-store');
  res.setHeader('Vary', 'User-Agent, Accept-Encoding');
  res.setHeader('Last-Modified', new Date().toUTCString());
  res.setHeader('ETag', '');

  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  next();
});

app.use(express.urlencoded({ extended: true }));
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(passport.initialize());
app.use(passport.session());
app.set("view engine", "ejs");

app.set('views', [
  path.join(__dirname, 'views'),
  path.join(__dirname, 'views/user'),
  path.join(__dirname, 'views/admin')
]);

app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  lastModified: false,
  setHeaders: (res, path) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
}));

app.use((req, res, next) => {
  console.log("Incoming request body:", req.body);
  next();
});

app.use("/", userRoutes);
app.use('/api/v1/user', userRoutes);
app.use('/admin', adminRoutes);

console.log("SMTP Email:", process.env.SMTP_MAIL);
console.log("SMTP Password:", process.env.SMTP_PASSWORD);


app.use((err, req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  errorMiddleware(err, req, res, next);
});

export { app };