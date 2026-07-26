/**
 * Layout/contenedor para la página de autenticación
 */

import type React from "react";

/**
 * Props para AuthPageLayout
 */
export interface AuthPageLayoutProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  info_box?: React.ReactNode;
}

/**
 * Layout para la página de autenticación
 *
 * Contenedor visual con:
 * - Gradient background
 * - Centered card
 * - Title y subtitle
 * - Content slot
 * - Optional footer
 * - Optional info box
 */
export const AuthPageLayout: React.FC<AuthPageLayoutProps> = ({
  title,
  subtitle,
  children,
  footer,
  info_box,
}) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-md w-full mx-auto p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 space-y-6">
          {/* Title Section */}
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
              {title}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">{subtitle}</p>
          </div>

          {/* Content */}
          {children}

          {/* Footer */}
          {footer && (
            <div className="text-center border-t border-gray-200 dark:border-gray-700 pt-4">
              {footer}
            </div>
          )}

          {/* Info Box */}
          {info_box && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 px-4 py-3 rounded-md text-sm">
              {info_box}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

AuthPageLayout.displayName = "AuthPageLayout";
