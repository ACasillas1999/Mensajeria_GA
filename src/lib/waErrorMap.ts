type WaErrorPayload = {
  code?: number;
  title?: string;
  message?: string;
  error_data?: any;
};

// Fuente: https://developers.facebook.com/documentation/business-messaging/whatsapp/support/error-codes
const WA_ERROR_MAP: Record<number, string> = {
  131000: "Parámetro inválido o con formato incorrecto",
  131009: "Fuera de ventana de 24h: se requiere plantilla",
  131012: "Número no válido o no habilitado para WhatsApp",
  131026: "Carga de media inválida o no soportada",
  131042: "Límite de envío alcanzado / rate limit: intenta más tarde",
  131047: "Plantilla no encontrada",
  131048: "Plantilla no aprobada",
  131049: "Parámetros de plantilla no coinciden (nombre/idioma/vars/botones)",
  131050: "No se puede reactivar con esta plantilla o categoría incorrecta",
  131051: "El destinatario bloqueó o no acepta mensajes",
};

export function mapWaError(err: WaErrorPayload | undefined) {
  const code = err?.code;
  const friendly = code ? WA_ERROR_MAP[code] : undefined;
  return {
    code,
    title: err?.title,
    message: err?.message,
    details: err?.error_data,
    friendly,
  };
}
