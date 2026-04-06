"use client";

import { toast } from "sonner";

export type TxState = "idle" | "pending" | "confirming" | "success" | "error";

export function showTxLoading(message: string, id?: string | number) {
  return toast.loading(message, { id });
}

export function showTxSuccess(
  message: string,
  options?: Parameters<typeof toast.success>[1]
) {
  return toast.success(message, options);
}

export function showTxError(
  message: string,
  options?: Parameters<typeof toast.error>[1]
) {
  return toast.error(message, options);
}

export function dismissTxToast(id?: string | number) {
  toast.dismiss(id);
}

export function TxToast() {
  return null;
}
