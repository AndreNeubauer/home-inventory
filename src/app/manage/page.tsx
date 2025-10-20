"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import HouseholdManager from "../../components/HouseholdManager";

type Household = { id: string; name: string };

export default function ManagePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [households, setHouseholds] = useState<Household[]>([]);

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
        <h1 className="text-2xl font-bold text-gray-900">Manage Inventories</h1>
        {userId ? (
          <HouseholdManager inventories={households} onChanged={() => loadHouseholds(userId)} />
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">Sign in required.</div>
        )}
      </div>
    </div>
  );
}


