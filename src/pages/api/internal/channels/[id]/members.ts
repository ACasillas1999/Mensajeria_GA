import type { APIRoute } from "astro";
import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../../../../../lib/db";

// POST /api/internal/channels/:id/members - Add members to channel
export const POST: APIRoute = async ({ locals, params, request }) => {
    try {
        const user = (locals as any).user as { id: number; rol?: string } | undefined;
        if (!user) {
            return new Response(
                JSON.stringify({ ok: false, error: "No autenticado" }),
                { status: 401, headers: { "Content-Type": "application/json" } },
            );
        }

        const channelId = Number(params.id);
        if (!channelId || isNaN(channelId)) {
            return new Response(
                JSON.stringify({ ok: false, error: "ID de canal inválido" }),
                { status: 400, headers: { "Content-Type": "application/json" } },
            );
        }

        const body = await request.json();
        const { user_ids } = body;

        if (!Array.isArray(user_ids) || user_ids.length === 0) {
            return new Response(
                JSON.stringify({ ok: false, error: "Debe proporcionar al menos un usuario" }),
                { status: 400, headers: { "Content-Type": "application/json" } },
            );
        }

        // Check user permissions
        const [memberRows] = await pool.query<RowDataPacket[]>(
            `SELECT m.role, c.invite_permission
       FROM internal_channel_members m
       JOIN internal_channels c ON c.id = m.channel_id
       WHERE m.channel_id = ? AND m.user_id = ?`,
            [channelId, user.id]
        );

        const isAdmin = String(user.rol || "").toLowerCase() === "admin";
        const userRole = memberRows[0]?.role;
        const invitePermission = memberRows[0]?.invite_permission;

        // Check if user can invite
        const canInvite =
            isAdmin ||
            userRole === "owner" ||
            userRole === "admin" ||
            (invitePermission === "all" && userRole);

        if (!canInvite) {
            return new Response(
                JSON.stringify({ ok: false, error: "No tienes permisos para agregar miembros" }),
                { status: 403, headers: { "Content-Type": "application/json" } },
            );
        }

        // Filter valid user IDs
        const validUserIds = user_ids.filter((id) => typeof id === "number" && id > 0);

        if (validUserIds.length === 0) {
            return new Response(
                JSON.stringify({ ok: false, error: "No hay usuarios válidos para agregar" }),
                { status: 400, headers: { "Content-Type": "application/json" } },
            );
        }

        // Add members
        const values = validUserIds.map((userId) => [channelId, userId, "member", user.id]);

        try {
            await pool.query(
                `INSERT IGNORE INTO internal_channel_members (channel_id, user_id, role, invited_by)
         VALUES ?`,
                [values]
            );

            return new Response(
                JSON.stringify({ ok: true, message: "Miembros agregados exitosamente" }),
                { headers: { "Content-Type": "application/json" } },
            );
        } catch (error) {
            console.error("Error adding members:", error);
            throw error;
        }
    } catch (error) {
        console.error("Error in POST members:", error);
        return new Response(
            JSON.stringify({ ok: false, error: "Error al agregar miembros" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
        );
    }
};
