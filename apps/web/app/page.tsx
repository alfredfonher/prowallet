"use client";

import { useAuth } from "@/lib/auth-context";
import { AuthPage } from "@/components/auth/AuthPage";
import { MainLayout } from "@/components/layouts/MainLayout";

/**
 * Componente de contenido principal de la app
 *
 * Responsabilidades:
 * - Check if user is authenticated
 * - Render AuthPage if NOT authenticated
 * - Render MainLayout if authenticated
 *
 * @returns AuthPage o MainLayout based on authentication state
 */
function TokenAppContent() {
  const { user } = useAuth();

  // Si no hay usuario autenticado, mostrar página de auth
  if (!user) {
    return <AuthPage api_url="http://localhost:3001/api/v1" />;
  }

  // Si hay usuario, mostrar dashboard
  return <MainLayout />;
}

/**
 * Página principal de la aplicación
 *
 * @returns El contenedor de la app
 */
export default function TokenApp() {
  return <TokenAppContent />;
}
