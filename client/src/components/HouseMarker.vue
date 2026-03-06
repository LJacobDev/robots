<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    role="img"
    aria-label="Present"
  >
    <!-- Bow loops -->
    <circle cx="9" cy="5" r="3" fill="none" :stroke="color" stroke-width="1.5" />
    <circle cx="15" cy="5" r="3" fill="none" :stroke="color" stroke-width="1.5" />

    <!-- Lid -->
    <rect x="3" y="7" width="18" height="4" rx="1" :fill="color" />

    <!-- Box body -->
    <rect x="5" y="11" width="14" height="11" rx="1" :fill="color" opacity="0.85" />

    <!-- Vertical ribbon -->
    <rect x="11" y="7" width="2" height="15" fill="white" opacity="0.5" />
    <!-- Horizontal ribbon -->
    <rect x="3" y="8" width="18" height="2" fill="white" opacity="0.3" />
  </svg>
</template>

<script>
/**
 * Inline SVG gift box icon used as a grid marker for delivery locations.
 *
 * Renders a present/gift box shape (bow, lid, box body, and ribbon)
 * filled with the given color. Sized to match grid cells.
 *
 * @component
 */
export default {
  name: 'HouseMarker',

  props: {
    /** Fill color for the gift box (any valid CSS color) */
    color: {
      type: String,
      default: 'hsl(35, 80%, 50%)',
    },

    /** Display size in pixels */
    size: {
      type: Number,
      default: 24,
    },
  },
};
</script>
