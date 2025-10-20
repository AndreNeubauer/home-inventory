"use client";
import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function NameInventoryForm({ userId, userEmail, onCreated, onCancel }: { userId: string; userEmail?: string | null; onCreated: () => Promise<void> | void; onCancel: () => void }) {
  const [name, setName] = useState(userEmail ? `${userEmail.split("@")[0]}'s Inventory` : "My Inventory");
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (saving) return;
    setSaving(true);
    const invName = name.trim() || "My Inventory";
    const { data: household, error } = await supabase
      .from("households")
      .insert([{ name: invName }])
      .select()
      .single();
    if (!error && household) {
      await supabase
        .from("household_members")
        .insert([{ household_id: household.id, user_id: userId, role: "owner" }]);
      await onCreated();
    }
    setSaving(false);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8 flex flex-col gap-5">
      <h1 className="text-2xl font-semibold text-gray-900">Name your inventory</h1>
      <div>
        <label className="block text-sm mb-1 text-gray-800">Inventory name</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 rounded-lg px-3 py-2 bg-white outline-none transition text-gray-900 placeholder-gray-600"
          placeholder="e.g. My Home, Apartment, Backpack"
        />
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={create} disabled={saving} className="px-5 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-60 transition">
          Continue
        </button>
        <button type="button" onClick={onCancel} className="px-5 py-3 rounded-lg border border-gray-300 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium transition">
          Cancel
        </button>
      </div>
    </div>
  );
}


