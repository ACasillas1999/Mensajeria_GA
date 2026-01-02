// src/lib/db.ts
import "dotenv/config";
import mysql from "mysql2/promise";

export const pool = mysql.createPool({
  host: process.env.DB_HOST!,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER!,
  password: process.env.DB_PASS!,
  database: process.env.DB_NAME!,
  connectionLimit: 50, // Aumentado de 10 a 50 para soportar más usuarios simultáneos
  charset: "utf8mb4",
  timezone: '-06:00', // Zona horaria CST (México)
  waitForConnections: true,
  queueLimit: 100, // Limitar cola a 100 (antes 0 = infinito, causaba delays de 55s)
  connectTimeout: 10000, // 10 segundos timeout para conectar
  acquireTimeout: 10000, // 10 segundos timeout para adquirir conexión del pool
  timeout: 60000, // 60 segundos timeout para queries
});
