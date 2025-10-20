"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import HouseholdControls from "../../components/HouseholdControls";
import AppNav from "../../components/AppNav";
import GroupManager from "../../components/GroupManager";

type Household = { id: string; name: string };
type Group = { id: string; name: string };

export default function GroupsPage() {
  const [sessionUser, setSessionUser] = useState<{ id: string; email?: string | null } | null>(null);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("current_household_id") : null;
    if (saved) setHouseholdId(saved);
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user ?? null;
      if (user) {
        setSessionUser({ id: user.id, email: user.email });
        await loadHouseholds(user.id);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (!householdId || !sessionUser) return;
    loadGroups(householdId);
  }, [householdId, sessionUser]);

  const loadHouseholds = async (userId: string) => {
    const { data: memberRows } = await supabase
      .from("household_members")
      .select("household_id")
      .eq("user_id", userId);
    const ids = (memberRows || []).map((r: { household_id: string | null }) => r.household_id).filter((id): id is string => Boolean(id));
    if (ids.length === 0) { setHouseholds([]); return; }
    const { data: hs } = await supabase
      .from("households")
      .select("id,name")
      .in("id", ids);
    const list = (hs || []) as Household[];
    setHouseholds(list);
    const saved = typeof window !== "undefined" ? localStorage.getItem("current_household_id") : null;
    const initial = (saved && list.find(h => h.id === saved)) ? saved : (list[0]?.id ?? null);
    setHouseholdId(initial);
  };

  const loadGroups = async (hid: string) => {
    const { data } = await supabase
      .from("groups")
      .select("id,name")
      .eq("household_id", hid)
      .order("name");
    setGroups((data || []) as Group[]);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl w-full mx-auto flex flex-col gap-4">
        <AppNav
          inventoryName={households.find(h => h.id === householdId)?.name}
          subtitle="Groups"
          active="groups"
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
        <HouseholdControls
          households={households}
          householdId={householdId}
          onChange={(val) => {
            setHouseholdId(val);
            if (val && typeof window !== "undefined") localStorage.setItem("current_household_id", val);
          }}
        />
        {householdId ? (
          <GroupManager householdId={householdId} initialGroups={groups} />
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">Select an inventory to manage groups.</div>
        )}
      </div>
    </div>
  );
}


