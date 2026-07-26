"use client";

import { useState, useCallback } from "react";

export interface TransferFormData {
  from_holder: string;
  to_address: string;
  amount: string;
}

export function use_transfer_form() {
  const [form_data, set_form_data] = useState<TransferFormData>({
    from_holder: "",
    to_address: "",
    amount: "",
  });

  const update_field = useCallback(
    (field: keyof TransferFormData, value: string) => {
      set_form_data((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const reset_form = useCallback(() => {
    set_form_data({ from_holder: "", to_address: "", amount: "" });
  }, []);

  return { form_data, update_field, reset_form };
}
