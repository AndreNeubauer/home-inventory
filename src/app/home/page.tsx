"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ShoppingList from "../../components/ShoppingList";
import InventoryList from "../../components/InventoryList";
import NameInventoryForm from "../../components/NameInventoryForm";
import HouseholdManager from "../../components/HouseholdManager";
import AppNav from "../../components/AppNav";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type Item = {
  id: string;
  name: string;
  quantity: number | null;
  tags?: string[];
};

type Household = {
  id: string;
  name: string;
};

type Container = {
  id: string;
  name: string;
  location: string | null;
  color?: string | null;
};

export default function Home() {
  const router = useRouter();
  const [sessionUser, setSessionUser] = useState<{ id: string; email?: string | null } | null>(null);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState<number>(1);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [needsHouseholdName, setNeedsHouseholdName] = useState(false);
  const [inventoryName, setInventoryName] = useState("");
  const [activeTab, setActiveTab] = useState<"inventory" | "shopping" | "manage" | "containers" | "groups">("inventory");
  type ShoppingItem = { id: string; item_name: string; quantity: number; checked: boolean };
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [loadingShopping, setLoadingShopping] = useState(true);
  const [containers, setContainers] = useState<Container[]>([]);
  const [loadingContainers, setLoadingContainers] = useState(true);

  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : undefined);
    const t = params.get('tab');
    if (t === 'shopping') setActiveTab('shopping');
    const saved = typeof window !== "undefined" ? localStorage.getItem("current_household_id") : null;
    if (saved) setHouseholdId(saved);
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user ?? null;
      if (user) {
        setSessionUser({ id: user.id, email: user.email });
        const has = await checkHasHousehold(user.id);
        if (!has) {
          setNeedsHouseholdName(true);
          setInventoryName(user.email ? `${user.email.split("@")[0]}'s Inventory` : "My Inventory");
        } else {
          await loadHouseholds(user.id);
        }
      }
    };
    init();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, sess) => {
      const user = sess?.user ?? null;
      setSessionUser(user ? { id: user.id, email: user.email } : null);
      if (user) {
        const has = await checkHasHousehold(user.id);
        if (!has) {
          setNeedsHouseholdName(true);
          setInventoryName(user.email ? `${user.email.split("@")[0]}'s Inventory` : "My Inventory");
        } else {
          await loadHouseholds(user.id);
        }
      } else {
        setHouseholdId(null);
        setItems([]);
        setShoppingItems([]);
        setNeedsHouseholdName(false);
      }
    });

    return () => { sub.subscription.unsubscribe(); };
  }, []);

  // debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // reload items when selection or query changes (only after session ready)
  useEffect(() => {
    if (!householdId || !sessionUser) return;
    loadItems(householdId, debounced);
    loadShopping(householdId);
    loadContainers(householdId);
  }, [householdId, debounced, sessionUser]);

  // ensure fresh shopping list when switching to the tab
  useEffect(() => {
    if (activeTab === "shopping" && householdId && sessionUser) {
      loadShopping(householdId);
    }
  }, [activeTab, householdId, sessionUser]);

  // realtime updates for current inventory
  useEffect(() => {
    if (!householdId) return;
    const channel = supabase
      .channel(`home-${householdId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'items', filter: `household_id=eq.${householdId}` },
        () => { loadItems(householdId, debounced); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shopping_list', filter: `household_id=eq.${householdId}` },
        () => { loadShopping(householdId); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [householdId]);

  // ensure a selection exists when households load
  useEffect(() => {
    if (!householdId && households.length > 0) {
      const first = households[0].id;
      setHouseholdId(first);
      if (typeof window !== "undefined") localStorage.setItem("current_household_id", first);
    }
  }, [households, householdId]);

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({ provider: "google" });
  };

  const signOut = async () => {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("current_household_id");
      }
      await supabase.auth.signOut();
      setSessionUser(null);
      setHouseholdId(null);
      router.replace("/");
      if (typeof window !== "undefined") {
        window.location.assign("/");
      }
    } catch {
      // no-op
    }
  };

  // First-login helpers
  const checkHasHousehold = async (userId: string) => {
    const { count } = await supabase
      .from("household_members")
      .select("household_id", { count: "exact", head: true })
      .eq("user_id", userId);
    return (count ?? 0) > 0;
  };

  const createHouseholdWithName = async () => {
    if (!sessionUser) return;
    const name = inventoryName.trim() || "My Inventory";
    const { data: household, error } = await supabase
      .from("households")
      .insert([{ name }])
      .select()
      .single();
    if (!error && household) {
      await supabase
        .from("household_members")
        .insert([{ household_id: household.id, user_id: sessionUser.id, role: "owner" }]);
      setNeedsHouseholdName(false);
      await loadHouseholds(sessionUser.id);
    }
  };

  const loadHouseholds = async (userId: string) => {
    // step 1: get member household ids
    const { data: memberRows } = await supabase
      .from("household_members")
      .select("household_id")
      .eq("user_id", userId);
    const ids = (memberRows || []).map((r: { household_id: string | null }) => r.household_id).filter((id): id is string => Boolean(id));
    let list: Household[] = [];
    if (ids.length > 0) {
      const { data: hs } = await supabase
        .from("households")
        .select("id,name")
        .in("id", ids);
      list = (hs || []) as Household[];
    }
    setHouseholds(list);
    const saved = typeof window !== "undefined" ? localStorage.getItem("current_household_id") : null;
    const initial = (saved && list.find(h => h.id === saved)) ? saved : (list[0]?.id ?? null);
    setHouseholdId(initial);
    if (initial && sessionUser) {
      if (saved !== initial && typeof window !== "undefined") localStorage.setItem("current_household_id", initial);
      await loadItems(initial, debounced);
    }
  };

  const loadItems = async (hid: string, q?: string) => {
    setLoadingItems(true);
    const { data } = await supabase
      .from("items")
      .select("id,name,quantity,tags")
      .eq("household_id", hid)
      .ilike("name", q && q.length > 0 ? `%${q}%` : "%")
      .order("name");
    setItems(data || []);
    setLoadingItems(false);
  };

  const loadShopping = async (hid: string) => {
    setLoadingShopping(true);
    const { data } = await supabase
      .from("shopping_list")
      .select("id,item_name,quantity,checked")
      .eq("household_id", hid)
      .order("added_at", { ascending: false });
    setShoppingItems(data || []);
    setLoadingShopping(false);
  };

  const loadContainers = async (hid: string) => {
    setLoadingContainers(true);
    const { data } = await supabase
      .from("containers")
      .select("id,name,location,color")
      .eq("household_id", hid)
      .order("name");
    setContainers((data || []) as Container[]);
    setLoadingContainers(false);
  };

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!householdId || !newItemName.trim()) return;
    await supabase
      .from("items")
      .insert([{ household_id: householdId, name: newItemName.trim(), quantity: newItemQty }]);
    setNewItemName("");
    setNewItemQty(1);
    await loadItems(householdId, debounced);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl w-full mx-auto">
      {!sessionUser ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 flex flex-col items-center gap-6">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Home Inventory</h1>
          <button
            onClick={signInWithGoogle}
            className="px-5 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
          >
            Sign in with Google
          </button>
        </div>
      ) : needsHouseholdName ? (
        <NameInventoryForm
          userId={sessionUser.id}
          userEmail={sessionUser.email}
          onCreated={async () => { await loadHouseholds(sessionUser.id); }}
          onCancel={signOut}
        />
      ) : (
        <div className="flex flex-col gap-6">
          <AppNav
            inventoryName={households.find(h => h.id === householdId)?.name}
            subtitle={activeTab === "inventory" ? "Inventory" : activeTab === "shopping" ? "Shopping" : "Inventory"}
            active="home"
            selector={(
              <div className="min-w-[180px]">
                <select
                  value={householdId ?? ""}
                  onChange={e => {
                    const val = e.target.value || null;
                    setHouseholdId(val);
                    if (val && typeof window !== "undefined") localStorage.setItem("current_household_id", val);
                  }}
                  className="border border-gray-300 rounded-md px-2 py-1 text-sm text-gray-900"
                >
                  {households.map(h => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </div>
            )}
          />
          
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <label className="block text-sm mb-1 text-gray-800">Search</label>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search items"
              className="w-full border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 rounded-lg px-3 py-2 bg-white outline-none transition text-gray-900 placeholder-gray-600"
            />
          </div>
          {activeTab === "inventory" && householdId && (
            (loadingItems || loadingContainers) ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                </div>
              </div>
            ) : (
              <InventoryList householdId={householdId} initialItems={items} initialContainers={containers} refreshSignal={refreshKey} />
            )
          )}
          {activeTab === "manage" && (
            <HouseholdManager inventories={households} onChanged={async () => { if (sessionUser) await loadHouseholds(sessionUser.id); }} />
          )}
          {activeTab === "shopping" && householdId && (
            loadingShopping ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ) : (
              <ShoppingList householdId={householdId} initialItems={shoppingItems} onCompleted={() => setRefreshKey(k => k + 1)} />
            )
          )}
        </div>
      )}
      </div>
    </div>
  );
}


