// src/goldEngine.ts
import { Card, TunnelCard, ActionCard } from './types';

function canTransformCard(card: Card, targetType: string, playerGold: number): { can: boolean; cost: number } {
  // Безопасное сужение типа для карт туннелей
  if (card.type === 'tunnel') {
    const tunnel = card as TunnelCard;
    if (targetType === 'crystal_tunnel' && !tunnel.hasCrystal) {
      return { can: playerGold >= 1, cost: 1 };
    }
    if (targetType === 'tunnel_to_cave_in') {
      return { can: playerGold >= 2, cost: 2 };
    }
  }

  // Безопасное сужение типа для карт действий
  if (card.type === 'action') {
    const action = card as ActionCard;
    if (targetType === 'repair_to_break' && action.actionType === 'repair_tool') {
      return { can: playerGold >= 1, cost: 1 };
    }
    if (targetType === 'break_to_repair' && action.actionType === 'break_tool') {
      return { can: playerGold >= 1, cost: 1 };
    }
    if (targetType === 'map_to_view_role' && action.actionType === 'map') {
      return { can: playerGold >= 1, cost: 1 };
    }
    if (targetType === 'swap_cards_to_swap_roles' && action.actionType === 'swap_cards') {
      return { can: playerGold >= 1, cost: 1 };
    }
    if (targetType === 'map_to_swap_roles' && action.actionType === 'map') {
      return { can: playerGold >= 2, cost: 2 };
    }
  }

  return { can: false, cost: 0 };
}

function transformCard(card: Card, targetType: string): Card {
  // Копируем исходный объект
  const newCard = { ...card };

  if (newCard.type === 'tunnel') {
    const tunnel = newCard as TunnelCard;
    if (targetType === 'crystal_tunnel') {
      tunnel.hasCrystal = true;
      tunnel.name += ' 💎';
    } else if (targetType === 'tunnel_to_cave_in') {
      return {
        id: `transformed_cave_in_${Date.now()}`,
        type: 'action',
        actionType: 'cave_in',
        name: 'Созданный Обвал',
        description: 'Взорвите любой построенный туннель.',
      } as ActionCard;
    }
  }

  if (newCard.type === 'action') {
    const action = newCard as ActionCard;
    if (targetType === 'repair_to_break') {
      action.actionType = 'break_tool';
      action.toolType = action.toolType || 'pickaxe';
      action.name = `Сломанная кирка (Ресурс)`;
      action.description = 'Сломайте инструмент любому игроку.';
    } else if (targetType === 'break_to_repair') {
      action.actionType = 'repair_tool';
      action.toolType = action.toolType || 'pickaxe';
      action.name = `Ремонт: Кирка (Ресурс)`;
      action.description = 'Почините инструмент у себя или другого игрока.';
    } else if (targetType === 'map_to_view_role') {
      action.actionType = 'view_role';
      action.name = 'Просмотр роли';
      action.description = 'Позволяет тайно подсмотреть карту роли другого игрока.';
    } else if (targetType === 'swap_cards_to_swap_roles') {
      action.actionType = 'swap_roles';
      action.name = 'Смена роли';
      action.description = 'Смените свою или чужую роль на случайную из неиспользуемых.';
    } else if (targetType === 'map_to_swap_roles') {
      action.actionType = 'swap_roles';
      action.name = 'Смена роли (Продвинутая)';
      action.description = 'Смените роль любого гнома на случайную.';
    }
  }

  return newCard;
}

// Явный именованный экспорт для корректной работы Rollup/Vite
export { canTransformCard, transformCard };