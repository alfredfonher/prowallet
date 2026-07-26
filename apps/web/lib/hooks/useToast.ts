import toast from "react-hot-toast";

export type ToastType = "success" | "error" | "loading" | "info";

interface ToastOptions {
  duration?: number;
  position?:
    | "top-left"
    | "top-center"
    | "top-right"
    | "bottom-left"
    | "bottom-center"
    | "bottom-right";
}

export function useToast() {
  const showToast = (
    message: string,
    type: ToastType = "info",
    options: ToastOptions = {},
  ) => {
    const { duration = 3000, position = "top-right" } = options;

    switch (type) {
      case "success":
        toast.success(message, { duration, position });
        break;
      case "error":
        toast.error(message, { duration, position });
        break;
      case "loading":
        toast.loading(message, { position });
        break;
      case "info":
        toast(message, { duration, position });
        break;
    }
  };

  const success = (message: string, options?: ToastOptions) => {
    showToast(message, "success", options);
  };

  const error = (message: string, options?: ToastOptions) => {
    showToast(message, "error", options);
  };

  const loading = (message: string, options?: ToastOptions) => {
    showToast(message, "loading", options);
  };

  const info = (message: string, options?: ToastOptions) => {
    showToast(message, "info", options);
  };

  return { success, error, loading, info, showToast };
}
