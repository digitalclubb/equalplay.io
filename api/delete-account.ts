import { createClient } from "@supabase/supabase-js";

// Avoids pulling in @types/node for one property.
declare const process: { env: Record<string, string | undefined> };

/**
 * Deletes the calling user's account.
 *
 * supabase-js cannot remove a user from the browser. That needs the service
 * role key, which must never ship to a client. The flow is: the browser
 * sends its own access token, we verify it with the anon key to learn who the
 * caller is, then delete exactly that user with the admin client. Saved session
 * plans go with them via `on delete cascade`.
 */
export async function POST(request: Request): Promise<Response> {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceKey) {
    console.error("delete-account: missing Supabase environment variables");
    return new Response("Account deletion is not available.", { status: 500 });
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer /i, "");
  if (!token) return new Response("Not signed in.", { status: 401 });

  // Verify the token rather than trusting any user id in the body. Otherwise
  // this endpoint would delete anyone's account on request.
  const { data, error } = await createClient(url, anonKey).auth.getUser(token);
  if (error || !data.user) return new Response("Not signed in.", { status: 401 });

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: deleteError } = await admin.auth.admin.deleteUser(data.user.id);
  if (deleteError) {
    console.error("delete-account: delete failed", deleteError.message);
    return new Response("Could not delete your account. Try again.", { status: 500 });
  }

  return new Response(null, { status: 204 });
}
