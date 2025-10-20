"use client";
export default function AppNav({ inventoryName, subtitle, active, selector }: { inventoryName?: string; subtitle?: string; active: 'home' | 'shopping' | 'containers' | 'groups'; selector?: React.ReactNode }) {
  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <div className="text-2xl font-bold text-gray-900">{inventoryName || 'Inventory'}</div>
            {subtitle && <div className="text-sm text-gray-600">{subtitle}</div>}
          </div>
          {selector}
        </div>
        <a href="/manage" className="inline-flex items-center justify-center w-9 h-9 rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-gray-700" aria-label="Manage Inventories">⚙️</a>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2 flex gap-2">
        <a href="/home" className={`px-4 py-2 rounded-lg font-medium ${active === 'home' ? 'bg-blue-600 text-white' : 'text-gray-800 hover:bg-gray-100'}`}>Inventory</a>
        <a href="/shopping" className={`px-4 py-2 rounded-lg font-medium ${active === 'shopping' ? 'bg-blue-600 text-white' : 'text-gray-800 hover:bg-gray-100'}`}>Shopping</a>
        <a href="/containers" className={`px-4 py-2 rounded-lg font-medium ${active === 'containers' ? 'bg-blue-600 text-white' : 'text-gray-800 hover:bg-gray-100'}`}>Containers</a>
        <a href="/groups" className={`px-4 py-2 rounded-lg font-medium ${active === 'groups' ? 'bg-blue-600 text-white' : 'text-gray-800 hover:bg-gray-100'}`}>Groups</a>
      </div>
    </>
  );
}


