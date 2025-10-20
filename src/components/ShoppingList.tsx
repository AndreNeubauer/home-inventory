"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type ShoppingItem = { id: string; item_name: string; quantity: number; checked: boolean };

export default function ShoppingList({ householdId, initialItems, onCompleted }: { householdId: string; initialItems: ShoppingItem[]; onCompleted?: () => void }) {
  const [items, setItems] = useState<ShoppingItem[]>(initialItems);
  const [newName, setNewName] = useState("");
  const [newQty, setNewQty] = useState<number>(1);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [completeQty, setCompleteQty] = useState<number>(1);
  const [completeDate, setCompleteDate] = useState<string>("");
  const [completeTags, setCompleteTags] = useState<string>("");

  const reload = async () => {
    const { data } = await supabase
      .from("shopping_list")
      .select("id,item_name,quantity,checked")
      .eq("household_id", householdId)
      .order("added_at", { ascending: false });
    setItems(data || []);
  };
  // live updates with cleanup
  useEffect(() => {
    if (!householdId) return;
    const channel = supabase
      .channel(`shopping-${householdId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_list', filter: `household_id=eq.${householdId}` }, reload)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [householdId]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    await supabase.from("shopping_list").insert([{ household_id: householdId, item_name: newName.trim(), quantity: newQty }]);
    setNewName("");
    setNewQty(1);
    await reload();
    onCompleted && onCompleted();
  };

  const toggle = async (id: string, checked: boolean) => {
    await supabase.from("shopping_list").update({ checked }).eq("id", id);
    await reload();
    onCompleted && onCompleted();
  };

  const remove = async (id: string) => {
    await supabase.from("shopping_list").delete().eq("id", id);
    await reload();
    onCompleted && onCompleted();
  };

  const completeToInventory = async (si: ShoppingItem) => {
    // Prepare data from form
    const qty = completeQty > 0 ? completeQty : (si.quantity || 1);
    const tags = completeTags
      .split(",")
      .map(t => t.trim())
      .filter(Boolean);
    const expiration = completeDate ? completeDate : null;

    // Try to find existing item by name (case-insensitive)
    const { data: existing } = await supabase
      .from("items")
      .select("id,quantity,tags")
      .eq("household_id", householdId)
      .ilike("name", si.item_name)
      .limit(1);

    if (existing && existing.length > 0) {
      const current = existing[0] as { id: string; quantity: number | null; tags: string[] | null };
      const mergedTags = Array.from(new Set([...(current.tags || []), ...tags]));
      await supabase
        .from("items")
        .update({
          quantity: (current.quantity || 0) + qty,
          tags: mergedTags,
          ...(expiration ? { expiration_date: expiration } : {}),
        })
        .eq("id", current.id);
    } else {
      await supabase
        .from("items")
        .insert([{ household_id: householdId, name: si.item_name, quantity: qty, tags, ...(expiration ? { expiration_date: expiration } : {}) }]);
    }

    // Remove from shopping list
    await supabase.from("shopping_list").delete().eq("id", si.id);
    setCompletingId(null);
    setCompleteQty(1);
    setCompleteDate("");
    setCompleteTags("");
    await reload();
  };

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={add} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex gap-3 items-end">
        <div className="flex-1">
          <label className="block text-sm mb-1 text-gray-800">Item name</label>
          <input value={newName} onChange={e => setNewName(e.target.value)} className="w-full border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 rounded-lg px-3 py-2 bg-white outline-none transition text-gray-900 placeholder-gray-600" placeholder="e.g. Milk" required />
        </div>
        <div>
          <label className="block text-sm mb-1 text-gray-800">Qty</label>
          <input type="number" min={1} value={newQty} onChange={e => setNewQty(Number(e.target.value) || 1)} className="w-24 border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 rounded-lg px-3 py-2 bg-white outline-none transition text-gray-900" />
        </div>
        <button type="submit" className="h-[40px] px-4 rounded-md bg-blue-600 text-white font-semibold hover:bg-blue-700 transition">Add</button>
      </form>
      <ul className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden divide-y divide-gray-200">
        {items.map(si => (
          <li key={si.id} className="px-4 py-3 hover:bg-gray-50 transition">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={si.checked}
                onChange={(e) => toggle(si.id, e.target.checked)}
                className="h-4 w-4"
              />
              <span className={`flex-1 ${si.checked ? "line-through text-gray-500" : "text-gray-900"}`}>{si.item_name}</span>
              <span className="text-sm text-gray-700 w-8 text-right">{si.quantity}</span>
              {completingId === si.id ? (
                <>
                  <button type="button" onClick={() => setCompletingId(null)} className="px-2 py-1 rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-gray-800">Cancel</button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => { setCompletingId(si.id); setCompleteQty(si.quantity || 1); }} className="px-2 py-1 rounded-md bg-green-600 text-white hover:bg-green-700">Done</button>
                  <button type="button" onClick={() => remove(si.id)} className="px-2 py-1 rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-gray-800">Delete</button>
                </>
              )}
            </div>
            {completingId === si.id && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-sm mb-1 text-gray-800">Quantity</label>
                  <input type="number" min={1} value={completeQty} onChange={e => setCompleteQty(Number(e.target.value) || 1)} className="w-full border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 rounded-lg px-3 py-2 bg-white outline-none transition text-gray-900" />
                </div>
                <div>
                  <label className="block text-sm mb-1 text-gray-800">Expiration</label>
                  <input type="date" value={completeDate} onChange={e => setCompleteDate(e.target.value)} className="w-full border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 rounded-lg px-3 py-2 bg-white outline-none transition text-gray-900" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm mb-1 text-gray-800">Tags (comma separated)</label>
                  <input value={completeTags} onChange={e => setCompleteTags(e.target.value)} className="w-full border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 rounded-lg px-3 py-2 bg-white outline-none transition text-gray-900 placeholder-gray-600" placeholder="e.g. dairy, fridge" />
                </div>
                <div className="sm:col-span-4 flex gap-2">
                  <button type="button" onClick={() => completeToInventory(si)} className="px-3 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700">Add to inventory</button>
                </div>
              </div>
            )}
          </li>
        ))}
        {items.length === 0 && (
          <li className="px-4 py-4 text-gray-700">No shopping items yet — add one!</li>
        )}
      </ul>
    </div>
  );
}


