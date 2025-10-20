"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Group = { id: string; name: string };

export default function GroupManager({ householdId, initialGroups }: { householdId: string; initialGroups: Group[] }) {
  const [groups, setGroups] = useState<Group[]>(initialGroups);
  const [newName, setNewName] = useState("");
  const [renames, setRenames] = useState<Record<string, string>>({});
  const [errorMsg, setErrorMsg] = useState<string>("");

  const reload = async () => {
    const { data } = await supabase
      .from("groups")
      .select("id,name")
      .eq("household_id", householdId)
      .order("name");
    setGroups((data || []) as Group[]);
  };

  useEffect(() => {
    setGroups(initialGroups);
  }, [initialGroups]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setErrorMsg("");
    const { error } = await supabase.from("groups").insert([{ household_id: householdId, name: newName.trim() }]);
    setNewName("");
    if (error) { setErrorMsg(error.message); return; }
    await reload();
  };

  const save = async (id: string) => {
    const name = (renames[id] || "").trim();
    if (!name) return;
    setErrorMsg("");
    const { error } = await supabase.from("groups").update({ name }).eq("id", id);
    if (error) { setErrorMsg(error.message); return; }
    await reload();
  };

  const remove = async (id: string) => {
    if (typeof window !== "undefined") {
      const ok = window.confirm("Delete this group?");
      if (!ok) return;
    }
    setErrorMsg("");
    const { error } = await supabase.from("groups").delete().eq("id", id);
    if (error) { setErrorMsg(error.message); return; }
    await reload();
  };

  return (
    <div className="flex flex-col gap-4">
      {errorMsg && <div className="text-sm text-red-600">{errorMsg}</div>}
      <form onSubmit={add} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
        <div className="sm:col-span-2">
          <label className="block text-sm mb-1 text-gray-800">New group name</label>
          <input value={newName} onChange={e => setNewName(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 text-gray-900" placeholder="e.g. Camping kit" />
        </div>
        <div>
          <button type="submit" className="h-[40px] px-4 rounded-md bg-blue-600 text-white font-semibold hover:bg-blue-700 transition">Add</button>
        </div>
      </form>
      <ul className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden divide-y divide-gray-200">
        {groups.map(g => (
          <li key={g.id} className="px-4 py-3 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="flex-1">
              <div className="text-gray-900 font-medium">{g.name}</div>
            </div>
            <div className="flex gap-2">
              <input value={renames[g.id] ?? ""} onChange={e => setRenames(prev => ({ ...prev, [g.id]: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 text-gray-900" placeholder="Rename" />
              <button type="button" onClick={() => save(g.id)} className="px-3 py-2 rounded-md bg-green-600 text-white hover:bg-green-700">Save</button>
              <button type="button" onClick={() => remove(g.id)} className="px-3 py-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-gray-800">Delete</button>
            </div>
          </li>
        ))}
        {groups.length === 0 && (<li className="px-4 py-4 text-gray-700">No groups yet.</li>)}
      </ul>
    </div>
  );
}


