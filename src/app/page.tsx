"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

export default function RootRedirect() {
  const router = useRouter();

  useEffect(() => {
    const check = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        router.replace("/home");
      }
    };
    check();
  }, [router]);

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({ provider: "google" });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl w-full mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 flex flex-col items-center gap-4">
          <h1 className="text-3xl font-bold text-gray-900">Home Inventory</h1>
          <p className="text-gray-700 text-center">You need to be logged in to view your inventory.</p>
          <button onClick={signInWithGoogle} className="px-5 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition">Sign in with Google</button>
        </div>
      </div>
    </div>
  );
}
