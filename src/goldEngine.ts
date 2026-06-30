// src/gameEngine.ts (только обновленная функция validateTunnelPlacement)
export const validateTunnelPlacement = (
  grid: Record<string, PlacedCard>,
  card: TunnelCard,
  x: number,
  y: number,
  rotated: boolean,
  precalculatedReachable?: Set<string> // Передаем кэш для O(1) проверки связи
): { valid: boolean; reason?: string } => {
  const key = `${x},${y}`;

  if (grid[key]) {
    return { valid: false, reason: 'Здесь уже есть карта' };
  }

  if (x === 0 && y === 0) {
    return { valid: false, reason: 'Нельзя строить на входе в шахту' };
  }

  const tempPlaced: PlacedCard = { card, rotated, x, y };
  const tempInfo = getRotatedExitsAndConnections(tempPlaced);

  const neighbors = [
    { dir: 'top', nx: x, ny: y - 1 },
    { dir: 'bottom', nx: x, ny: y + 1 },
    { dir: 'left', nx: x - 1, ny: y },
    { dir: 'right', nx: x + 1, ny: y },
  ];

  let hasNeighbor = false;
  let matchesAllNeighbors = true;
  let isConnectedToEntrance = false;

  for (const { dir, nx, ny } of neighbors) {
    const neighborKey = `${nx},${ny}`;
    const neighbor = grid[neighborKey];

    if (neighbor) {
      hasNeighbor = true;

      if (!neighbor.isGoal) {
        const neighborInfo = getRotatedExitsAndConnections(neighbor);
        const opposing = getOpposingDir(dir as any);

        const myExit = tempInfo.exits[dir as any];
        const neighborExit = neighborInfo.exits[opposing];

        if (myExit !== neighborExit) {
          matchesAllNeighbors = false;
          break;
        }

        // Если сосед достижим и имеет проход к нам, а мы к нему — значит путь есть
        if (precalculatedReachable && precalculatedReachable.has(neighborKey) && myExit && neighborExit) {
          isConnectedToEntrance = true;
        }
      } else if (neighbor.isGoal && neighbor.flipped) {
        // Достижение открытых целей
        const neighborInfo = getRotatedExitsAndConnections(neighbor);
        const opposing = getOpposingDir(dir as any);
        if (tempInfo.exits[dir as any] && neighborInfo.exits[opposing]) {
          isConnectedToEntrance = true;
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

  // Если у нас нет кэша, выполняем полный BFS (совместимость)
  if (!precalculatedReachable) {
    const tempGrid = { ...grid, [key]: tempPlaced };
    const reached = calculateReachability(tempGrid);
    if (!reached.has(key)) {
      return { valid: false, reason: 'Карта должна образовывать непрерывный туннель от входа' };
    }
  } else if (!isConnectedToEntrance) {
    // Входная точка (0,0) - обработка связи
    if (precalculatedReachable.has('0,0') && (Math.abs(x) + Math.abs(y) === 1)) {
      const isStartConnected = neighbors.some(({ dir, nx, ny }) => {
        if (nx === 0 && ny === 0) {
          return tempInfo.exits[dir as any];
        }
        return false;
      });
      if (!isStartConnected) {
        return { valid: false, reason: 'Карта должна соединяться со входом' };
      }
    } else {
      return { valid: false, reason: 'Карта должна образовывать непрерывный туннель от входа' };
    }
  }

  return { valid: true };
};