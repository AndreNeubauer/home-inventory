"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Item = { id: string; name: string; quantity: number | null; tags?: string[]; container_id?: string | null };
type Container = { id: string; name: string; location?: string | null; color?: string | null };

function colorFromId(id: string): string {
  // Simple hash to hue
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 85%, 92%)`;
}

export default function InventoryList({ householdId, initialItems, initialContainers, refreshSignal }: { householdId: string; initialItems: Item[]; initialContainers?: Container[]; refreshSignal?: number }) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [name, setName] = useState("");
  const [qty, setQty] = useState<number>(1);
  const [containerId, setContainerId] = useState<string>("");
  const [containers, setContainers] = useState<Container[]>(initialContainers || []);
  const [filterContainerId, setFilterContainerId] = useState<string>("");
  const [addTags, setAddTags] = useState<string>("");
  const [existingTags, setExistingTags] = useState<string[]>([]);

  const reload = async () => {
    let query = supabase
      .from("items")
      .select("id,name,quantity,tags,container_id")
      .eq("household_id", householdId)
      .order("name");
    if (filterContainerId) {
      query = query.eq("container_id", filterContainerId);
    }
    const { data } = await query;
    setItems(data || []);
  };
  const reloadContainers = async () => {
    const { data } = await supabase
      .from("containers")
      .select("id,name,location,color")
      .eq("household_id", householdId)
      .order("name");
    setContainers((data || []) as Container[]);
  };
  useEffect(() => {
    reloadContainers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdId]);

  useEffect(() => {
    if (initialContainers && initialContainers.length) {
      setContainers(initialContainers);
    }
  }, [initialContainers]);

  // derive existing tags from current items
  useEffect(() => {
    const set = new Set<string>();
    for (const it of items) {
      if (it.tags) {
        for (const t of it.tags) set.add(t);
      }
    }
    setExistingTags(Array.from(set).sort((a, b) => a.localeCompare(b)));
  }, [items]);
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
    const tags = addTags
      .split(",")
      .map(t => t.trim())
      .filter(Boolean);
    await supabase.from("items").insert([{ household_id: householdId, name: name.trim(), quantity: qty, container_id: containerId || null, tags }]);
    setName("");
    setQty(1);
    setContainerId("");
    setAddTags("");
    await reload();
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-800">Filter by container</label>
          <select value={filterContainerId} onChange={e => { setFilterContainerId(e.target.value); void reload(); }} className="border border-gray-300 rounded-md px-2 py-1 text-sm text-gray-900">
            <option value="">All</option>
            {containers.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>
      <form onSubmit={add} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 grid grid-cols-1 sm:grid-cols-6 gap-3 items-end">
        <div className="flex-1">
          <label className="block text-sm mb-1 text-gray-800">Item name</label>
          <input value={name} onChange={e => setName(e.target.value)} className="w-full border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 rounded-lg px-3 py-2 bg-white outline-none transition text-gray-900 placeholder-gray-600" placeholder="e.g. Ketchup" required />
        </div>
        <div>
          <label className="block text-sm mb-1 text-gray-800">Qty</label>
          <input type="number" min={1} value={qty} onChange={e => setQty(Number(e.target.value) || 1)} className="w-24 border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 rounded-lg px-3 py-2 bg-white outline-none transition text-gray-900" />
        </div>
        <div>
          <label className="block text-sm mb-1 text-gray-800">Container</label>
          <select value={containerId} onChange={e => setContainerId(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900">
            <option value="">None</option>
            {containers.map(c => (
              <option key={c.id} value={c.id}>{c.name}{c.location ? ` — ${c.location}` : ''}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm mb-1 text-gray-800">Tags (comma separated)</label>
          <input
            list="tag-options"
            value={addTags}
            onChange={e => setAddTags(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
            placeholder="e.g. pantry, canned"
          />
          <datalist id="tag-options">
            {existingTags.map(tag => (
              <option key={tag} value={tag} />
            ))}
          </datalist>
        </div>
        <button type="submit" className="h-[40px] px-4 rounded-md bg-green-600 text-white font-semibold hover:bg-green-700 transition">Add</button>
      </form>
      <EditableList items={items} onUpdated={reload} containers={containers} />
    </div>
  );
}

function EditableList({ items, onUpdated, containers: allContainers }: { items: Item[]; onUpdated: () => Promise<void> | void; containers: Container[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editQty, setEditQty] = useState<number>(1);
  const [editTags, setEditTags] = useState("");
  const [editContainerId, setEditContainerId] = useState<string>("");
  const [containersLocal, setContainersLocal] = useState<Container[]>(allContainers);

  useEffect(() => {
    const load = async () => {
      // derive household from any item if available by joining? Not available here; rely on selection form setting earlier component state.
      // As a fallback, just load all groups user can see (will be scoped by RLS to their households).
      const { data } = await supabase.from('containers').select('id,name,location,color').order('name');
      setContainersLocal((data || []) as Container[]);
    };
    load();
  }, []);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const startEdit = (item: Item) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditQty(item.quantity ?? 1);
    setEditTags((item.tags || []).join(", "));
    setEditContainerId(item.container_id || "");
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
    await supabase.from("items").update({ name: editName.trim(), quantity: editQty, tags, container_id: editContainerId || null }).eq("id", id);
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
    const householdId = (data as { household_id: string } | null)?.household_id;
    if (householdId) {
      await supabase.from("shopping_list").insert([{ household_id: householdId, item_name: name, quantity }]);
    }
    await supabase.from("items").delete().eq("id", id);
    setDeletingId(null);
    await onUpdated();
  };

  return (
    <ul className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden divide-y divide-gray-200">
      {items
        .slice()
        .sort((a, b) => (a.container_id || '') .localeCompare(b.container_id || '') || a.name.localeCompare(b.name))
        .map(it => {
          const c = (allContainers.length ? allContainers : containersLocal).find(c => c.id === it.container_id);
          const bg = c?.color || (it.container_id ? colorFromId(it.container_id) : undefined);
          return (
        <li key={it.id} className="px-4 py-3" style={bg ? { backgroundColor: bg } : undefined}>
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
                <input
                  list="tag-options"
                  value={editTags}
                  onChange={e => setEditTags(e.target.value)}
                  className="w-full border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 rounded-lg px-3 py-2 bg-white outline-none transition text-gray-900 placeholder-gray-600"
                  placeholder="e.g. pantry, canned"
                />
              </div>
              <div>
                <label className="block text-sm mb-1 text-gray-800">Container</label>
                <select value={editContainerId} onChange={e => setEditContainerId(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900">
                  <option value="">None</option>
                  {(allContainers.length ? allContainers : containersLocal).map(cc => (
                    <option key={cc.id} value={cc.id}>{cc.name}{cc.location ? ` — ${cc.location}` : ''}</option>
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
                {it.container_id && (
                  <div className="text-xs text-gray-600">Container: {c ? (c.location ? `${c.name} — ${c.location}` : c.name) : '—'}</div>
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
          );
        })}
      {items.length === 0 && (
        <li className="px-4 py-4 text-gray-700">No items yet — add your first one!</li>
      )}
    </ul>
  );
}


