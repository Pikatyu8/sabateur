// src/gameEngine.ts
import { Card, TunnelCard, ActionCard, PlacedCard, ToolType } from './types';

export const getOpposingDir = (dir: 'top' | 'right' | 'bottom' | 'left'): 'top' | 'right' | 'bottom' | 'left' => {
  const map: Record<string, 'top' | 'right' | 'bottom' | 'left'> = {
    top: 'bottom',
    bottom: 'top',
    left: 'right',
    right: 'left',
  };
  return map[dir];
};

export const createTunnelDeck = (): TunnelCard[] => {
  const cards: TunnelCard[] = [];

  const defs: {
    name: string;
    exits: { top: boolean; right: boolean; bottom: boolean; left: boolean };
    connectedParts: ('top' | 'right' | 'bottom' | 'left')[][];
    count: number;
    hasCrystal?: boolean;
  }[] = [
    { name: 'Перекресток', exits: { top: true, right: true, bottom: true, left: true }, connectedParts: [['top', 'right', 'bottom', 'left']], count: 5 },
    { name: 'Т-образный (Без верха)', exits: { top: false, right: true, bottom: true, left: true }, connectedParts: [['left', 'right', 'bottom']], count: 5 },
    { name: 'Т-образный (Без права)', exits: { top: true, right: false, bottom: true, left: true }, connectedParts: [['left', 'top', 'bottom']], count: 5 },
    { name: 'Прямой (Влево-Вправо)', exits: { top: false, right: true, bottom: false, left: true }, connectedParts: [['left', 'right']], count: 4 },
    { name: 'Прямой (Вверх-Вниз)', exits: { top: true, right: false, bottom: true, left: false }, connectedParts: [['top', 'bottom']], count: 4 },
    { name: 'Поворот (Вверх-Вправо)', exits: { top: true, right: true, bottom: false, left: false }, connectedParts: [['top', 'right']], count: 5 },
    { name: 'Поворот (Вниз-Вправо)', exits: { top: false, right: true, bottom: true, left: false }, connectedParts: [['bottom', 'right']], count: 5 },
    // Тупики
    { name: 'Тупиковый перекресток', exits: { top: true, right: true, bottom: true, left: true }, connectedParts: [['top'], ['right'], ['bottom'], ['left']], count: 1 },
    { name: 'Тупиковый Т-образный', exits: { top: false, right: true, bottom: true, left: true }, connectedParts: [['left'], ['right'], ['bottom']], count: 1 },
    { name: 'Тупиковый Т-образный (Сверху)', exits: { top: true, right: false, bottom: true, left: true }, connectedParts: [['left'], ['top'], ['bottom']], count: 1 },
    { name: 'Тупиковый прямой', exits: { top: false, right: true, bottom: false, left: true }, connectedParts: [['left'], ['right']], count: 1 },
    { name: 'Тупиковый прямой (Вверх)', exits: { top: true, right: false, bottom: true, left: false }, connectedParts: [['top'], ['bottom']], count: 1 },
    { name: 'Тупиковый поворот', exits: { top: true, right: true, bottom: false, left: false }, connectedParts: [['top'], ['right']], count: 1 },
    { name: 'Тупиковый поворот (Вниз)', exits: { top: false, right: true, bottom: true, left: false }, connectedParts: [['bottom'], ['right']], count: 1 },
    { name: 'Тупик (Влево)', exits: { top: false, right: false, bottom: false, left: true }, connectedParts: [['left']], count: 1 },
    { name: 'Тупик (Вверх)', exits: { top: true, right: false, bottom: false, left: false }, connectedParts: [['top']], count: 1 },
  ];

  let idCounter = 1;
  for (const def of defs) {
    for (let i = 0; i < def.count; i++) {
      // Каждый пятый туннель снабжаем кристаллом для Геологов
      const crystalChance = (idCounter % 5 === 0);
      cards.push({
        id: `tunnel_${idCounter++}`,
        type: 'tunnel',
        name: def.name + (crystalChance ? ' 💎' : ''),
        exits: { ...def.exits },
        connectedParts: def.connectedParts.map(p => [...p]),
        hasCrystal: crystalChance,
      });
    }
  }

  return cards;
};

export const createActionDeck = (): ActionCard[] => {
  const cards: ActionCard[] = [];
  let idCounter = 1;

  const brokenTools: ToolType[] = ['lamp', 'cart', 'pickaxe'];
  const toolNamesRu: Record<ToolType, string> = { lamp: 'Фонарь', cart: 'Вагонетка', pickaxe: 'Кирка' };

  // Поломка инструментов
  for (const tool of brokenTools) {
    for (let i = 0; i < 3; i++) {
      cards.push({
        id: `action_break_${tool}_${idCounter++}`,
        type: 'action',
        actionType: 'break_tool',
        toolType: tool,
        name: `Сломанный инструмент: ${toolNamesRu[tool]}`,
        description: `Сломайте ${toolNamesRu[tool]} сопернику.`,
      });
    }
  }

  // Починка инструментов
  for (const tool of brokenTools) {
    for (let i = 0; i < 2; i++) {
      cards.push({
        id: `action_repair_${tool}_${idCounter++}`,
        type: 'action',
        actionType: 'repair_tool',
        toolType: tool,
        name: `Ремонт: ${toolNamesRu[tool]}`,
        description: `Почините инструмент у себя или друга.`,
      });
    }
  }

  // Двойные карты починки
  const dualRepairs: { types: ToolType[]; name: string }[] = [
    { types: ['lamp', 'pickaxe'], name: 'Ремонт: Фонарь или Кирка' },
    { types: ['lamp', 'cart'], name: 'Ремонт: Фонарь или Вагонетка' },
    { types: ['cart', 'pickaxe'], name: 'Ремонт: Вагонетка или Кирка' },
  ];
  for (const dual of dualRepairs) {
    cards.push({
      id: `action_repair_dual_${idCounter++}`,
      type: 'action',
      actionType: 'repair_tool',
      repairTypes: dual.types,
      name: dual.name,
      description: `Почините один из двух инструментов.`,
    });
  }

  // Обвалы (3 шт)
  for (let i = 0; i < 3; i++) {
    cards.push({
      id: `action_cavein_${idCounter++}`,
      type: 'action',
      actionType: 'cave_in',
      name: 'Обвал',
      description: 'Уничтожьте любую карту туннеля на поле.',
    });
  }

  // Секретные карты (4 шт)
  for (let i = 0; i < 4; i++) {
    cards.push({
      id: `action_map_${idCounter++}`,
      type: 'action',
      actionType: 'map',
      name: 'Секретная карта',
      description: 'Подсмотрите одну из карт целей.',
    });
  }

  // --- КАРТЫ ИЗ SABOTEUR 2 ---
  // Просмотр роли (2 шт)
  for (let i = 0; i < 2; i++) {
    cards.push({
      id: `action_view_role_${idCounter++}`,
      type: 'action',
      actionType: 'view_role',
      name: 'Узнать роль',
      description: 'Секретно подсмотрите карту роли другого гнома.',
    });
  }

  // Смена роли (2 шт)
  for (let i = 0; i < 2; i++) {
    cards.push({
      id: `action_swap_roles_${idCounter++}`,
      type: 'action',
      actionType: 'swap_roles',
      name: 'Смена роли',
      description: 'Позволяет сменить роль (в том числе себе) на случайную из неиспользуемых.',
    });
  }

  // Обмен картами рук (2 шт)
  for (let i = 0; i < 2; i++) {
    cards.push({
      id: `action_swap_cards_${idCounter++}`,
      type: 'action',
      actionType: 'swap_cards',
      name: 'Сговор (Обмен картами)',
      description: 'Поменяйтесь картами на руках с выбранным игроком.',
    });
  }

  // Крестики-нолики на 15 секунд (1 шт)
  cards.push({
    id: `action_ttt_15_${idCounter++}`,
    type: 'action',
    actionType: 'tic_tac_toe',
    name: 'Дуэль на время (15 сек)',
    description: 'Вызовите соперника на дуэль в крестики-нолики за 3 золота!',
    tttDuration: 15,
  });

  // Крестики-нолики на 30 секунд (1 шт)
  cards.push({
    id: `action_ttt_30_${idCounter++}`,
    type: 'action',
    actionType: 'tic_tac_toe',
    name: 'Дуэль на время (30 сек)',
    description: 'Вызовите соперника на дуэль в крестики-нолики за 3 золота!',
    tttDuration: 30,
  });

  return cards;
};

export const createFullDeck = (): Card[] => {
  const deck: Card[] = [...createTunnelDeck(), ...createActionDeck()];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
};

export const getEntranceCard = (): TunnelCard => {
  return {
    id: 'entrance',
    type: 'tunnel',
    name: 'Вход в шахту',
    exits: { top: true, right: true, bottom: true, left: true },
    connectedParts: [['top', 'right', 'bottom', 'left']],
  };
};

export const getGoalTemplates = (): { isGold: boolean; card: TunnelCard }[] => {
  const goldCard: TunnelCard = {
    id: 'goal_gold',
    type: 'tunnel',
    name: 'Золотая жила (Золото!)',
    exits: { top: true, right: true, bottom: true, left: true },
    connectedParts: [['top', 'right', 'bottom', 'left']],
  };

  const stoneCard1: TunnelCard = {
    id: 'goal_stone_1',
    type: 'tunnel',
    name: 'Обычный камень',
    exits: { top: true, right: true, bottom: true, left: true },
    connectedParts: [['top', 'right', 'bottom', 'left']],
  };

  const stoneCard2: TunnelCard = {
    id: 'goal_stone_2',
    type: 'tunnel',
    name: 'Обычный камень',
    exits: { top: true, right: true, bottom: true, left: true },
    connectedParts: [['top', 'right', 'bottom', 'left']],
  };

  const goals = [
    { isGold: true, card: goldCard },
    { isGold: false, card: stoneCard1 },
    { isGold: false, card: stoneCard2 },
  ];

  for (let i = goals.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [goals[i], goals[j]] = [goals[j], goals[i]];
  }

  return goals;
};

export const getRotatedExitsAndConnections = (placedCard: PlacedCard) => {
  const { card, rotated } = placedCard;
  if (!rotated) {
    return { exits: card.exits, connectedParts: card.connectedParts };
  }

  const exits = {
    top: card.exits.bottom,
    bottom: card.exits.top,
    left: card.exits.right,
    right: card.exits.left,
  };

  const rotateDir = (dir: 'top' | 'right' | 'bottom' | 'left'): 'top' | 'right' | 'bottom' | 'left' => {
    if (dir === 'top') return 'bottom';
    if (dir === 'bottom') return 'top';
    if (dir === 'left') return 'right';
    return 'left';
  };

  const connectedParts = card.connectedParts.map(part => part.map(rotateDir));
  return { exits, connectedParts };
};

export const calculateReachability = (grid: Record<string, PlacedCard>) => {
  const visited = new Set<string>();
  const reachedCoords = new Set<string>();
  const queue: { x: number; y: number; incoming: 'top' | 'right' | 'bottom' | 'left' | 'start' }[] = [];

  queue.push({ x: 0, y: 0, incoming: 'start' });

  while (queue.length > 0) {
    const curr = queue.shift()!;
    const coordKey = `${curr.x},${curr.y}`;
    const visitKey = `${curr.x},${curr.y},${curr.incoming}`;

    if (visited.has(visitKey)) continue;
    visited.add(visitKey);
    reachedCoords.add(coordKey);

    const placed = grid[coordKey];
    if (!placed) continue;
    if (placed.isGoal && !placed.flipped) continue;

    const { exits, connectedParts } = getRotatedExitsAndConnections(placed);

    if (curr.incoming === 'start') {
      const dirs: ('top' | 'right' | 'bottom' | 'left')[] = ['top', 'right', 'bottom', 'left'];
      for (const dir of dirs) {
        if (exits[dir]) {
          let nx = curr.x;
          let ny = curr.y;
          if (dir === 'top') ny -= 1;
          else if (dir === 'bottom') ny += 1;
          else if (dir === 'left') nx -= 1;
          else if (dir === 'right') nx += 1;

          const neighborKey = `${nx},${ny}`;
          const neighbor = grid[neighborKey];
          if (neighbor) {
            const neighborInfo = getRotatedExitsAndConnections(neighbor);
            const opposing = getOpposingDir(dir);
            if (neighborInfo.exits[opposing]) {
              queue.push({ x: nx, y: ny, incoming: opposing });
            }
          }
        }
      }
    } else {
      const incomingDir = curr.incoming as 'top' | 'right' | 'bottom' | 'left';
      const connectedPart = connectedParts.find(part => part.includes(incomingDir));
      if (connectedPart) {
        for (const outDir of connectedPart) {
          if (outDir === incomingDir) continue;

          let nx = curr.x;
          let ny = curr.y;
          if (outDir === 'top') ny -= 1;
          else if (outDir === 'bottom') ny += 1;
          else if (outDir === 'left') nx -= 1;
          else if (outDir === 'right') nx += 1;

          const neighborKey = `${nx},${ny}`;
          const neighbor = grid[neighborKey];
          if (neighbor) {
            const neighborInfo = getRotatedExitsAndConnections(neighbor);
            const opposing = getOpposingDir(outDir);
            if (neighborInfo.exits[opposing]) {
              queue.push({ x: nx, y: ny, incoming: opposing });
            }
          }
        }
      }
    }
  }

  return reachedCoords;
};

export const validateTunnelPlacement = (
  grid: Record<string, PlacedCard>,
  card: TunnelCard,
  x: number,
  y: number,
  rotated: boolean
): { valid: boolean; reason?: string } => {
  const key = `${x},${y}`;
  if (grid[key]) return { valid: false, reason: 'Здесь уже есть карта' };
  if (x === 0 && y === 0) return { valid: false, reason: 'Нельзя строить на входе в шахту' };

  const tempPlaced: PlacedCard = { card, rotated, x, y };
  const tempInfo = getRotatedExitsAndConnections(tempPlaced);

  const neighbors: { dir: 'top' | 'right' | 'bottom' | 'left'; nx: number; ny: number }[] = [
    { dir: 'top', nx: x, ny: y - 1 },
    { dir: 'bottom', nx: x, ny: y + 1 },
    { dir: 'left', nx: x - 1, ny: y },
    { dir: 'right', nx: x + 1, ny: y },
  ];

  let hasNeighbor = false;
  let matchesAllNeighbors = true;

  for (const { dir, nx, ny } of neighbors) {
    const neighborKey = `${nx},${ny}`;
    const neighbor = grid[neighborKey];

    if (neighbor) {
      hasNeighbor = true;
      if (!neighbor.isGoal) {
        const neighborInfo = getRotatedExitsAndConnections(neighbor);
        const opposing = getOpposingDir(dir);

        const myExit = tempInfo.exits[dir];
        const neighborExit = neighborInfo.exits[opposing];

        if (myExit !== neighborExit) {
          matchesAllNeighbors = false;
          break;
        }
      }
    }
  }

  if (!hasNeighbor) return { valid: false, reason: 'Карта должна примыкать к существующему туннелю' };
  if (!matchesAllNeighbors) return { valid: false, reason: 'Туннели на стыке карт не совпадают' };

  const tempGrid = { ...grid, [key]: tempPlaced };
  const reached = calculateReachability(tempGrid);

  if (!reached.has(key)) {
    return { valid: false, reason: 'Карта должна образовывать непрерывный туннель от входа' };
  }

  return { valid: true };
};