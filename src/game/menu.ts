import { businessOf, priceLevelOf } from './config';
import { BusinessId, GameState } from './types';

/**
 * The actual menu. Prices are live: they ride your price level, inflation,
 * and each product line you launch adds a new item to the board.
 */

interface MenuItemDef {
  name: string;
  mult: number; // price relative to the business's average ticket
}

const MENUS: Record<BusinessId, { heading: string; base: MenuItemDef[]; extras: MenuItemDef[] }> = {
  restaurant: {
    heading: 'Dinner Menu',
    base: [
      { name: 'Bruschetta', mult: 0.45 },
      { name: 'House Pasta', mult: 1.0 },
      { name: 'Grilled Salmon', mult: 1.35 },
      { name: 'Steak Frites', mult: 1.6 },
      { name: 'Tiramisu', mult: 0.5 },
    ],
    extras: [
      { name: 'Truffle Risotto', mult: 1.5 },
      { name: 'Weekend Brunch', mult: 1.1 },
      { name: 'Wine Pairing Flight', mult: 0.9 },
      { name: 'Catch of the Day', mult: 1.4 },
      { name: "Chef's Tasting Menu", mult: 2.2 },
    ],
  },
  convenience: {
    heading: 'In Store Today',
    base: [
      { name: 'Coffee to Go', mult: 0.35 },
      { name: 'Deli Sandwich', mult: 0.8 },
      { name: 'Snacks & Candy', mult: 0.3 },
      { name: 'Cold Six-Pack', mult: 1.3 },
      { name: 'Everyday Essentials', mult: 1.0 },
    ],
    extras: [
      { name: 'Fresh Produce Corner', mult: 0.9 },
      { name: 'Hot Food Counter', mult: 1.1 },
      { name: 'Local Goods Shelf', mult: 1.2 },
      { name: 'Pharmacy Basics', mult: 0.8 },
      { name: 'Lottery & Games', mult: 0.5 },
    ],
  },
  coffee: {
    heading: 'Drinks & Bites',
    base: [
      { name: 'Drip Coffee', mult: 0.4 },
      { name: 'Cappuccino', mult: 0.7 },
      { name: 'Latte', mult: 0.75 },
      { name: 'Cold Brew', mult: 0.8 },
      { name: 'Butter Croissant', mult: 0.55 },
    ],
    extras: [
      { name: 'Matcha Latte', mult: 0.85 },
      { name: 'Nitro Cold Brew', mult: 0.95 },
      { name: 'Seasonal Special', mult: 0.9 },
      { name: 'Affogato', mult: 0.8 },
      { name: 'Breakfast Sandwich', mult: 1.1 },
    ],
  },
  bakery: {
    heading: 'Fresh This Morning',
    base: [
      { name: 'Croissant', mult: 0.5 },
      { name: 'Baguette', mult: 0.55 },
      { name: 'Cinnamon Roll', mult: 0.65 },
      { name: 'Sourdough Loaf', mult: 1.0 },
      { name: 'Cookies (3)', mult: 0.45 },
    ],
    extras: [
      { name: 'Focaccia', mult: 0.9 },
      { name: 'Danish Box', mult: 1.4 },
      { name: 'Macarons (6)', mult: 1.6 },
      { name: 'Seasonal Pie', mult: 2.2 },
      { name: 'Celebration Cake', mult: 3.5 },
    ],
  },
  barber: {
    heading: 'Services',
    base: [
      { name: 'Classic Cut', mult: 1.0 },
      { name: 'Skin Fade', mult: 1.1 },
      { name: 'Beard Trim', mult: 0.5 },
      { name: 'Kids Cut', mult: 0.7 },
      { name: 'Hot Towel Shave', mult: 1.3 },
    ],
    extras: [
      { name: 'Head Massage Add-on', mult: 0.6 },
      { name: 'Color & Style', mult: 1.6 },
      { name: 'Grooming Products', mult: 0.8 },
      { name: 'Full Service Package', mult: 1.8 },
      { name: 'Monthly Membership', mult: 3.0 },
    ],
  },
};

export interface MenuLine {
  name: string;
  price: number;
  isNew: boolean;
}

export function currentMenu(s: GameState): { heading: string; lines: MenuLine[]; note: string } {
  const biz = businessOf(s.business);
  const def = MENUS[s.business];
  const unit = biz.baseTicket * priceLevelOf(s.priceLevel).mult * s.macro.cpi;
  const lines: MenuLine[] = [
    ...def.base.map((i) => ({ name: i.name, price: i.mult * unit, isNew: false })),
    ...def.extras.slice(0, s.productLines).map((i) => ({ name: i.name, price: i.mult * unit, isNew: true })),
  ];
  const level = priceLevelOf(s.priceLevel);
  const notes: Record<string, string> = {
    budget: 'Everyday low prices',
    value: 'Fair prices, honest portions',
    standard: 'The neighborhood standard',
    premium: 'Quality worth a little more',
    luxury: 'A finer experience',
  };
  return { heading: def.heading, lines, note: notes[level.id] };
}

export function formatPrice(p: number): string {
  return p >= 100 ? `$${Math.round(p)}` : `$${p.toFixed(2)}`;
}
