
// 1. MOVEMENT: apply the speed multiplier
const movementSpeed = baseMovementSpeed *
  (window.wildlandsCheats?.speedMultiplier ?? 1);

// 2. DAMAGE: check before reducing player health
if (!window.wildlandsCheats?.godMode) {
  player.health -= incomingDamage;
}

// 3. BLOCK PLACEMENT: don't consume a block in creative mode
if (!window.wildlandsCheats?.unlimitedBlocks) {
  inventory[selectedBlock]--;
}

// 4. DAY/NIGHT: listen for changes from the console
window.addEventListener('wildlands-time-change', event => {
  const isNight = event.detail.time === 'night';

  // Connect this to your 3D engine's lighting system.
  // Example: scene.background, ambient light and sun intensity.
  if (typeof setWorldTime === 'function') {
    setWorldTime(isNight ? 'night' : 'day');
  }
});

// 5. INVENTORY: refresh the visible inventory after /give
window.addEventListener('wildlands-inventory-change', () => {
  if (typeof updateInventoryUI === 'function') {
    updateInventoryUI(window.wildlandsCheats.inventory);
  }
});
