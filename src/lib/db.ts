// src/lib/db.ts
import "dotenv/config";
import mysql from "mysql2/promise";

export const pool = mysql.createPool({
  host: process.env.DB_HOST!,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER!,
  password: process.env.DB_PASS!,
  database: process.env.DB_NAME!,
  connectionLimit: 10,
  charset: "utf8mb4", // <-- usa charset; el _general_ci es collation
  waitForConnections: true,
});
