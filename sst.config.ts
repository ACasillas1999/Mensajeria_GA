/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "mensajeria-ga",
      removal: input?.stage === "production" ? "retain" : "remove",
      home: "aws",
    };
  },
  async run() {
    // Crear bucket S3 para archivos estáticos
    const bucket = new sst.aws.Bucket("MensajeriaAssets", {
      public: true,
    });

    // Deploy de Astro con Lambda Function URL
    const site = new sst.aws.Astro("MensajeriaSite", {
      path: "./",
      environment: {
        DB_HOST: process.env.DB_HOST || "",
        DB_PORT: process.env.DB_PORT || "3306",
        DB_USER: process.env.DB_USER || "",
        DB_PASS: process.env.DB_PASS || "",
        DB_NAME: process.env.DB_NAME || "",
        WABA_TOKEN: process.env.WABA_TOKEN || "",
        WABA_PHONE_NUMBER_ID: process.env.WABA_PHONE_NUMBER_ID || "",
        WABA_VERSION: process.env.WABA_VERSION || "v20.0",
        WABA_VERIFY_TOKEN: process.env.WABA_VERIFY_TOKEN || "",
        WABA_APP_SECRET: process.env.WABA_APP_SECRET || "",
        JWT_SECRET: process.env.JWT_SECRET || "",
        NODE_ENV: "production",
      },
      domain: {
        name: "gawhats.grupoascencio.com.mx",
        dns: false, // Ya tienes el DNS configurado externamente
      },
    });

    return {
      url: site.url,
      bucket: bucket.name,
    };
  },
});
