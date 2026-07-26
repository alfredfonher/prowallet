"use client";

import { useEffect, useState } from "react";
import {
  getCurrentApiUrl,
  logEnvironmentConfig,
  getEnvironmentConfig,
} from "@/lib/config/environment";

export default function TestEnvPage() {
  const [config, setConfig] = useState<any>(null);
  const [apiStatus, setApiStatus] = useState<any>({});

  useEffect(() => {
    // Log configuración
    logEnvironmentConfig();
    setConfig(getEnvironmentConfig());
  }, []);

  useEffect(() => {
    const testApis = async () => {
      const urls = [
        {
          name: "LOCAL",
          url: "http://localhost:3001/api/v1/exchange/tokenInfo",
        },
        {
          name: "CLOUD",
          url: "https://servicioshilda.orioncaribe.com/api/v1/exchange/tokenInfo",
        },
        {
          name: "CURRENT",
          url: `${getCurrentApiUrl()}/exchange/tokenInfo`,
        },
      ];

      const results: any = {};

      for (const { name, url } of urls) {
        try {
          const response = await fetch(url, {
            method: "OPTIONS",
          });
          results[name] = {
            status: response.status,
            ok: response.ok,
          };
        } catch (err: any) {
          results[name] = {
            status: "ERROR",
            ok: false,
            error: err.message,
          };
        }
      }

      setApiStatus(results);
    };

    testApis();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">
          🧪 Environment Configuration Test
        </h1>

        {config && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">Environment Config</h2>
            <pre className="bg-gray-100 p-4 rounded overflow-auto">
              {JSON.stringify(config, null, 2)}
            </pre>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">API Status</h2>
          <div className="space-y-4">
            {Object.entries(apiStatus).map(([name, status]: any) => (
              <div key={name} className="border-l-4 border-blue-500 pl-4">
                <div className="font-bold">{name}</div>
                <div
                  className={`text-sm ${status.ok ? "text-green-600" : "text-red-600"}`}
                >
                  {status.ok
                    ? `✓ Status: ${status.status}`
                    : `✗ ${status.error || "Failed"}`}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4">Environment Variables</h2>
          <div className="space-y-2 font-mono text-sm">
            <p>
              NEXT_PUBLIC_API_URL:{" "}
              {process.env.NEXT_PUBLIC_API_URL || "(not set)"}
            </p>
            <p>
              NEXT_PUBLIC_API_URL_LOCAL:{" "}
              {process.env.NEXT_PUBLIC_API_URL_LOCAL || "(not set)"}
            </p>
            <p>
              NEXT_PUBLIC_API_URL_CLOUD:{" "}
              {process.env.NEXT_PUBLIC_API_URL_CLOUD || "(not set)"}
            </p>
            <p>NODE_ENV: {process.env.NODE_ENV || "(not set)"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
