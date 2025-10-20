"use client";
export default function HouseholdControls({ households, householdId, onChange }: {
  households: { id: string; name: string }[];
  householdId: string | null;
  onChange: (id: string | null) => void;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <label className="block text-sm mb-1 text-gray-800">Inventory</label>
      <select
        value={householdId ?? ""}
        onChange={e => {
          const val = e.target.value || null;
          onChange(val);
        }}
        className="w-full border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 rounded-lg px-3 py-2 bg-white outline-none transition text-gray-900"
      >
        {households.map(h => (
          <option key={h.id} value={h.id}>{h.name}</option>
        ))}
      </select>
    </div>
  );
}


