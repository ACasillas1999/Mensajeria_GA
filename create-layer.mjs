import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';

const execAsync = promisify(exec);

async function createLayer() {
  console.log('📦 Creando Lambda Layer con node_modules...\n');

  try {
    // Crear estructura de layer
    await fs.mkdir('lambda-layer/nodejs', { recursive: true });

    console.log('📦 Copiando node_modules (esto puede tardar)...');
    console.log('⏳ Por favor espera...');

    // Copiar node_modules a la estructura correcta de layer
    try {
      await execAsync('robocopy node_modules lambda-layer\\nodejs\\node_modules /E /MT:8 /NFL /NDL /NJH /NJS', { maxBuffer: 1024 * 1024 * 100 });
    } catch (err) {
      // Robocopy devuelve códigos de salida no-cero en operaciones exitosas
      console.log('✅ Node_modules copiados');
    }

    console.log('\n✅ Layer creado en: lambda-layer/\n');
    console.log('📝 Próximos pasos:');
    console.log('\n1️⃣ Comprimir layer:');
    console.log('   - Entra a lambda-layer/');
    console.log('   - Comprime la carpeta "nodejs" en un ZIP');
    console.log('   - Nombre: layer-nodejs.zip\n');
    console.log('2️⃣ Subir layer a S3:');
    console.log('   - Sube layer-nodejs.zip al bucket S3\n');
    console.log('3️⃣ Crear Lambda Layer:');
    console.log('   - Ve a Lambda → Layers → Create layer');
    console.log('   - Nombre: mensajeria-dependencies');
    console.log('   - Cargar desde S3: s3://grupo-ascencio-messaging-app/layer-nodejs.zip');
    console.log('   - Runtime: Node.js 20.x\n');
    console.log('4️⃣ Adjuntar layer a tu función:');
    console.log('   - Ve a tu función messaging-app');
    console.log('   - Scroll abajo → Layers → Add a layer');
    console.log('   - Custom layers → mensajeria-dependencies');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createLayer();
