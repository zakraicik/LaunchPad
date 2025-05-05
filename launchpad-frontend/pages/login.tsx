import { useState } from "react";
import { useRouter } from "next/router";
import AnimatedBackground from "../components/AnimatedBackground";
import { LockClosedIcon } from "@heroicons/react/24/outline";

export default function Login() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        router.push("/");
      } else {
        setError("Invalid password");
      }
    } catch (err) {
      setError("An error occurred");
    }
  };

  return (
    <>
      <AnimatedBackground />
      <div className="relative min-h-screen flex items-center justify-center z-1">
        <div className="max-w-md w-full space-y-8 p-8 bg-white/10 backdrop-blur-md rounded-lg transition-all duration-200 shadow-[0_0_10px_rgba(191,219,254,0.2)] border border-gray-100">
          <div className="flex justify-center mt-2 mb-4">
            <LockClosedIcon className="h-12 w-12 text-blue-500" />
          </div>
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="rounded-md shadow-sm -space-y-px">
              <div>
                <label htmlFor="password" className="sr-only">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className={`w-full pl-4 pr-4 py-2.5 bg-white border rounded-md text-base font-medium text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 transition-all ${
                    error ? "border-red-500" : "border-gray-200"
                  }`}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div className="text-red-500 text-sm text-center">{error}</div>
            )}

            <div className="flex justify-center">
              <button
                type="submit"
                className="relative overflow-hidden flex justify-center items-center w-48 py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 via-purple-500/60 to-purple-500/0 animate-shimmer pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 via-purple-500/40 to-purple-500/0 animate-shimmer [animation-delay:1s] pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 via-purple-500/30 to-purple-500/0 animate-shimmer [animation-delay:2s] pointer-events-none" />
                <span className="relative z-10">Enter Site</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
