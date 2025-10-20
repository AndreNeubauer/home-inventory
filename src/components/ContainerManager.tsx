"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Container = {
  id: string;
  name: string;
  location: string | null;
  color?: string | null;
};

export default function ContainerManager({ householdId, initialContainers }: { householdId: string; initialContainers: Container[] }) {
  const [containers, setContainers] = useState<Container[]>(initialContainers);
  const [newName, setNewName] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newColor, setNewColor] = useState<string>("#e5f0ff");
  const [editing, setEditing] = useState<Record<string, { name: string; location: string; color: string }>>({});
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const reload = async () => {
    const { data } = await supabase
      .from("containers")
      .select("id,name,location,color")
      .eq("household_id", householdId)
      .order("name");
    setContainers((data || []) as Container[]);
  };

  useEffect(() => {
    setContainers(initialContainers);
  }, [initialContainers]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setErrorMsg("");
    const { error } = await supabase
      .from("containers")
      .insert([{ household_id: householdId, name: newName.trim(), location: newLocation.trim() || null, color: (newColor || '').trim() || null }]);
    setNewName("");
    setNewLocation("");
    setNewColor("#e5f0ff");
    if (error) { setErrorMsg(error.message); return; }
    await reload();
  };

  const save = async (id: string) => {
    const draft = editing[id];
    if (!draft) return;
    setErrorMsg("");
    const { error } = await supabase
      .from("containers")
      .update({ name: draft.name.trim(), location: draft.location.trim() || null, color: (draft.color || '').trim() || null })
      .eq("id", id);
    setEditing(prev => { const { [id]: _omitted, ...rest } = prev; return rest; });
    setEditingId(null);
    if (error) { setErrorMsg(error.message); return; }
    await reload();
  };

  const startEdit = (c: Container) => {
    setEditingId(c.id);
    setEditing(prev => ({ ...prev, [c.id]: { name: c.name, location: c.location || "", color: c.color || "" } }));
  };

  const cancelEdit = (id: string) => {
    setEditingId(null);
    setEditing(prev => { const { [id]: _omitted, ...rest } = prev; return rest; });
  };

  const remove = async (id: string) => {
    if (typeof window !== "undefined") {
      const ok = window.confirm("Delete this container?");
      if (!ok) return;
    }
    setErrorMsg("");
    const { error } = await supabase.from("containers").delete().eq("id", id);
    if (error) { setErrorMsg(error.message); return; }
    await reload();
  };

  return (
    <div className="flex flex-col gap-4">
      {errorMsg && <div className="text-sm text-red-600">{errorMsg}</div>}
      <form onSubmit={add} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
        <div>
          <label className="block text-sm mb-1 text-gray-800">Container name</label>
          <input value={newName} onChange={e => setNewName(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 text-gray-900" placeholder="e.g. Backpack" />
        </div>
        <div>
          <label className="block text-sm mb-1 text-gray-800">Location (optional)</label>
          <input value={newLocation} onChange={e => setNewLocation(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 text-gray-900" placeholder="e.g. Garage shelf" />
        </div>
        <div>
          <label className="block text-sm mb-1 text-gray-800">Color (optional)</label>
          <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)} className="w-full h-[38px] border border-gray-300 rounded-lg" />
        </div>
        <div>
          <button type="submit" className="h-[40px] px-4 rounded-md bg-blue-600 text-white font-semibold hover:bg-blue-700 transition">Add</button>
        </div>
      </form>
      <ul className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden divide-y divide-gray-200">
        {containers.map(c => (
          <li key={c.id} className="px-4 py-3 flex flex-col sm:flex-row gap-3 sm:items-end sm:justify-between">
            {editingId === c.id ? (
              <>
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm mb-1 text-gray-800">Name</label>
                    <input
                      value={editing[c.id]?.name ?? c.name}
                      onChange={e => setEditing(prev => ({ ...prev, [c.id]: { name: e.target.value, location: prev[c.id]?.location ?? (c.location || ""), color: prev[c.id]?.color ?? (c.color || "") } }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1 text-gray-800">Location (optional)</label>
                    <input
                      value={editing[c.id]?.location ?? (c.location || "")}
                      onChange={e => setEditing(prev => ({ ...prev, [c.id]: { name: prev[c.id]?.name ?? c.name, location: e.target.value, color: prev[c.id]?.color ?? (c.color || "") } }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1 text-gray-800">Color (optional)</label>
                    <input
                      type="color"
                      value={editing[c.id]?.color ?? (c.color || "#e5f0ff")}
                      onChange={e => setEditing(prev => ({ ...prev, [c.id]: { name: prev[c.id]?.name ?? c.name, location: prev[c.id]?.location ?? (c.location || ""), color: e.target.value } }))}
                      className="w-full h-[38px] border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => save(c.id)} className="px-3 py-2 rounded-md bg-green-600 text-white hover:bg-green-700">Save</button>
                  <button type="button" onClick={() => cancelEdit(c.id)} className="px-3 py-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-gray-800">Cancel</button>
                </div>
              </>
            ) : (
              <>
                <div className="flex-1">
                  <div className="text-gray-900 font-medium">{c.name}</div>
                  {c.location && (
                    <div className="text-sm text-gray-700">Location: {c.location}</div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => startEdit(c)} className="px-3 py-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-gray-800">Edit</button>
                  <button type="button" onClick={() => remove(c.id)} className="px-3 py-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-gray-800">Delete</button>
                </div>
              </>
            )}
          </li>
        ))}
        {containers.length === 0 && (
          <li className="px-4 py-4 text-gray-700">No containers yet.</li>
        )}
      </ul>
    </div>
  );
}


