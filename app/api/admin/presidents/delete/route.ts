import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function authorize(request: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return {
      error: jsonError(
        "Configuração do Supabase incompleta no servidor.",
        500
      ),
    };
  }

  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";

  if (!token) {
    return { error: jsonError("Sessão não encontrada.", 401) };
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const {
    data: { user: actingUser },
    error: userError,
  } = await authClient.auth.getUser(token);

  if (userError || !actingUser) {
    return { error: jsonError("Sessão inválida ou expirada.", 401) };
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: roleRow, error: roleError } = await admin
    .from("site_admins")
    .select("role, is_active")
    .eq("user_id", actingUser.id)
    .maybeSingle();

  if (
    roleError ||
    !roleRow ||
    !roleRow.is_active ||
    !["owner", "master"].includes(String(roleRow.role))
  ) {
    return {
      error: jsonError(
        "Somente OWNER ou ADM MASTER pode excluir presidentes.",
        403
      ),
    };
  }

  return {
    admin,
    actingUser,
  };
}

export async function DELETE(request: NextRequest) {
  const authorized = await authorize(request);

  if ("error" in authorized) {
    return authorized.error;
  }

  const { admin, actingUser } = authorized;

  let body: {
    userId?: string;
  };

  try {
    body = await request.json();
  } catch {
    return jsonError("Dados inválidos.", 400);
  }

  const userId = String(body.userId || "").trim();

  if (!userId) {
    return jsonError("Presidente inválido.", 400);
  }

  if (userId === actingUser.id) {
    return jsonError("Você não pode excluir sua própria conta.", 403);
  }

  const { data: targetAdmin, error: targetAdminError } = await admin
    .from("site_admins")
    .select("role, is_active")
    .eq("user_id", userId)
    .maybeSingle();

  if (targetAdminError) {
    return jsonError(
      "Não foi possível verificar o nível administrativo do usuário.",
      500
    );
  }

  if (
    targetAdmin?.is_active &&
    ["owner", "master"].includes(String(targetAdmin.role))
  ) {
    return jsonError(
      "OWNER ou ADM MASTER não pode ser excluído por esta função.",
      403
    );
  }

  const {
    data: { user: targetUser },
    error: getUserError,
  } = await admin.auth.admin.getUserById(userId);

  if (getUserError || !targetUser) {
    return jsonError("Usuário não encontrado no Supabase Auth.", 404);
  }

  const { error: unlinkError } = await admin
    .from("teams")
    .update({
      manager_id: null,
      manager_name: null,
    })
    .eq("manager_id", userId);

  if (unlinkError) {
    return jsonError(
      "Não foi possível liberar o time antes de excluir a conta.",
      500
    );
  }

  const { error: adminsCleanupError } = await admin
    .from("site_admins")
    .delete()
    .eq("user_id", userId);

  if (adminsCleanupError) {
    return jsonError(
      "Não foi possível limpar as permissões administrativas.",
      500
    );
  }

  const { error: approvalsCleanupError } = await admin
    .from("user_approvals")
    .delete()
    .eq("user_id", userId);

  if (approvalsCleanupError) {
    console.error(
      "Aviso: não foi possível limpar user_approvals:",
      approvalsCleanupError
    );
  }

  const { error: deleteUserError } = await admin.auth.admin.deleteUser(userId);

  if (deleteUserError) {
    return jsonError(
      deleteUserError.message || "Não foi possível excluir a conta.",
      500
    );
  }

  return NextResponse.json({
    ok: true,
    deletedUser: {
      userId,
      email: targetUser.email || "",
    },
  });
}
