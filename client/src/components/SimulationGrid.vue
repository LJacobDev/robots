<template>
  <div class="grid-wrapper">
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
          <RobotMarker
            :color="robotColor(robot.turnOrder)"
            :size="markerSize"
            :label="robot.name"
          />
        </div>
      </div>
    </div>

    <!-- Zoom controls (outside scrollable viewport so they stay fixed) -->
    <div class="zoom-controls">
      <button class="zoom-btn" :disabled="zoomLevel >= maxZoom" title="Zoom in" @click="zoomIn">
        +
      </button>
      <span class="zoom-label">{{ zoomPercent }}%</span>
      <button class="zoom-btn" :disabled="zoomLevel <= minZoom" title="Zoom out" @click="zoomOut">
        −
      </button>
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

/**
 * Maximum pixel jitter applied to stacked robots.
 * Each robot gets a deterministic offset seeded from its name,
 * keeping them clustered within the cell rather than spreading out.
 */
const JITTER_MAX = 3;

/** Zoom step increment/decrement */
const ZOOM_STEP = 0.25;

/** Minimum zoom level */
const MIN_ZOOM = 0.25;

/** Maximum zoom level */
const MAX_ZOOM = 3.0;

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

  data() {
    return {
      /** Current zoom level (1.0 = 100%) */
      zoomLevel: 1.0,
      /** Minimum zoom */
      minZoom: MIN_ZOOM,
      /** Maximum zoom */
      maxZoom: MAX_ZOOM,
    };
  },

  computed: {
    /**
     * Effective cell size in pixels after zoom is applied.
     * All pixel calculations use this instead of the base CELL_SIZE
     * so that zooming resizes cells rather than scaling the container.
     *
     * @returns {number}
     */
    effectiveCellSize() {
      return CELL_SIZE * this.zoomLevel;
    },

    /**
     * Effective marker size in pixels, scaled proportionally with zoom.
     *
     * @returns {number}
     */
    effectiveMarkerSize() {
      return MARKER_SIZE * this.zoomLevel;
    },

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
      return (this.bounds.maxX - this.bounds.minX + 1) * this.effectiveCellSize;
    },

    /** Height of the grid container in pixels */
    gridHeight() {
      return (this.bounds.maxY - this.bounds.minY + 1) * this.effectiveCellSize;
    },

    /** Marker icon size scaled to current zoom level */
    markerSize() {
      return this.effectiveMarkerSize;
    },

    /**
     * Inline styles for the grid container — sets dimensions and
     * CSS background grid lines sized to the effective cell size.
     */
    containerStyle() {
      return {
        width: `${this.gridWidth}px`,
        height: `${this.gridHeight}px`,
        backgroundSize: `${this.effectiveCellSize}px ${this.effectiveCellSize}px`,
      };
    },

    /** Zoom level as a rounded percentage for display */
    zoomPercent() {
      return Math.round(this.zoomLevel * 100);
    },

    /**
     * Position style for the origin marker (0, 0).
     */
    originStyle() {
      const { px, py } = this.toPixels(0, 0);
      return {
        width: `${this.effectiveCellSize}px`,
        height: `${this.effectiveCellSize}px`,
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
     * Uses effectiveCellSize so positions scale with zoom.
     *
     * @param {number} x - Grid X coordinate
     * @param {number} y - Grid Y coordinate
     * @returns {{ px: number, py: number }} Pixel coordinates
     */
    toPixels(x, y) {
      const px = (x - this.bounds.minX) * this.effectiveCellSize;
      const py = (this.bounds.maxY - y) * this.effectiveCellSize;
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
      const offset = (this.effectiveCellSize - this.effectiveMarkerSize) / 2;
      return {
        transform: `translate(${px + offset}px, ${py + offset}px)`,
      };
    },

    /**
     * Inline position style for a robot, with a small deterministic
     * jitter so that stacked robots at the same cell are slightly
     * offset but remain within the cell bounds.
     *
     * @param {object} robot - Robot object with position
     * @returns {object} CSS style object with transform
     */
    robotStyle(robot) {
      const { px, py } = this.toPixels(robot.position.x, robot.position.y);
      const offset = (this.effectiveCellSize - this.effectiveMarkerSize) / 2;

      // Deterministic jitter seeded from robot name
      const hash = this.nameHash(robot.name);
      const jitterX = (hash % (JITTER_MAX * 2 + 1)) - JITTER_MAX;
      const jitterY = ((hash >> 8) % (JITTER_MAX * 2 + 1)) - JITTER_MAX;

      // Stack z-index so all robots remain clickable
      const key = `${robot.position.x},${robot.position.y}`;
      const stack = this.robotStacks.get(key) || [];
      const stackIndex = stack.indexOf(robot.name);

      return {
        transform: `translate(${px + offset + jitterX}px, ${py + offset + jitterY}px)`,
        zIndex: 10 + stackIndex,
      };
    },

    /**
     * Simple deterministic hash of a string, used to seed robot jitter.
     * Produces a stable integer for a given name so jitter doesn't
     * change between re-renders.
     *
     * @param {string} str - The string to hash
     * @returns {number} A positive integer hash
     */
    nameHash(str) {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
      }
      return Math.abs(hash);
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

    /**
     * Applies a new zoom level while keeping the viewport's visual
     * center anchored to the same grid coordinate. Records the
     * grid-coordinate at the viewport center before the change,
     * then restores the scroll position on the next tick so the
     * user's focal point stays stable.
     *
     * @param {number} newZoom - The new zoom level to apply
     */
    adjustZoom(newZoom) {
      const vp = this.$refs.viewport;
      const oldCellSize = this.effectiveCellSize;

      // Grid-coordinate at the viewport center (fractional)
      const centerGridX = (vp.scrollLeft + vp.clientWidth / 2) / oldCellSize;
      const centerGridY = (vp.scrollTop + vp.clientHeight / 2) / oldCellSize;

      this.zoomLevel = newZoom;

      this.$nextTick(() => {
        const newCellSize = this.effectiveCellSize;
        vp.scrollLeft = centerGridX * newCellSize - vp.clientWidth / 2;
        vp.scrollTop = centerGridY * newCellSize - vp.clientHeight / 2;
      });
    },

    /** Increases zoom level by one step, clamped to max */
    zoomIn() {
      this.adjustZoom(Math.min(this.zoomLevel + ZOOM_STEP, MAX_ZOOM));
    },

    /** Decreases zoom level by one step, clamped to min */
    zoomOut() {
      this.adjustZoom(Math.max(this.zoomLevel - ZOOM_STEP, MIN_ZOOM));
    },

    /**
     * Scrolls the viewport so that the robot with the given name
     * is visible. Called by parent components via template ref.
     *
     * @param {string} robotName - The robot's name (used as data-robot-id)
     */
    scrollToRobot(robotName) {
      const el = this.$refs.viewport?.querySelector(`[data-robot-id="${robotName}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      }
    },
  },
};
</script>

<style scoped>
.grid-wrapper {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}

.grid-viewport {
  width: 100%;
  height: 100%;
  overflow: auto;
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

[data-robot-id] {
  transition: transform 0.3s ease;
}

.origin-marker {
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  background-color: rgba(34, 197, 94, 0.12);
  border: 2px solid rgba(34, 197, 94, 0.5);
  border-radius: 2px;
  box-sizing: border-box;
}

.origin-label {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  opacity: 0.6;
  font-family: var(--font-mono);
}

.zoom-controls {
  position: absolute;
  bottom: var(--space-md);
  right: var(--space-md);
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-xs);
  box-shadow: var(--shadow-sm);
  z-index: 50;
}

.zoom-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--radius-sm);
  background-color: transparent;
  color: var(--color-text);
  font-size: var(--text-lg);
  font-weight: 600;
  cursor: pointer;
  transition: background-color var(--transition-fast);
}

.zoom-btn:hover:not(:disabled) {
  background-color: var(--color-surface-alt);
}

.zoom-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.zoom-btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}

.zoom-label {
  font-size: var(--text-xs);
  font-family: var(--font-mono);
  color: var(--color-text-secondary);
  min-width: 3rem;
  text-align: center;
}
</style>
