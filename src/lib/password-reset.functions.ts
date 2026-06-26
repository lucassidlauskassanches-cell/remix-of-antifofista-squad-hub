import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

const resetPasswordInput = z
  .object({
    password: z.string().min(6).max(200),
    tokenHash: z.string().min(1).max(2000).optional(),
    token: z.string().min(1).max(2000).optional(),
    email: z.string().email().max(255).optional(),
  })
  .refine((data) => data.tokenHash || (data.token && data.email), {
    message: "Link de recuperação inválido.",
  });

export const resetPasswordWithRecoveryProof = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => resetPasswordInput.parse(data))
  .handler(async ({ data }) => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Configuração de autenticação indisponível.");
    }

    const authClient = createClient<Database>(supabaseUrl, supabaseKey, {
      auth: {
        storage: undefined,
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: verified, error } = data.tokenHash
      ? await authClient.auth.verifyOtp({
          token_hash: data.tokenHash,
          type: "recovery",
        })
      : await authClient.auth.verifyOtp({
          email: data.email!,
          token: data.token!,
          type: "recovery",
        });

    if (error || !verified.user?.id) {
      throw new Error("Link inválido ou expirado. Solicite novo e-mail.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(verified.user.id, {
      password: data.password,
    });

    if (updateError) throw new Error(updateError.message);
    return { ok: true };
  });
