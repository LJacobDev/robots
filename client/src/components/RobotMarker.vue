<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    role="img"
    :aria-label="`Robot${label ? ': ' + label : ''}`"
  >
    <!-- Antenna -->
    <line x1="12" y1="1" x2="12" y2="5" stroke="currentColor" stroke-width="1.5" />
    <circle cx="12" cy="1" r="1" :fill="color" />

    <!-- Head -->
    <rect x="6" y="5" width="12" height="8" rx="2" :fill="color" />
    <!-- Eyes -->
    <circle cx="9.5" cy="9.5" r="1.5" fill="white" />
    <circle cx="14.5" cy="9.5" r="1.5" fill="white" />

    <!-- Body -->
    <rect x="8" y="14" width="8" height="7" rx="1" :fill="color" opacity="0.85" />
    <!-- Arms -->
    <rect x="4" y="14" width="3" height="5" rx="1" :fill="color" opacity="0.7" />
    <rect x="17" y="14" width="3" height="5" rx="1" :fill="color" opacity="0.7" />
  </svg>
</template>

<script>
/**
 * Inline SVG robot icon used as a grid marker.
 *
 * Renders a simple geometric robot shape (antenna, head with eyes,
 * body, and arms) filled with the given color. Sized to fit within
 * a grid cell.
 *
 * @component
 */
export default {
  name: 'RobotMarker',

  props: {
    /** Fill color for the robot body (any valid CSS color) */
    color: {
      type: String,
      default: 'hsl(210, 80%, 55%)',
    },

    /** Display size in pixels */
    size: {
      type: Number,
      default: 24,
    },

    /** Accessible label (e.g. the robot's name) */
    label: {
      type: String,
      default: '',
    },
  },
};
</script>
