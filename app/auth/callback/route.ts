import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const requestHeaders = await headers();
  const forwardedProto = requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = requestHeaders.get("x-forwarded-host")?.split(",")[0]?.trim();
  const origin = forwardedHost
    ? `${forwardedProto ?? "https"}://${forwardedHost}`
    : requestUrl.origin;
  const code = requestUrl.searchParams.get("code");
  const buildResponse = () => {
    const redirectUrl = new URL("/", origin);
    return NextResponse.redirect(redirectUrl);
  };

  let response = buildResponse();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[callback.normal] env missing", {
        requestUrl: request.url,
        origin,
        hasCode: Boolean(code),
        destination: response.headers.get("location"),
      });
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
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[callback.normal] exchange error", {
        message: error instanceof Error ? error.message : String(error),
        requestUrl: request.url,
      });
    }
    response = buildResponse();
  }

  if (process.env.NODE_ENV !== "production") {
    console.info("[callback.normal]", {
      requestUrl: request.url,
      origin,
      hasCode: Boolean(code),
      destination: response.headers.get("location"),
    });
  }

  return response;
}
