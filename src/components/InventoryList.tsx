"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Item = { id: string; name: string; quantity: number | null; tags?: string[]; group_id?: string | null };
type Group = { id: string; name: string };

export default function InventoryList({ householdId, initialItems, refreshSignal }: { householdId: string; initialItems: Item[]; refreshSignal?: number }) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [name, setName] = useState("");
  const [qty, setQty] = useState<number>(1);
  const [groupId, setGroupId] = useState<string>("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [filterGroupId, setFilterGroupId] = useState<string>("");

  const reload = async () => {
    let query = supabase
      .from("items")
      .select("id,name,quantity,tags,group_id")
      .eq("household_id", householdId)
      .order("name");
    if (filterGroupId) {
      query = query.eq("group_id", filterGroupId);
    }
    const { data } = await query;
    setItems(data || []);
  };
  const reloadGroups = async () => {
    const { data } = await supabase
      .from("groups")
      .select("id,name")
      .eq("household_id", householdId)
      .order("name");
    setGroups((data || []) as Group[]);
  };
  useEffect(() => {
    reloadGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdId]);
  // live updates with cleanup
  useEffect(() => {
    if (!householdId) return;
    const channel = supabase
      .channel(`items-${householdId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items', filter: `household_id=eq.${householdId}` }, reload)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [householdId]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await supabase.from("items").insert([{ household_id: householdId, name: name.trim(), quantity: qty, group_id: groupId || null }]);
    setName("");
    setQty(1);
    setGroupId("");
    await reload();
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-800">Filter by group</label>
          <select value={filterGroupId} onChange={e => { setFilterGroupId(e.target.value); void reload(); }} className="border border-gray-300 rounded-md px-2 py-1 text-sm text-gray-900">
            <option value="">All</option>
            {groups.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
      </div>
      <form onSubmit={add} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
        <div className="flex-1">
          <label className="block text-sm mb-1 text-gray-800">Item name</label>
          <input value={name} onChange={e => setName(e.target.value)} className="w-full border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 rounded-lg px-3 py-2 bg-white outline-none transition text-gray-900 placeholder-gray-600" placeholder="e.g. Ketchup" required />
        </div>
        <div>
          <label className="block text-sm mb-1 text-gray-800">Qty</label>
          <input type="number" min={1} value={qty} onChange={e => setQty(Number(e.target.value) || 1)} className="w-24 border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 rounded-lg px-3 py-2 bg-white outline-none transition text-gray-900" />
        </div>
        <div>
          <label className="block text-sm mb-1 text-gray-800">Group</label>
          <select value={groupId} onChange={e => setGroupId(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900">
            <option value="">None</option>
            {groups.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="h-[40px] px-4 rounded-md bg-green-600 text-white font-semibold hover:bg-green-700 transition">Add</button>
      </form>
      <EditableList items={items} onUpdated={reload} />
    </div>
  );
}

function EditableList({ items, onUpdated }: { items: Item[]; onUpdated: () => Promise<void> | void }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editQty, setEditQty] = useState<number>(1);
  const [editTags, setEditTags] = useState("");
  const [editGroupId, setEditGroupId] = useState<string>("");
  const [groups, setGroups] = useState<Group[]>([]);

  useEffect(() => {
    const load = async () => {
      // derive household from any item if available by joining? Not available here; rely on selection form setting earlier component state.
      // As a fallback, just load all groups user can see (will be scoped by RLS to their households).
      const { data } = await supabase.from('groups').select('id,name').order('name');
      setGroups((data || []) as Group[]);
    };
    load();
  }, []);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const startEdit = (item: Item) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditQty(item.quantity ?? 1);
    setEditTags((item.tags || []).join(", "));
    setEditGroupId(item.group_id || "");
  };

  const cancel = () => {
    setEditingId(null);
    setEditName("");
    setEditQty(1);
    setEditTags("");
  };

  const save = async (id: string) => {
    const tags = editTags
      .split(",")
      .map(t => t.trim())
      .filter(Boolean);
    await supabase.from("items").update({ name: editName.trim(), quantity: editQty, tags, group_id: editGroupId || null }).eq("id", id);
    cancel();
    await onUpdated();
  };

  const deleteOnly = async (id: string) => {
    await supabase.from("items").delete().eq("id", id);
    setDeletingId(null);
    await onUpdated();
  };

  const deleteAndAddToShopping = async (id: string, name: string, qty: number | null) => {
    // Fetch item name/qty if needed
    const quantity = qty && qty > 0 ? qty : 1;
    // household_id is foreign on items; fetch item row to get it
    const { data } = await supabase.from("items").select("household_id").eq("id", id).maybeSingle();
    const householdId = (data as any)?.household_id;
    if (householdId) {
      await supabase.from("shopping_list").insert([{ household_id: householdId, item_name: name, quantity }]);
    }
    await supabase.from("items").delete().eq("id", id);
    setDeletingId(null);
    await onUpdated();
  };

  return (
    <ul className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden divide-y divide-gray-200">
      {items.map(it => (
          <li key={it.id} className="px-4 py-3">
          {editingId === it.id ? (
            <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
              <div className="flex-1">
                <label className="block text-sm mb-1 text-gray-800">Name</label>
                <input value={editName} onChange={e => setEditName(e.target.value)} className="w-full border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 rounded-lg px-3 py-2 bg-white outline-none transition text-gray-900" />
              </div>
              <div>
                <label className="block text-sm mb-1 text-gray-800">Qty</label>
                <input type="number" min={0} value={editQty} onChange={e => setEditQty(Number(e.target.value) || 0)} className="w-24 border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 rounded-lg px-3 py-2 bg-white outline-none transition text-gray-900" />
              </div>
              <div className="flex-1">
                <label className="block text-sm mb-1 text-gray-800">Tags (comma separated)</label>
                <input value={editTags} onChange={e => setEditTags(e.target.value)} className="w-full border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 rounded-lg px-3 py-2 bg-white outline-none transition text-gray-900 placeholder-gray-600" placeholder="e.g. pantry, canned" />
              </div>
              <div>
                <label className="block text-sm mb-1 text-gray-800">Group</label>
                <select value={editGroupId} onChange={e => setEditGroupId(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900">
                  <option value="">None</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => save(it.id)} className="px-3 py-2 rounded-md bg-green-600 text-white hover:bg-green-700">Save</button>
                <button type="button" onClick={cancel} className="px-3 py-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-gray-800">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-gray-900 font-medium">{it.name}</div>
                <div className="text-sm text-gray-700">Qty: {it.quantity ?? 0}</div>
                {it.group_id && (
                  <div className="text-xs text-gray-600">Group: { /* will be replaced by name via lookup below */ }
                    { /* simple inline lookup */ }
                    {(() => {
                      // this inline IIFE finds group name
                      const g = groups.find(g => g.id === it.group_id);
                      return g ? g.name : '—';
                    })()}
                  </div>
                )}
                {it.tags && it.tags.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {it.tags.map(tag => (
                      <span key={tag} className="text-xs bg-gray-100 border border-gray-200 text-gray-800 px-2 py-0.5 rounded-full">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                {deletingId === it.id ? (
                  <div className="flex gap-2">
                    <button type="button" onClick={() => deleteOnly(it.id)} className="px-3 py-2 rounded-md bg-red-600 text-white hover:bg-red-700">Delete only</button>
                    <button type="button" onClick={() => deleteAndAddToShopping(it.id, it.name, it.quantity ?? 1)} className="px-3 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700">Delete + add to list</button>
                    <button type="button" onClick={() => setDeletingId(null)} className="px-3 py-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-gray-800">Cancel</button>
                  </div>
                ) : (
                  <>
                    <button type="button" onClick={() => startEdit(it)} className="px-3 py-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-gray-800">Edit</button>
                    <button type="button" onClick={() => setDeletingId(it.id)} className="px-3 py-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-gray-800">Delete</button>
                  </>
                )}
              </div>
            </div>
          )}
        </li>
      ))}
      {items.length === 0 && (
        <li className="px-4 py-4 text-gray-700">No items yet — add your first one!</li>
      )}
    </ul>
  );
}


