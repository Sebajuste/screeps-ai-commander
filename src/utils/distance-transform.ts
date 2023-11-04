
export class DistanceTransform {

  static maxDistance(cost: CostMatrix) {
    let maxValue = cost.get(0, 0);
    for (let y = 0; y < 50; ++y) {
      for (let x = 0; x < 50; ++x) {
        const value = cost.get(x, y);
        if (value > maxValue) {
          maxValue = value;
        }
      }
    }
    return maxValue;
  }

  static getPositions(cost: CostMatrix, search?: number): number[][] {
    const result: number[][] = [];
    for (let y = 0; y < 50; ++y) {
      for (let x = 0; x < 50; ++x) {
        const value = cost.get(x, y);
        if (value == search) {
          result.push([x, y]);
        }
      }
    }
    return result;
  }

  static compute(roomName: string): CostMatrix {
    const terrain = Game.map.getRoomTerrain(roomName);

    const topDownPass = new PathFinder.CostMatrix();
    for (let y = 0; y < 50; ++y) {
      for (let x = 0; x < 50; ++x) {
        if (terrain.get(x, y) == TERRAIN_MASK_WALL) {
          topDownPass.set(x, y, 0);
        }
        else {
          const value = Math.min(
            topDownPass.get(x - 1, y - 1),
            topDownPass.get(x, y - 1),
            topDownPass.get(x + 1, y - 1),
            topDownPass.get(x - 1, y)
          ) + 1;
          topDownPass.set(x, y, value);
        }
      }
    }

    for (let y = 49; y >= 0; --y) {
      for (let x = 49; x >= 0; --x) {
        const value = Math.min(
          topDownPass.get(x, y),
          topDownPass.get(x + 1, y + 1) + 1,
          topDownPass.get(x, y + 1) + 1,
          topDownPass.get(x - 1, y + 1) + 1,
          topDownPass.get(x + 1, y) + 1
        );
        topDownPass.set(x, y, value);
        // vis.circle(x, y, { radius: value / 25 });
      }
    }

    return topDownPass;
  }

  static visuals(roomName: string, cost: CostMatrix) {
    const vis = new RoomVisual(roomName);
    for (let y = 0; y < 50; ++y) {
      for (let x = 0; x < 50; ++x) {
        vis.circle(x, y, { radius: cost.get(x, y) / 25 });
      }
    }
  }

}