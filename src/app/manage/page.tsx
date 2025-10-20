"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import HouseholdManager from "../../components/HouseholdManager";
import AppNav from "../../components/AppNav";

type Household = { id: string; name: string };

export default function ManagePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [households, setHouseholds] = useState<Household[]>([]);
  const signOut = async () => {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("current_household_id");
      }
      await supabase.auth.signOut();
      window.location.assign("/");
    } catch {}
  };
  

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user ?? null;
      if (user) {
        setUserId(user.id);
        await loadHouseholds(user.id);
      }
    };
    init();
  }, []);

  const loadHouseholds = async (uid: string) => {
    const { data: memberRows } = await supabase
      .from("household_members")
      .select("household_id")
      .eq("user_id", uid);
    const ids = (memberRows || []).map((r: { household_id: string | null }) => r.household_id).filter((id): id is string => Boolean(id));
    if (ids.length === 0) { setHouseholds([]); return; }
    const { data: hs } = await supabase
      .from("households")
      .select("id,name")
      .in("id", ids);
    setHouseholds((hs || []) as Household[]);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl w-full mx-auto flex flex-col gap-4">
        <AppNav
          inventoryName={households.find(h => h.id === userId) ? households.find(h => h.id === userId)?.name : undefined}
          subtitle="Manage"
          active="home"
          selector={(
            <div className="min-w-[180px]">
              <select
                value={/* use current selection if present */ (typeof window !== 'undefined' ? (localStorage.getItem('current_household_id') || '') : '')}
                onChange={e => {
                  const val = e.target.value || null;
                  if (val && typeof window !== 'undefined') localStorage.setItem('current_household_id', val);
                  // trigger reloads if needed
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
        <div className="flex items-center justify-end">
          <button type="button" onClick={signOut} className="px-3 py-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-gray-800 font-medium transition">Sign out</button>
        </div>
        {userId ? (
          <HouseholdManager inventories={households} onChanged={() => loadHouseholds(userId)} />
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">Sign in required.</div>
        )}
      </div>
    </div>
  );
}


