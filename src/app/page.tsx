"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { verifyPrompt, registerUser } from "@/server/image.action";

const Home = () => {
  const [prompt, setPrompt] = useState("");
  const [email, setEmail] = useState("");
  const [showEmail, setShowEmail] = useState(false);
  const [hash, setHash] = useState<string>("");
  const [comicId, setComicId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("banana-comic:registration");
      if (!saved) return;
      const data = JSON.parse(saved) as {
        prompt: string;
        email: string;
        hash: string;
        id?: string;
        success: boolean;
      };
      if (data?.success) {
        setPrompt(data.prompt ?? "");
        setEmail(data.email ?? "");
        setHash(data.hash ?? "");
        if (data.id) setComicId(data.id);
        setShowEmail(true);
        setSuccess(true);
      }
    } catch {}
  }, []);

  const handleNext = async () => {
    setError("");
    if (!prompt.trim()) return;

    if (!showEmail) {
      setLoading(true);
      const result = await verifyPrompt(prompt);
      setLoading(false);
      if (!result.ok) {
        setError(result.reason ?? "Prompt cannot be used.");
        return;
      }
      setHash(result.hash);
      if (result.id) setComicId(result.id);
      setShowEmail(true);
      return;
    }

    // Register
    if (!email.trim()) return;
    setLoading(true);
    const res = await registerUser({ id: comicId, prompt, hash, email });
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSuccess(true);
    try {
      localStorage.setItem(
        "banana-comic:registration",
        JSON.stringify({ prompt, email, hash, id: comicId, success: true })
      );
    } catch {}
  };

  return (
    <main className="min-h-screen flex flex-col items-center p-8">
      <div className="w-full max-w-xl">
        <h1 className="text-3xl font-semibold">🍌 Banana Comics</h1>
        <p className="mt-2 text-sm text-gray-600">
          This generates a comic that gets sent to you every day, and the story
          never ends.
        </p>
      </div>

      <div className="w-full max-w-xl mt-10 space-y-4">
        <label htmlFor="story" className="block text-sm font-medium">
          Story prompt
        </label>
        <input
          id="story"
          type="text"
          placeholder="e.g., A banana detective solving a mystery in space"
          className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-yellow-400"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={success}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}

        <AnimatePresence>
          {showEmail && (
            <motion.div
              key="email-field"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2 }}
              className="mt-6 space-y-2"
            >
              <label htmlFor="email" className="block text-sm font-medium">
                Email to receive your daily comic
              </label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-yellow-400"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={success}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex justify-start pt-4">
          <button
            type="button"
            onClick={handleNext}
            disabled={
              loading || (showEmail ? !email.trim() : !prompt.trim()) || success
            }
            className="rounded-md bg-yellow-400 px-4 py-2 font-medium text-black disabled:opacity-50"
          >
            {success
              ? "Registered"
              : showEmail
                ? loading
                  ? "Registering..."
                  : "Register"
                : loading
                  ? "Checking..."
                  : "Next"}
          </button>
        </div>

        {success && (
          <div className="mt-6 rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-800">
            You&apos;re registered! Your first comic should be in your inbox
            now. You&apos;ll get one every morning around 8am EST.
          </div>
        )}
      </div>
    </main>
  );
};

export default Home;
