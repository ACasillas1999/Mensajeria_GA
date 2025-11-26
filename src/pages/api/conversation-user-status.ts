// src/pages/api/conversation-user-status.ts
import type { APIRoute } from "astro";
import { z } from "zod";
import { pool } from "../../lib/db";

const bodySchema = z.object({
  conversacion_id: z.number().int().positive(),
  action: z.enum(["archive", "unarchive", "favorite", "unfavorite"]),
});

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const user = (locals as any).user as { id: number } | undefined;
    if (!user) {
      return new Response(
        JSON.stringify({ ok: false, error: "No autenticado" }),
        { status: 401 }
      );
    }

    const raw = await request.json();
    const { conversacion_id, action } = bodySchema.parse(raw);

    // Determinar qué campo actualizar
    let updateField: string;
    let newValue: boolean;

    switch (action) {
      case "archive":
        updateField = "is_archived";
        newValue = true;
        break;
      case "unarchive":
        updateField = "is_archived";
        newValue = false;
        break;
      case "favorite":
        updateField = "is_favorite";
        newValue = true;
        break;
      case "unfavorite":
        updateField = "is_favorite";
        newValue = false;
        break;
    }

    // Insertar o actualizar el estado
    await pool.query(
      `INSERT INTO conversation_user_status (conversacion_id, usuario_id, ${updateField})
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE ${updateField} = VALUES(${updateField})`,
      [conversacion_id, user.id, newValue]
    );

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200 }
    );
  } catch (err: any) {
    if (err?.issues) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: err.issues.map((i: any) => i.message).join(" | "),
        }),
        { status: 400 }
      );
    }
    console.error("CONVERSATION STATUS ERROR:", err?.message || err);
    return new Response(
      JSON.stringify({ ok: false, error: err?.message || "Error" }),
      { status: 500 }
    );
  }
};
