import type { APIRoute } from "astro";
import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../../../../lib/db";

// GET /api/internal/channels/:id - Get channel details with members
export const GET: APIRoute = async ({ locals, params }) => {
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

        const isAdmin = String(user.rol || "").toLowerCase() === "admin";

        // Get channel info
        const [channelRows] = await pool.query<RowDataPacket[]>(
            `SELECT 
        c.*,
        u.nombre AS creator_name,
        m.role AS user_role
      FROM internal_channels c
      LEFT JOIN usuarios u ON u.id = c.created_by
      LEFT JOIN internal_channel_members m ON m.channel_id = c.id AND m.user_id = ?
      WHERE c.id = ? AND c.archived = 0`,
            [user.id, channelId]
        );

        if (channelRows.length === 0) {
            return new Response(
                JSON.stringify({ ok: false, error: "Canal no encontrado" }),
                { status: 404, headers: { "Content-Type": "application/json" } },
            );
        }

        const channel = channelRows[0];

        // Check if user has access to this channel
        if (channel.type === "private" && !channel.user_role && !isAdmin) {
            return new Response(
                JSON.stringify({ ok: false, error: "No tienes acceso a este canal" }),
                { status: 403, headers: { "Content-Type": "application/json" } },
            );
        }

        // Get channel members
        const [memberRows] = await pool.query<RowDataPacket[]>(
            `SELECT 
        m.id AS membership_id,
        m.role,
        m.joined_at,
        m.invited_by,
        u.id AS user_id,
        u.nombre,
        u.email,
        u.sucursal_id,
        s.nombre AS sucursal,
        act.last_activity_at,
        CASE
          WHEN act.last_activity_at IS NOT NULL
            AND act.last_activity_at >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
            THEN 1
          ELSE 0
        END AS is_online
      FROM internal_channel_members m
      JOIN usuarios u ON u.id = m.user_id
      LEFT JOIN sucursales s ON s.id = u.sucursal_id
      LEFT JOIN (
        SELECT user_id, MAX(created_at) AS last_activity_at
        FROM internal_messages
        WHERE deleted_at IS NULL
        GROUP BY user_id
      ) act ON act.user_id = u.id
      WHERE m.channel_id = ?
      ORDER BY 
        CASE m.role
          WHEN 'owner' THEN 1
          WHEN 'admin' THEN 2
          WHEN 'member' THEN 3
          WHEN 'readonly' THEN 4
        END,
        u.nombre ASC`,
            [channelId]
        );

        return new Response(
            JSON.stringify({
                ok: true,
                channel: {
                    id: channel.id,
                    name: channel.name,
                    description: channel.description,
                    type: channel.type,
                    created_by: channel.created_by,
                    creator_name: channel.creator_name,
                    created_at: channel.created_at,
                    write_permission: channel.write_permission,
                    invite_permission: channel.invite_permission,
                    thread_permission: channel.thread_permission,
                    pin_permission: channel.pin_permission,
                    delete_permission: channel.delete_permission,
                    user_role: channel.user_role || null,
                },
                members: memberRows,
                currentUserId: user.id,
                isAdmin,
            }),
            { headers: { "Content-Type": "application/json" } },
        );
    } catch (error) {
        console.error("Error getting channel details:", error);
        return new Response(
            JSON.stringify({ ok: false, error: "Error al obtener información del canal" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
        );
    }
};

// PUT /api/internal/channels/:id - Update channel settings
export const PUT: APIRoute = async ({ locals, params, request }) => {
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
        const { name, description, type, write_permission, invite_permission } = body;

        // Check user permissions
        const [memberRows] = await pool.query<RowDataPacket[]>(
            `SELECT role FROM internal_channel_members WHERE channel_id = ? AND user_id = ?`,
            [channelId, user.id]
        );

        const isAdmin = String(user.rol || "").toLowerCase() === "admin";
        const userRole = memberRows[0]?.role;
        const canEdit = isAdmin || userRole === "owner" || userRole === "admin";

        if (!canEdit) {
            return new Response(
                JSON.stringify({ ok: false, error: "No tienes permisos para editar este canal" }),
                { status: 403, headers: { "Content-Type": "application/json" } },
            );
        }

        // Build update query
        const updates: string[] = [];
        const values: any[] = [];

        if (name !== undefined) {
            const cleanName = String(name).trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
            if (cleanName.length < 2 || cleanName.length > 50) {
                return new Response(
                    JSON.stringify({ ok: false, error: "Nombre inválido (2-50 caracteres)" }),
                    { status: 400, headers: { "Content-Type": "application/json" } },
                );
            }
            updates.push("name = ?");
            values.push(cleanName);
        }

        if (description !== undefined) {
            updates.push("description = ?");
            values.push(description || null);
        }

        if (type !== undefined && (type === "public" || type === "private")) {
            updates.push("type = ?");
            values.push(type);
        }

        if (write_permission !== undefined) {
            updates.push("write_permission = ?");
            values.push(write_permission);
        }

        if (invite_permission !== undefined) {
            updates.push("invite_permission = ?");
            values.push(invite_permission);
        }

        if (updates.length === 0) {
            return new Response(
                JSON.stringify({ ok: false, error: "No hay cambios para aplicar" }),
                { status: 400, headers: { "Content-Type": "application/json" } },
            );
        }

        values.push(channelId);

        await pool.query(
            `UPDATE internal_channels SET ${updates.join(", ")} WHERE id = ?`,
            values
        );

        return new Response(
            JSON.stringify({ ok: true, message: "Canal actualizado exitosamente" }),
            { headers: { "Content-Type": "application/json" } },
        );
    } catch (error: any) {
        console.error("Error updating channel:", error);

        if (error.code === "ER_DUP_ENTRY") {
            return new Response(
                JSON.stringify({ ok: false, error: "Ya existe un canal con ese nombre" }),
                { status: 409, headers: { "Content-Type": "application/json" } },
            );
        }

        return new Response(
            JSON.stringify({ ok: false, error: "Error al actualizar canal" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
        );
    }
};

// DELETE /api/internal/channels/:id - Delete channel
export const DELETE: APIRoute = async ({ locals, params }) => {
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

        // Check if user is owner
        const [memberRows] = await pool.query<RowDataPacket[]>(
            `SELECT role FROM internal_channel_members WHERE channel_id = ? AND user_id = ?`,
            [channelId, user.id]
        );

        const isAdmin = String(user.rol || "").toLowerCase() === "admin";
        const isOwner = memberRows[0]?.role === "owner";

        if (!isAdmin && !isOwner) {
            return new Response(
                JSON.stringify({ ok: false, error: "Solo el creador puede eliminar el canal" }),
                { status: 403, headers: { "Content-Type": "application/json" } },
            );
        }

        // Archive instead of delete to preserve history
        await pool.query(
            `UPDATE internal_channels SET archived = 1 WHERE id = ?`,
            [channelId]
        );

        return new Response(
            JSON.stringify({ ok: true, message: "Canal eliminado exitosamente" }),
            { headers: { "Content-Type": "application/json" } },
        );
    } catch (error) {
        console.error("Error deleting channel:", error);
        return new Response(
            JSON.stringify({ ok: false, error: "Error al eliminar canal" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
        );
    }
};
