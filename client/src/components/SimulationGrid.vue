<template>
  <div ref="viewport" class="grid-viewport">
    <div class="grid-container" :style="containerStyle">
      <!-- Origin crosshair -->
      <div class="origin-marker" :style="originStyle">
        <span class="origin-label">0,0</span>
      </div>

      <!-- House markers -->
      <div
        v-for="house in houses"
        :key="`house-${house.x}-${house.y}`"
        class="grid-entity"
        :style="entityStyle(house.x, house.y)"
        :title="`House (${house.x}, ${house.y}) — ${house.presentsCount} present${house.presentsCount !== 1 ? 's' : ''}`"
      >
        <HouseMarker :size="markerSize" />
      </div>

      <!-- Robot markers -->
      <div
        v-for="(robot, index) in robots"
        :key="`robot-${robot.name}`"
        class="grid-entity"
        :style="robotStyle(robot, index)"
        :data-robot-id="robot.name"
        :title="`${robot.name} (${robot.position.x}, ${robot.position.y})`"
      >
        <RobotMarker :color="robotColor(robot.turnOrder)" :size="markerSize" :label="robot.name" />
      </div>
    </div>
  </div>
</template>

<script>
import RobotMarker from './RobotMarker.vue';
import HouseMarker from './HouseMarker.vue';

/** Size of each grid cell in pixels */
const CELL_SIZE = 40;

/** Marker icon size in pixels (fits inside a cell with some margin) */
const MARKER_SIZE = 28;

/** Padding cells around the bounding box */
const PADDING_CELLS = 2;

/** Pixel offset per stacked robot to keep them all partially visible */
const STACK_OFFSET = 6;

/**
 * Simulation grid component.
 *
 * Renders robots and houses on a coordinate grid with CSS background
 * grid lines. Positions entities using absolute translate transforms
 * with an inverted Y-axis (up is positive). The grid auto-sizes to
 * the bounding box of all entities plus padding, and is wrapped in a
 * scrollable viewport.
 *
 * @component
 */
export default {
  name: 'SimulationGrid',

  components: { RobotMarker, HouseMarker },

  props: {
    /** Array of robot objects: { name, turnOrder, position: { x, y } } */
    robots: {
      type: Array,
      default: () => [],
    },

    /** Array of house objects: { x, y, presentsCount } */
    houses: {
      type: Array,
      default: () => [],
    },

    /** Total number of robots, used for even HSL color distribution */
    robotCount: {
      type: Number,
      default: 1,
    },
  },

  computed: {
    /**
     * Bounding box of all entities in grid coordinates.
     * Returns { minX, maxX, minY, maxY } with padding applied.
     *
     * @returns {{ minX: number, maxX: number, minY: number, maxY: number }}
     */
    bounds() {
      const xs = [];
      const ys = [];

      for (const robot of this.robots) {
        xs.push(robot.position.x);
        ys.push(robot.position.y);
      }
      for (const house of this.houses) {
        xs.push(house.x);
        ys.push(house.y);
      }

      // Always include origin
      xs.push(0);
      ys.push(0);

      return {
        minX: Math.min(...xs) - PADDING_CELLS,
        maxX: Math.max(...xs) + PADDING_CELLS,
        minY: Math.min(...ys) - PADDING_CELLS,
        maxY: Math.max(...ys) + PADDING_CELLS,
      };
    },

    /** Width of the grid container in pixels */
    gridWidth() {
      return (this.bounds.maxX - this.bounds.minX + 1) * CELL_SIZE;
    },

    /** Height of the grid container in pixels */
    gridHeight() {
      return (this.bounds.maxY - this.bounds.minY + 1) * CELL_SIZE;
    },

    /** Constant exposed for template use */
    markerSize() {
      return MARKER_SIZE;
    },

    /**
     * Inline styles for the grid container — sets dimensions and
     * CSS background grid lines.
     */
    containerStyle() {
      return {
        width: `${this.gridWidth}px`,
        height: `${this.gridHeight}px`,
        backgroundSize: `${CELL_SIZE}px ${CELL_SIZE}px`,
      };
    },

    /**
     * Position style for the origin marker (0, 0).
     */
    originStyle() {
      const { px, py } = this.toPixels(0, 0);
      return {
        transform: `translate(${px}px, ${py}px)`,
      };
    },

    /**
     * Groups robots by their cell position for stack-offset calculation.
     * Returns a Map of "x,y" → array of robot names at that cell.
     *
     * @returns {Map<string, string[]>}
     */
    robotStacks() {
      const stacks = new Map();
      for (const robot of this.robots) {
        const key = `${robot.position.x},${robot.position.y}`;
        if (!stacks.has(key)) {
          stacks.set(key, []);
        }
        stacks.get(key).push(robot.name);
      }
      return stacks;
    },
  },

  methods: {
    /**
     * Converts grid coordinates to pixel position within the container.
     * Y-axis is inverted so positive Y goes visually upward.
     *
     * @param {number} x - Grid X coordinate
     * @param {number} y - Grid Y coordinate
     * @returns {{ px: number, py: number }} Pixel coordinates
     */
    toPixels(x, y) {
      const px = (x - this.bounds.minX) * CELL_SIZE;
      const py = (this.bounds.maxY - y) * CELL_SIZE;
      return { px, py };
    },

    /**
     * Inline position style for an entity at grid coordinates.
     *
     * @param {number} x - Grid X coordinate
     * @param {number} y - Grid Y coordinate
     * @returns {object} CSS style object with transform
     */
    entityStyle(x, y) {
      const { px, py } = this.toPixels(x, y);
      const offset = (CELL_SIZE - MARKER_SIZE) / 2;
      return {
        transform: `translate(${px + offset}px, ${py + offset}px)`,
      };
    },

    /**
     * Inline position style for a robot, including stack offset when
     * multiple robots share the same cell.
     *
     * @param {object} robot - Robot object with position
     * @param {number} index - Index in the robots array (unused, kept for v-for)
     * @returns {object} CSS style object with transform
     */
    robotStyle(robot) {
      const { px, py } = this.toPixels(robot.position.x, robot.position.y);
      const offset = (CELL_SIZE - MARKER_SIZE) / 2;

      // Calculate stack offset
      const key = `${robot.position.x},${robot.position.y}`;
      const stack = this.robotStacks.get(key) || [];
      const stackIndex = stack.indexOf(robot.name);
      const stackShift = stackIndex * STACK_OFFSET;

      return {
        transform: `translate(${px + offset + stackShift}px, ${py + offset + stackShift}px)`,
        zIndex: 10 + stackIndex,
      };
    },

    /**
     * Generates an HSL color for a robot based on its turn order.
     * Colors are evenly spaced around the hue wheel.
     *
     * @param {number} turnOrder - Robot's turn order (0-based)
     * @returns {string} HSL color string
     */
    robotColor(turnOrder) {
      const hue = this.robotCount > 1 ? (turnOrder / this.robotCount) * 360 : 210;
      return `hsl(${hue}, 70%, 50%)`;
    },
  },
};
</script>

<style scoped>
.grid-viewport {
  width: 100%;
  height: 100%;
  overflow: auto;
  position: relative;
}

.grid-container {
  position: relative;
  background-color: var(--color-surface-alt);
  background-image:
    linear-gradient(to right, var(--color-border) 1px, transparent 1px),
    linear-gradient(to bottom, var(--color-border) 1px, transparent 1px);
  min-width: 100%;
  min-height: 100%;
}

.grid-entity {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: auto;
}

.origin-marker {
  position: absolute;
  top: 0;
  left: 0;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.origin-label {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  opacity: 0.6;
  font-family: var(--font-mono);
}
</style>
