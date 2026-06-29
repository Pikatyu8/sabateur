// src/gameEngine.ts
import { Card, TunnelCard, ActionCard, PlacedCard, Player, ToolType } from './types';

// Helper to get opposing direction
export const getOpposingDir = (dir: 'top' | 'right' | 'bottom' | 'left'): 'top' | 'right' | 'bottom' | 'left' => {
  const map: Record<string, 'top' | 'right' | 'bottom' | 'left'> = {
    top: 'bottom',
    bottom: 'top',
    left: 'right',
    right: 'left',
  };
  return map[dir];
};

// Create the standard 44 tunnel cards of the Saboteur basic game
export const createTunnelDeck = (): TunnelCard[] => {
  const cards: TunnelCard[] = [];

  // Card definitions
  const defs: {
    name: string;
    exits: { top: boolean; right: boolean; bottom: boolean; left: boolean };
    connectedParts: ('top' | 'right' | 'bottom' | 'left')[][];
    count: number;
    hasCrystal?: boolean;
  }[] = [
    // 1. Crossroads (all 4 connect) - 5 cards
    {
      name: 'Перекресток (Все стороны)',
      exits: { top: true, right: true, bottom: true, left: true },
      connectedParts: [['top', 'right', 'bottom', 'left']],
      count: 5,
    },
    // 2. T-junction without top (Left, Right, Bottom) - 5 cards
    {
      name: 'Т-образный (Влево, Вправо, Вниз)',
      exits: { top: false, right: true, bottom: true, left: true },
      connectedParts: [['left', 'right', 'bottom']],
      count: 5,
    },
    // 3. T-junction without right (Left, Top, Bottom) - 5 cards
    {
      name: 'Т-образный (Влево, Вверх, Вниз)',
      exits: { top: true, right: false, bottom: true, left: true },
      connectedParts: [['left', 'top', 'bottom']],
      count: 5,
    },
    // 4. Straight horizontal (Left-Right) - 4 cards
    {
      name: 'Прямой (Влево-Вправо)',
      exits: { top: false, right: true, bottom: false, left: true },
      connectedParts: [['left', 'right']],
      count: 4,
    },
    // 5. Straight vertical (Top-Bottom) - 4 cards
    {
      name: 'Прямой (Вверх-Вниз)',
      exits: { top: true, right: false, bottom: true, left: false },
      connectedParts: [['top', 'bottom']],
      count: 4,
    },
    // 6. Curve Top-Right - 5 cards
    {
      name: 'Поворот (Вверх-Вправо)',
      exits: { top: true, right: true, bottom: false, left: false },
      connectedParts: [['top', 'right']],
      count: 5,
    },
    // 7. Curve Bottom-Right - 5 cards
    {
      name: 'Поворот (Вниз-Вправо)',
      exits: { top: false, right: true, bottom: true, left: false },
      connectedParts: [['bottom', 'right']],
      count: 5,
    },

    // --- DEAD ENDS (Blocked Tunnels) ---
    // 8. Dead Crossroads (4 exits, but center blocked) - 1 card
    {
      name: 'Тупиковый перекресток',
      exits: { top: true, right: true, bottom: true, left: true },
      connectedParts: [['top'], ['right'], ['bottom'], ['left']], // isolated
      count: 1,
    },
    // 9. Dead T-junction (Left, Right, Bottom) - 1 card
    {
      name: 'Тупиковый Т-образный (Влево, Вправо, Вниз)',
      exits: { top: false, right: true, bottom: true, left: true },
      connectedParts: [['left'], ['right'], ['bottom']],
      count: 1,
    },
    // 10. Dead T-junction (Left, Top, Bottom) - 1 card
    {
      name: 'Тупиковый Т-образный (Влево, Вверх, Вниз)',
      exits: { top: true, right: false, bottom: true, left: true },
      connectedParts: [['left'], ['top'], ['bottom']],
      count: 1,
    },
    // 11. Dead Straight Horizontal - 1 card
    {
      name: 'Тупиковый прямой (Влево-Вправо)',
      exits: { top: false, right: true, bottom: false, left: true },
      connectedParts: [['left'], ['right']],
      count: 1,
    },
    // 12. Dead Straight Vertical - 1 card
    {
      name: 'Тупиковый прямой (Вверх-Вниз)',
      exits: { top: true, right: false, bottom: true, left: false },
      connectedParts: [['top'], ['bottom']],
      count: 1,
    },
    // 13. Dead Curve Top-Right - 1 card
    {
      name: 'Тупиковый поворот (Вверх-Вправо)',
      exits: { top: true, right: true, bottom: false, left: false },
      connectedParts: [['top'], ['right']],
      count: 1,
    },
    // 14. Dead Curve Bottom-Right - 1 card
    {
      name: 'Тупиковый поворот (Вниз-Вправо)',
      exits: { top: false, right: true, bottom: true, left: false },
      connectedParts: [['bottom'], ['right']],
      count: 1,
    },
    // 15. Single Exit Dead End Left - 1 card
    {
      name: 'Тупик (Влево)',
      exits: { top: false, right: false, bottom: false, left: true },
      connectedParts: [['left']],
      count: 1,
    },
    // 16. Single Exit Dead End Top - 1 card
    {
      name: 'Тупик (Вверх)',
      exits: { top: true, right: false, bottom: false, left: false },
      connectedParts: [['top']],
      count: 1,
    },
  ];

  let idCounter = 1;
  for (const def of defs) {
    for (let i = 0; i < def.count; i++) {
      cards.push({
        id: `tunnel_${idCounter++}`,
        type: 'tunnel',
        name: def.name,
        exits: { ...def.exits },
        connectedParts: def.connectedParts.map(p => [...p]),
        hasCrystal: def.hasCrystal,
      });
    }
  }

  return cards;
};

// Create the standard 27 action cards of the Saboteur basic game
export const createActionDeck = (): ActionCard[] => {
  const cards: ActionCard[] = [];
  let idCounter = 1;

  // 1. Broken Tools (9 cards: 3 of each)
  const brokenTools: ToolType[] = ['lamp', 'cart', 'pickaxe'];
  const toolNamesRu: Record<ToolType, string> = {
    lamp: 'Фонарь',
    cart: 'Вагонетка',
    pickaxe: 'Кирка',
  };

  for (const tool of brokenTools) {
    for (let i = 0; i < 3; i++) {
      cards.push({
        id: `action_break_${tool}_${idCounter++}`,
        type: 'action',
        actionType: 'break_tool',
        toolType: tool,
        name: `Сломанный инструмент: ${toolNamesRu[tool]}`,
        description: `Сыграйте эту карту на любого игрока. Пока у него сломан ${toolNamesRu[tool]}, он не может строить туннели.`,
      });
    }
  }

  // 2. Repair Tools (9 cards: 2 of each single, plus 3 dual cards)
  for (const tool of brokenTools) {
    for (let i = 0; i < 2; i++) {
      cards.push({
        id: `action_repair_${tool}_${idCounter++}`,
        type: 'action',
        actionType: 'repair_tool',
        toolType: tool,
        name: `Ремонт: ${toolNamesRu[tool]}`,
        description: `Почините сломанный инструмент (${toolNamesRu[tool]}) у себя или другого игрока.`,
      });
    }
  }

  // Dual repair cards: Lamp/Pickaxe, Lamp/Cart, Cart/Pickaxe (1 of each)
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
      description: `Почините один из двух указанных инструментов у себя или другого игрока.`,
    });
  }

  // 3. Cave-in (Обвал) - 3 cards
  for (let i = 0; i < 3; i++) {
    cards.push({
      id: `action_cavein_${idCounter++}`,
      type: 'action',
      actionType: 'cave_in',
      name: 'Обвал',
      description: 'Уберите любую карту туннеля с поля (кроме входа и карт золотых жил).',
    });
  }

  // 4. Secret Map (Секретная карта) - 6 cards
  for (let i = 0; i < 6; i++) {
    cards.push({
      id: `action_map_${idCounter++}`,
      type: 'action',
      actionType: 'map',
      name: 'Секретная карта',
      description: 'Секретно посмотрите одну из трех карт золотых жил на краю поля.',
    });
  }

  return cards;
};

// Create full shuffled deck (71 cards)
export const createFullDeck = (): Card[] => {
  const deck: Card[] = [...createTunnelDeck(), ...createActionDeck()];
  // Shuffle helper
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
};

// Get start card (Mine entrance)
export const getEntranceCard = (): TunnelCard => {
  return {
    id: 'entrance',
    type: 'tunnel',
    name: 'Вход в шахту',
    exits: { top: true, right: true, bottom: true, left: true },
    connectedParts: [['top', 'right', 'bottom', 'left']],
  };
};

// Get goal card templates
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
    name: 'Золотая жила (Обычный камень)',
    exits: { top: true, right: true, bottom: true, left: true },
    connectedParts: [['top', 'right', 'bottom', 'left']],
  };

  const stoneCard2: TunnelCard = {
    id: 'goal_stone_2',
    type: 'tunnel',
    name: 'Золотая жила (Обычный камень)',
    exits: { top: true, right: true, bottom: true, left: true },
    connectedParts: [['top', 'right', 'bottom', 'left']],
  };

  const goals = [
    { isGold: true, card: goldCard },
    { isGold: false, card: stoneCard1 },
    { isGold: false, card: stoneCard2 },
  ];

  // Shuffle goals
  for (let i = goals.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [goals[i], goals[j]] = [goals[j], goals[i]];
  }

  return goals;
};

// Get exits and connected parts for a placed card, accounting for 180-degree rotation
export const getRotatedExitsAndConnections = (placedCard: PlacedCard) => {
  const { card, rotated } = placedCard;
  if (!rotated) {
    return {
      exits: card.exits,
      connectedParts: card.connectedParts,
    };
  }

  // Rotate exits 180 degrees
  const exits = {
    top: card.exits.bottom,
    bottom: card.exits.top,
    left: card.exits.right,
    right: card.exits.left,
  };

  // Rotate connected parts
  const rotateDir = (dir: 'top' | 'right' | 'bottom' | 'left'): 'top' | 'right' | 'bottom' | 'left' => {
    if (dir === 'top') return 'bottom';
    if (dir === 'bottom') return 'top';
    if (dir === 'left') return 'right';
    return 'left';
  };

  const connectedParts = card.connectedParts.map(part =>
    part.map(rotateDir)
  );

  return { exits, connectedParts };
};

// Calculate all reachable coordinates and directions from the entrance
export const calculateReachability = (grid: Record<string, PlacedCard>) => {
  const visited = new Set<string>(); // Format: "x,y,incomingDirection"
  const reachedCoords = new Set<string>(); // Format: "x,y"
  const queue: { x: number; y: number; incoming: 'top' | 'right' | 'bottom' | 'left' | 'start' }[] = [];

  // Start at the entrance (0,0)
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

    // A face-down goal blocks the path from propagating further
    if (placed.isGoal && !placed.flipped) {
      continue;
    }

    const { exits, connectedParts } = getRotatedExitsAndConnections(placed);

    if (curr.incoming === 'start') {
      // Propagate in all active directions from entrance
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
      // Find the connected part containing the incoming direction
      const incomingDir = curr.incoming as 'top' | 'right' | 'bottom' | 'left';
      const connectedPart = connectedParts.find(part => part.includes(incomingDir));
      if (connectedPart) {
        // Propagate to all other directions in this connected part
        for (const outDir of connectedPart) {
          if (outDir === incomingDir) continue; // Skip incoming direction

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

// Check if a tunnel card can be placed at (x, y) with a given rotation
export const validateTunnelPlacement = (
  grid: Record<string, PlacedCard>,
  card: TunnelCard,
  x: number,
  y: number,
  rotated: boolean
): { valid: boolean; reason?: string } => {
  const key = `${x},${y}`;

  // 1. Cannot replace an existing card
  if (grid[key]) {
    return { valid: false, reason: 'Здесь уже есть карта' };
  }

  // 2. Goal spots cannot be built upon until reached, and start is at (0,0)
  if (x === 0 && y === 0) {
    return { valid: false, reason: 'Нельзя строить на входе в шахту' };
  }

  const tempPlaced: PlacedCard = { card, rotated, x, y };
  const tempInfo = getRotatedExitsAndConnections(tempPlaced);

  // 3. Find neighbors
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
      
      // ГАРАНТИЯ ПРАВИЛ: Карты целей освобождены от правил сопоставления стыков.
      // Игрок может прикладывать к ним как открытый туннель, так и стену.
      if (!neighbor.isGoal) {
        const neighborInfo = getRotatedExitsAndConnections(neighbor);
        const opposing = getOpposingDir(dir);

        const myExit = tempInfo.exits[dir];
        const neighborExit = neighborInfo.exits[opposing];

        // Проверяем состыковку только с ОБЫЧНЫМИ картами туннелей
        if (myExit !== neighborExit) {
          matchesAllNeighbors = false;
          break;
        }
      }
    }
  }

  if (!hasNeighbor) {
    return { valid: false, reason: 'Карта должна примыкать к существующему туннелю' };
  }

  if (!matchesAllNeighbors) {
    return { valid: false, reason: 'Туннели на стыке карт не совпадают' };
  }

  // 4. Проверяем непрерывность связи нового элемента со стартом
  const tempGrid = { ...grid, [key]: tempPlaced };
  const reached = calculateReachability(tempGrid);

  if (!reached.has(key)) {
    return { valid: false, reason: 'Карта должна образовывать непрерывный туннель от входа (нельзя строить от тупиков)' };
  }

  return { valid: true };
};