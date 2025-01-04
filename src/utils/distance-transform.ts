
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

/**
 * Searches for positions in the cost matrix that contain a specific value and returns them as an array of coordinates.
 * @param {CostMatrix} cost - The cost matrix to search within.
 * @param {number} search - The value to search for in the cost matrix.
 * @returns {Array<[number, number]>} - An array of coordinates representing positions in the cost matrix that contain the specified value. Returns an empty array if no positions are found.
 */
  static getPositions(cost: CostMatrix, search: number): number[][] {
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

/**
 * Finds and returns the position of the maximum value in the given cost matrix.
 * @param {CostMatrix} cost - The cost matrix to search within.
 * @returns {number[] | null} - An array containing the x and y coordinates of the maximum value position, or null if the matrix is empty.
 */
  static getMaxPosition(cost: CostMatrix): number[] | null {
    let max = 0;
    let maxPos = null;

    for (let y = 0; y < 50; ++y) {
      for (let x = 0; x < 50; ++x) {
        const value = cost.get(x, y);
        if (maxPos == null || value > max) {
          maxPos = [x, y];
          max = value;
        }
      }
    }
    return maxPos;
  }

/**
 * Computes the wall distance cost matrix for a given room.
 * The wall distance is defined as the shortest path distance to the nearest wall tile.
 * This function performs a two-pass algorithm that first computes the top-down pass (distance from each tile to the nearest wall above and to its left) and then the bottom-up pass (distance from each tile to the nearest wall below or to its right). The minimum of these two distances is the wall distance for that tile.
 * @param {string} roomName - The name of the room to compute the wall distance cost matrix for.
 * @returns {CostMatrix} - A cost matrix representing the wall distance for each tile in the room.
 */
  static computeWallDistance(roomName: string): CostMatrix {
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