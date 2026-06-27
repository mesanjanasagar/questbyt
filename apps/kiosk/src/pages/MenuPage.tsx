import React, { useEffect, useState } from 'react';
import { useKioskStore } from '../store/kioskStore';
import { kioskAPI } from '../api/kiosk';
import { MenuItem, ModifierGroup } from '../types';

const STORE_ID = localStorage.getItem('storeId') || 'default-store';
const MENU_ID = localStorage.getItem('menuId') || 'default-menu';

const ItemModal: React.FC<{ item: MenuItem; onClose: () => void }> = ({ item, onClose }) => {
  const { addToCart } = useKioskStore();
  const [quantity, setQuantity] = useState(1);
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, string[]>>({});

  const toggleModifier = (groupId: string, modifierId: string, group: ModifierGroup) => {
    setSelectedModifiers((prev) => {
      const current = prev[groupId] ?? [];
      if (current.includes(modifierId)) {
        return { ...prev, [groupId]: current.filter((id) => id !== modifierId) };
      }
      if (current.length >= group.maxSelections) {
        return { ...prev, [groupId]: [...current.slice(1), modifierId] };
      }
      return { ...prev, [groupId]: [...current, modifierId] };
    });
  };

  const handleAddToCart = () => {
    const mods = item.modifierGroups.flatMap((g) =>
      (selectedModifiers[g.id] ?? []).map((modId) => {
        const mod = g.modifiers.find((m) => m.id === modId)!;
        return { modifierId: mod.id, name: mod.name, price: mod.price };
      })
    );
    addToCart(item, quantity, mods);
    onClose();
  };

  const modifierTotal = item.modifierGroups.flatMap((g) =>
    (selectedModifiers[g.id] ?? []).map((modId) => {
      const mod = g.modifiers.find((m) => m.id === modId);
      return mod?.price ?? 0;
    })
  ).reduce((s, p) => s + p, 0);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {item.imageUrl && (
          <img src={item.imageUrl} alt={item.name} className="w-full h-48 object-cover rounded-t-2xl" />
        )}
        <div className="p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{item.name}</h2>
              {item.description && <p className="text-gray-500 mt-1">{item.description}</p>}
            </div>
            <p className="text-2xl font-bold text-blue-700">${item.price.toFixed(2)}</p>
          </div>

          {item.modifierGroups.map((group) => (
            <div key={group.id}>
              <h3 className="font-semibold text-gray-800 mb-2">
                {group.name}
                {group.required && <span className="text-red-500 ml-1">*</span>}
              </h3>
              <div className="space-y-2">
                {group.modifiers.map((mod) => {
                  const selected = (selectedModifiers[group.id] ?? []).includes(mod.id);
                  return (
                    <button
                      key={mod.id}
                      onClick={() => toggleModifier(group.id, mod.id, group)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition text-left ${
                        selected
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <span className="font-medium text-gray-800">{mod.name}</span>
                      {mod.price > 0 && (
                        <span className="text-blue-700 font-semibold">+${mod.price.toFixed(2)}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Quantity */}
          <div className="flex items-center justify-center gap-6 py-2">
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="w-12 h-12 rounded-full bg-gray-100 hover:bg-gray-200 text-2xl font-bold flex items-center justify-center"
            >
              −
            </button>
            <span className="text-3xl font-bold w-12 text-center">{quantity}</span>
            <button
              onClick={() => setQuantity((q) => q + 1)}
              className="w-12 h-12 rounded-full bg-gray-100 hover:bg-gray-200 text-2xl font-bold flex items-center justify-center"
            >
              +
            </button>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-4 border-2 border-gray-300 rounded-xl font-bold text-gray-700 hover:bg-gray-50 text-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleAddToCart}
              className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-lg"
            >
              Add ${((item.price + modifierTotal) * quantity).toFixed(2)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const MenuPage: React.FC = () => {
  const {
    categories, menuItems, selectedCategory, selectedItem,
    setCategories, setMenuItems, setSelectedCategory, setSelectedItem, setStep,
    cart, cartTotal, cartCount,
  } = useKioskStore();

  useEffect(() => {
    kioskAPI.getCategories(MENU_ID).then((cats) => {
      setCategories(cats);
      if (cats.length > 0) setSelectedCategory(cats[0].id);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedCategory) return;
    kioskAPI.getMenuItems(MENU_ID, selectedCategory).then(setMenuItems).catch(console.error);
  }, [selectedCategory]);

  const count = cartCount();
  const total = cartTotal();

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm p-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Order Here</h1>
        <button
          onClick={() => setStep('cart')}
          disabled={count === 0}
          className="flex items-center gap-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white px-5 py-3 rounded-xl font-bold text-lg transition"
        >
          <span>🛒</span>
          <span>{count} items</span>
          <span>·</span>
          <span>${total.toFixed(2)}</span>
        </button>
      </header>

      {/* Category tabs */}
      <div className="bg-white border-b border-gray-200 overflow-x-auto">
        <div className="flex gap-1 p-3">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-5 py-3 rounded-xl font-semibold whitespace-nowrap text-sm transition ${
                selectedCategory === cat.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Menu Items grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {menuItems.filter((i) => i.available).map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedItem(item)}
              className="bg-white rounded-2xl border-2 border-gray-200 hover:border-blue-400 hover:shadow-lg transition-all text-left overflow-hidden"
            >
              {item.imageUrl ? (
                <img src={item.imageUrl} alt={item.name} className="w-full h-36 object-cover" />
              ) : (
                <div className="w-full h-36 bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center text-4xl">
                  🍽
                </div>
              )}
              <div className="p-3">
                <p className="font-bold text-gray-900 text-sm leading-tight">{item.name}</p>
                {item.description && (
                  <p className="text-gray-500 text-xs mt-1 line-clamp-2">{item.description}</p>
                )}
                <p className="text-blue-700 font-bold text-base mt-2">${item.price.toFixed(2)}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {selectedItem && (
        <ItemModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  );
};