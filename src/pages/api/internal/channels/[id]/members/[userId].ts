import type { APIRoute } from "astro";
import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../../../../../../lib/db";

// DELETE /api/internal/channels/:id/members/:userId - Remove member from channel
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
        const targetUserId = Number(params.userId);

        if (!channelId || isNaN(channelId) || !targetUserId || isNaN(targetUserId)) {
            return new Response(
                JSON.stringify({ ok: false, error: "IDs inválidos" }),
                { status: 400, headers: { "Content-Type": "application/json" } },
            );
        }

        // Check user permissions
        const [memberRows] = await pool.query<RowDataPacket[]>(
            `SELECT role FROM internal_channel_members WHERE channel_id = ? AND user_id = ?`,
            [channelId, user.id]
        );

        // Check target user role
        const [targetRows] = await pool.query<RowDataPacket[]>(
            `SELECT role FROM internal_channel_members WHERE channel_id = ? AND user_id = ?`,
            [channelId, targetUserId]
        );

        const isAdmin = String(user.rol || "").toLowerCase() === "admin";
        const userRole = memberRows[0]?.role;
        const targetRole = targetRows[0]?.role;

        // Can't remove owner
        if (targetRole === "owner") {
            return new Response(
                JSON.stringify({ ok: false, error: "No se puede remover al creador del canal" }),
                { status: 403, headers: { "Content-Type": "application/json" } },
            );
        }

        // Check if user can remove members
        const canRemove =
            isAdmin ||
            userRole === "owner" ||
            userRole === "admin" ||
            user.id === targetUserId; // Can remove self

        if (!canRemove) {
            return new Response(
                JSON.stringify({ ok: false, error: "No tienes permisos para remover miembros" }),
                { status: 403, headers: { "Content-Type": "application/json" } },
            );
        }

        await pool.query(
            `DELETE FROM internal_channel_members WHERE channel_id = ? AND user_id = ?`,
            [channelId, targetUserId]
        );

        return new Response(
            JSON.stringify({ ok: true, message: "Miembro removido exitosamente" }),
            { headers: { "Content-Type": "application/json" } },
        );
    } catch (error) {
        console.error("Error removing member:", error);
        return new Response(
            JSON.stringify({ ok: false, error: "Error al remover miembro" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
        );
    }
};

// PUT /api/internal/channels/:id/members/:userId - Update member role
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
        const targetUserId = Number(params.userId);

        if (!channelId || isNaN(channelId) || !targetUserId || isNaN(targetUserId)) {
            return new Response(
                JSON.stringify({ ok: false, error: "IDs inválidos" }),
                { status: 400, headers: { "Content-Type": "application/json" } },
            );
        }

        const body = await request.json();
        const { role } = body;

        if (!["admin", "member", "readonly"].includes(role)) {
            return new Response(
                JSON.stringify({ ok: false, error: "Rol inválido" }),
                { status: 400, headers: { "Content-Type": "application/json" } },
            );
        }

        // Only owner can change roles
        const [memberRows] = await pool.query<RowDataPacket[]>(
            `SELECT role FROM internal_channel_members WHERE channel_id = ? AND user_id = ?`,
            [channelId, user.id]
        );

        const isSystemAdmin = String(user.rol || "").toLowerCase() === "admin";
        const isOwner = memberRows[0]?.role === "owner";

        if (!isSystemAdmin && !isOwner) {
            return new Response(
                JSON.stringify({ ok: false, error: "Solo el creador puede cambiar roles" }),
                { status: 403, headers: { "Content-Type": "application/json" } },
            );
        }

        // Can't change owner role
        const [targetRows] = await pool.query<RowDataPacket[]>(
            `SELECT role FROM internal_channel_members WHERE channel_id = ? AND user_id = ?`,
            [channelId, targetUserId]
        );

        if (targetRows[0]?.role === "owner") {
            return new Response(
                JSON.stringify({ ok: false, error: "No se puede cambiar el rol del creador" }),
                { status: 403, headers: { "Content-Type": "application/json" } },
            );
        }

        await pool.query(
            `UPDATE internal_channel_members SET role = ? WHERE channel_id = ? AND user_id = ?`,
            [role, channelId, targetUserId]
        );

        return new Response(
            JSON.stringify({ ok: true, message: "Rol actualizado exitosamente" }),
            { headers: { "Content-Type": "application/json" } },
        );
    } catch (error) {
        console.error("Error updating member role:", error);
        return new Response(
            JSON.stringify({ ok: false, error: "Error al actualizar rol" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
        );
    }
};
