import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const flow = requestUrl.searchParams.get("flow");
  const isPopupFlow = flow === "popup";

  const buildResponse = (status: "success" | "error") => {
    const redirectUrl = new URL(
      isPopupFlow ? "/auth/popup-callback" : "/",
      requestUrl.origin
    );
    if (isPopupFlow) {
      redirectUrl.searchParams.set("status", status);
    }
    return NextResponse.redirect(redirectUrl);
  };

  let response = buildResponse("success");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[auth] callback ok:", requestUrl.origin);
    }
    return response;
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  try {
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
    }
  } catch {
    response = buildResponse("error");
  }

  if (process.env.NODE_ENV !== "production") {
    console.info("[auth] callback ok:", requestUrl.origin);
  }

  return response;
}
