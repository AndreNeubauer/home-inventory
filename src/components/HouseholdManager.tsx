"use client";
import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Inventory = { id: string; name: string };

export default function HouseholdManager({ inventories, onChanged, canDelete = true }: { inventories: Inventory[]; onChanged: () => Promise<void> | void; canDelete?: boolean }) {
  const [newName, setNewName] = useState("");
  const [renames, setRenames] = useState<Record<string, string>>({});

  const createInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    await supabase.from("households").insert([{ name }]);
    setNewName("");
    await onChanged();
  };

  const renameInventory = async (id: string) => {
    const name = (renames[id] || "").trim();
    if (!name) return;
    await supabase.from("households").update({ name }).eq("id", id);
    await onChanged();
  };

  const deleteInventory = async (id: string) => {
    if (!canDelete) return;
    const ok = typeof window === "undefined" ? true : window.confirm("Delete this inventory and all its data? This cannot be undone.");
    if (!ok) return;
    // Remove dependent rows first to avoid FK errors
    await supabase.from("shopping_list").delete().eq("household_id", id);
    await supabase.from("items").delete().eq("household_id", id);
    await supabase.from("household_members").delete().eq("household_id", id);
    await supabase.from("households").delete().eq("id", id);
    await onChanged();
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-gray-900">Manage inventories</h2>
      <form onSubmit={createInventory} className="flex gap-2 items-end">
        <div className="flex-1">
          <label className="block text-sm mb-1 text-gray-800">New inventory name</label>
          <input value={newName} onChange={e => setNewName(e.target.value)} className="w-full border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 rounded-lg px-3 py-2 bg-white outline-none transition text-gray-900 placeholder-gray-600" placeholder="e.g. Garage, Cabin" />
        </div>
        <button type="submit" className="h-[40px] px-4 rounded-md bg-blue-600 text-white font-semibold hover:bg-blue-700 transition">Create</button>
      </form>

      <ul className="divide-y divide-gray-200 border rounded-xl overflow-hidden">
        {inventories.map(inv => (
          <li key={inv.id} className="p-3 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="flex-1">
              <div className="text-sm text-gray-700 mb-1">Current name</div>
              <div className="text-gray-900 font-medium">{inv.name}</div>
            </div>
            <div className="flex-1">
              <label className="block text-sm mb-1 text-gray-800">Rename to</label>
              <input value={renames[inv.id] ?? ""} onChange={e => setRenames(prev => ({ ...prev, [inv.id]: e.target.value }))} className="w-full border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 rounded-lg px-3 py-2 bg-white outline-none transition text-gray-900 placeholder-gray-600" placeholder="New name" />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => renameInventory(inv.id)} className="px-3 py-2 rounded-md bg-green-600 text-white hover:bg-green-700">Save</button>
              {canDelete && (
                <button type="button" onClick={() => deleteInventory(inv.id)} className="px-3 py-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-gray-800">Delete</button>
              )}
            </div>
          </li>
        ))}
        {inventories.length === 0 && (<li className="p-3 text-gray-700">No inventories yet.</li>)}
      </ul>
    </div>
  );
}


