import { NextResponse } from "next/server";
import { ProductFeedbackError } from "@/lib/product-feedback-server";

export const respondProductFeedbackError = (error: unknown) => {
  if (error instanceof ProductFeedbackError) {
    return NextResponse.json(
      {
        error: error.code,
        message: error.message,
        ...(error.payload ? { payload: error.payload } : {}),
      },
      { status: error.status }
    );
  }

  const message =
    error instanceof Error ? error.message : "Falha inesperada no hub de melhorias.";

  return NextResponse.json(
    {
      error: "internal_error",
      message,
    },
    { status: 500 }
  );
};
