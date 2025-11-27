#!/usr/bin/env node
/**
 * Script para generar embeddings de todas las reglas de auto-respuesta
 *
 * Uso:
 *   node scripts/generate-embeddings.js
 *
 * Requisitos:
 *   - El servicio de embeddings debe estar corriendo (python3 python-services/embedding_service.py)
 *   - Las variables de entorno deben estar configuradas (.env)
 */

import 'dotenv/config';
import mysql from 'mysql2/promise';

const EMBEDDING_SERVICE_URL = 'http://localhost:5001';

// Crear conexión a BD
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'mensajeria',
  waitForConnections: true,
  connectionLimit: 10,
});

/**
 * Verifica si el servicio de embeddings está disponible
 */
async function checkService() {
  try {
    const response = await fetch(`${EMBEDDING_SERVICE_URL}/health`);
    if (!response.ok) return false;
    const data = await response.json();
    console.log(`✅ Servicio de embeddings disponible (modelo: ${data.model})`);
    return true;
  } catch {
    console.error('❌ Servicio de embeddings no disponible en', EMBEDDING_SERVICE_URL);
    console.error('   Inicia el servicio con: python3 python-services/embedding_service.py');
    return false;
  }
}

/**
 * Genera embedding para un texto
 */
async function generateEmbedding(text) {
  const response = await fetch(`${EMBEDDING_SERVICE_URL}/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texts: [text] }),
  });

  if (!response.ok) {
    throw new Error(`Error generating embedding: ${response.statusText}`);
  }

  const data = await response.json();
  return data.embeddings[0];
}

/**
 * Genera embeddings para todas las reglas activas
 */
async function generateAllEmbeddings() {
  console.log('📊 Obteniendo reglas activas...');

  const [rows] = await pool.query(
    'SELECT id, name, trigger_keywords FROM auto_replies WHERE is_active = TRUE'
  );

  const rules = rows;
  console.log(`📝 Encontradas ${rules.length} reglas activas\n`);

  if (rules.length === 0) {
    console.log('⚠️  No hay reglas activas para procesar');
    return 0;
  }

  let updated = 0;
  let failed = 0;

  for (const rule of rules) {
    try {
      process.stdout.write(`⏳ Procesando "${rule.name}"... `);

      const embedding = await generateEmbedding(rule.trigger_keywords);

      await pool.query(
        `UPDATE auto_replies
         SET embedding_vector = ?, embedding_generated_at = NOW()
         WHERE id = ?`,
        [JSON.stringify(embedding), rule.id]
      );

      console.log('✅');
      updated++;

      // Pequeño delay para no saturar el servicio
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (err) {
      console.log(`❌ Error: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n✅ Completado: ${updated} actualizadas, ${failed} fallidas`);
  return updated;
}

/**
 * Verifica configuración
 */
async function checkConfig() {
  console.log('🔍 Verificando configuración...');

  const [rows] = await pool.query(
    `SELECT setting_key, setting_value
     FROM auto_reply_settings
     WHERE setting_key IN ('embedding_service_enabled', 'embedding_service_url', 'embedding_similarity_threshold')`
  );

  const settings = {};
  for (const row of rows) {
    settings[row.setting_key] = row.setting_value;
  }

  console.log('\n⚙️  Configuración actual:');
  console.log(`   Habilitado: ${settings.embedding_service_enabled || 'false'}`);
  console.log(`   URL: ${settings.embedding_service_url || EMBEDDING_SERVICE_URL}`);
  console.log(`   Umbral: ${settings.embedding_similarity_threshold || '0.7'}\n`);

  if (settings.embedding_service_enabled !== 'true') {
    console.log('⚠️  El servicio de embeddings está deshabilitado');
    console.log('   Para habilitarlo:');
    console.log(`   UPDATE auto_reply_settings SET setting_value = 'true' WHERE setting_key = 'embedding_service_enabled';`);
    console.log('');
  }
}

// Ejecutar
async function main() {
  console.log('🚀 Generador de Embeddings para Auto-Respuestas\n');

  try {
    // Verificar servicio
    const serviceOk = await checkService();
    if (!serviceOk) {
      process.exit(1);
    }

    // Verificar configuración
    await checkConfig();

    // Generar embeddings
    const updated = await generateAllEmbeddings();

    await pool.end();

    console.log('\n🎉 Proceso completado exitosamente');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    await pool.end();
    process.exit(1);
  }
}

main();
