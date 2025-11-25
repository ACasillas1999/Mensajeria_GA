import { handler as astroMiddleware } from './dist/server/entry.mjs';

export const handler = async (event, context) => {
  try {
    console.log('Lambda event received');

    // Validar event
    if (!event) {
      throw new Error('Event is undefined or null');
    }

    // Construir URL
    const headers = event.headers || {};
    const host = headers.host || event.requestContext?.domainName || 'localhost';
    const protocol = headers['x-forwarded-proto'] || 'https';
    const path = event.rawPath || event.path || '/';
    const queryString = event.rawQueryString || '';
    const url = `${protocol}://${host}${path}${queryString ? '?' + queryString : ''}`;

    console.log('URL:', url);

    // Crear Request
    const request = new Request(url, {
      method: event.requestContext?.http?.method || 'GET',
      headers: new Headers(headers),
      body: event.body ? (event.isBase64Encoded ? Buffer.from(event.body, 'base64') : event.body) : undefined,
    });

    // Llamar middleware de Astro
    const response = await astroMiddleware(request);

    // Convertir a formato Lambda
    const responseHeaders = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    const body = await response.text();

    return {
      statusCode: response.status,
      headers: responseHeaders,
      body: body,
      isBase64Encoded: false,
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
      headers: { 'Content-Type': 'application/json' },
    };
  }
};
