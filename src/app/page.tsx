"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";

const Home = () => {
  const [prompt, setPrompt] = useState("");
  const [email, setEmail] = useState("");
  const [showEmail, setShowEmail] = useState(false);

  const handleNext = () => {
    if (!prompt.trim()) return;
    setShowEmail(true);
  };

  return (
    <main className="min-h-screen flex flex-col items-center p-8">
      <div className="w-full max-w-xl">
        <h1 className="text-3xl font-semibold text-center">Banana Comics</h1>
        <p className="mt-2 text-center text-sm text-gray-600">
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
        />

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
              />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex justify-end pt-4">
          <button
            type="button"
            onClick={handleNext}
            disabled={!prompt.trim()}
            className="rounded-md bg-yellow-400 px-4 py-2 font-medium text-black disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </main>
  );
};

export default Home;
