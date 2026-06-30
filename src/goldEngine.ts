// src/goldEngine.ts
import { Card, TunnelCard, ActionCard } from './types';

export const canTransformCard = (card: Card, targetType: string, playerGold: number): { can: boolean; cost: number } => {
  // 1 золото:
  // - Обычный туннель -> Туннель с кристаллом
  // - Починка -> Поломка (и наоборот)
  // - Просмотр цели -> Просмотр роли
  // - Смена карт -> Смена роли
  if (targetType === 'crystal_tunnel' && card.type === 'tunnel' && !card.hasCrystal) {
    return { can: playerGold >= 1, cost: 1 };
  }
  if (targetType === 'repair_to_break' && card.type === 'action' && card.actionType === 'repair_tool') {
    return { can: playerGold >= 1, cost: 1 };
  }
  if (targetType === 'break_to_repair' && card.type === 'action' && card.actionType === 'break_tool') {
    return { can: playerGold >= 1, cost: 1 };
  }
  if (targetType === 'map_to_view_role' && card.type === 'action' && card.actionType === 'map') {
    return { can: playerGold >= 1, cost: 1 };
  }
  if (targetType === 'swap_cards_to_swap_roles' && card.type === 'action' && card.actionType === 'swap_cards') {
    return { can: playerGold >= 1, cost: 1 };
  }

  // 2 золота:
  // - Просмотр цели -> Смена роли
  // - Карточка туннеля -> Обвал
  if (targetType === 'map_to_swap_roles' && card.type === 'action' && card.actionType === 'map') {
    return { can: playerGold >= 2, cost: 2 };
  }
  if (targetType === 'tunnel_to_cave_in' && card.type === 'tunnel') {
    return { can: playerGold >= 2, cost: 2 };
  }

  return { can: false, cost: 0 };
};

export const transformCard = (card: Card, targetType: string): Card => {
  const newCard = { ...card };
  if (targetType === 'crystal_tunnel' && newCard.type === 'tunnel') {
    newCard.hasCrystal = true;
    newCard.name += ' 💎';
  } else if (targetType === 'repair_to_break' && newCard.type === 'action') {
    newCard.actionType = 'break_tool';
    newCard.toolType = newCard.toolType || 'pickaxe';
    newCard.name = `Сломанная кирка (Ресурс)`;
    newCard.description = 'Сломайте инструмент любому игроку.';
  } else if (targetType === 'break_to_repair' && newCard.type === 'action') {
    newCard.actionType = 'repair_tool';
    newCard.toolType = newCard.toolType || 'pickaxe';
    newCard.name = `Ремонт: Кирка (Ресурс)`;
    newCard.description = 'Почините инструмент себе или другому игроку.';
  } else if (targetType === 'map_to_view_role' && newCard.type === 'action') {
    newCard.actionType = 'view_role';
    newCard.name = 'Просмотр роли';
    newCard.description = 'Позволяет тайно подсмотреть карту роли другого игрока.';
  } else if (targetType === 'swap_cards_to_swap_roles' && newCard.type === 'action') {
    newCard.actionType = 'swap_roles';
    newCard.name = 'Смена роли';
    newCard.description = 'Смените свою или чужую роль на случайную из неиспользуемых.';
  } else if (targetType === 'map_to_swap_roles' && newCard.type === 'action') {
    newCard.actionType = 'swap_roles';
    newCard.name = 'Смена роли (Продвинутая)';
    newCard.description = 'Смените роль любого гнома на случайную.';
  } else if (targetType === 'tunnel_to_cave_in') {
    return {
      id: `transformed_cave_in_${Date.now()}`,
      type: 'action',
      actionType: 'cave_in',
      name: 'Созданный Обвал',
      description: 'Взорвите любой построенный туннель.',
    };
  }
  return newCard;
};