"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Flame, Lock, User, AlertCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !password) {
      setError("Please enter both username and password");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      const redirectPath = searchParams.get("from") || "/pos";

      router.push(redirectPath);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#0c0d10] p-4 relative overflow-hidden">
      {/* Fiery ambient glow backdrop */}
      <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-orange-600/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-amber-600/10 blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md rounded-2xl border border-zinc-800 bg-[#16171d]/90 p-8 shadow-2xl backdrop-blur-md"
      >
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-zinc-900/90 border border-orange-500/30 p-1 shadow-xl shadow-orange-500/20 mb-4 overflow-hidden">
            <Image
              src="/logo.PNG"
              alt="Fork & Fire logo"
              width={80}
              height={80}
              priority
              className="h-full w-full object-contain rounded-xl"
            />
          </div>
          <h1 className="text-3xl font-black tracking-wider text-white">
            FORK <span className="text-orange-500">&</span> FIRE
          </h1>
          <p className="mt-1 text-xs font-semibold tracking-widest text-orange-400/90 uppercase">
            Restaurant POS System
          </p>
          <div className="mt-2 flex items-center gap-2 text-xs text-zinc-400">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
            <span>Local Offline Ready</span>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mb-6 flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3.5 text-sm text-red-300"
          >
            <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
            <span>{error}</span>
          </motion.div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300">Username</label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 h-5 w-5 text-zinc-500" />
              <Input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                 placeholder="Enter username (e.g. admin)"
                className="pl-10 h-11 bg-zinc-900 border-zinc-700 text-white"
                autoComplete="username"
                autoFocus
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-5 w-5 text-zinc-500" />
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="pl-10 h-11 bg-zinc-900 border-zinc-700 text-white"
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            variant="fire"
            className="w-full h-12 text-base font-bold mt-2"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Signing in...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                Sign In to Terminal
                <ArrowRight className="h-4 w-4" />
              </span>
            )}
          </Button>
        </form>

        {/* Footer info */}
        <div className="mt-6 text-center text-[11px] text-zinc-600">
          Fork & Fire Local Terminal v1.0 • Offline Ready
        </div>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-screen w-full items-center justify-center bg-[#0c0d10] text-zinc-500 text-xs">
          Loading login terminal...
        </div>
      }
    >
      <LoginForm />
    </React.Suspense>
  );
}
