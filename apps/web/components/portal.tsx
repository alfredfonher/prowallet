"use client";

import React, { useEffect, useRef, ReactNode, useState } from "react";
import { createPortal } from "react-dom";

interface PortalProps {
  children: ReactNode;
}

export function Portal({ children }: PortalProps) {
  const ref = useRef<Element | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    ref.current = document.getElementById("modal-root") || document.body;
    setMounted(true);
  }, []);

  if (!mounted || !ref.current) return null;

  return createPortal(children, ref.current);
}
