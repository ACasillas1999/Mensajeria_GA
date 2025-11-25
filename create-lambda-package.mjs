import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

async function createLambdaPackage() {
  console.log('📦 Creando paquete para Lambda...\n');

  try {
    // Crear directorios
    await fs.mkdir('lambda-package', { recursive: true });
    await fs.mkdir('s3-assets', { recursive: true });

    console.log('📁 Separando assets estáticos para S3...');

    // Copiar solo assets estáticos a s3-assets
    try {
      await execAsync('xcopy dist\\client s3-assets\\ /E /I /Y');
      console.log('✅ Assets copiados a s3-assets/ (subir a S3)');
    } catch (err) {
      console.log('⚠️ No hay carpeta client, continuando...');
    }

    console.log('\n📁 Preparando Lambda package...');

    // Copiar solo el servidor a lambda-package
    await execAsync('xcopy dist\\server lambda-package\\dist\\server\\ /E /I /Y');

    // Copiar handler
    await fs.copyFile('lambda-handler.mjs', 'lambda-package/lambda-handler.mjs');

    // Copiar package.json para Lambda
    await fs.copyFile('package-lambda.json', 'lambda-package/package.json');

    // Instalar solo dependencias de producción
    console.log('📦 Instalando solo dependencias de producción...');
    console.log('⏳ Esto puede tardar varios minutos...');

    try {
      // Cambiar al directorio lambda-package e instalar
      await execAsync('cd lambda-package && npm install --omit=dev --no-audit --no-fund', {
        maxBuffer: 1024 * 1024 * 100,
        cwd: process.cwd()
      });
      console.log('✅ Dependencias de producción instaladas');
    } catch (err) {
      console.error('Error instalando dependencias:', err.message);
      throw err;
    }

    console.log('\n✅ Paquetes creados:\n');
    console.log('📦 lambda-package/ - Código del servidor');
    console.log('📦 s3-assets/ - Assets estáticos\n');
    console.log('📝 Próximos pasos:');
    console.log('\n1️⃣ Subir assets a S3:');
    console.log('   - Ve a S3 bucket: grupo-ascencio-messaging-app');
    console.log('   - Sube todo el contenido de s3-assets/');
    console.log('   - Haz el bucket público para lectura\n');
    console.log('2️⃣ Preparar Lambda:');
    console.log('   - Lambda ya tiene node_modules en el servidor');
    console.log('   - Solo necesitas actualizar el código\n');
    console.log('3️⃣ Comprimir lambda-package:');
    console.log('   - Comprimir SOLO el contenido de lambda-package/ en un ZIP');
    console.log('   - Nombre: mensajeria-lambda.zip\n');
    console.log('4️⃣ Subir a Lambda:');
    console.log('   - Ve a Lambda "messaging-app"');
    console.log('   - Cargar desde .zip file');
    console.log('   - Configurar handler: lambda-handler.handler\n');
    console.log('5️⃣ Variables de entorno:');
    console.log('   - Agregar WABA_APP_SECRET si falta');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

createLambdaPackage();
