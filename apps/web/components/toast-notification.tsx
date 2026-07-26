"use client";

import { useToken } from "@/components/token-provider";
import { useEffect, useState } from "react";

export function ToastNotification() {
  const { error, successMessage } = useToken();
  const [isVisible, setIsVisible] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [type, setType] = useState<"success" | "error">("success");

  useEffect(() => {
    if (successMessage) {
      setMessage(successMessage);
      setType("success");
      setIsVisible(true);
    } else if (error) {
      setMessage(error);
      setType("error");
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [successMessage, error]);

  if (!isVisible || !message) return null;

  return (
    <div
      className={`fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg text-white font-semibold transition-all duration-300 ${
        type === "success"
          ? "bg-green-500 hover:bg-green-600"
          : "bg-red-500 hover:bg-red-600"
      }`}
    >
      {message}
    </div>
  );
}
