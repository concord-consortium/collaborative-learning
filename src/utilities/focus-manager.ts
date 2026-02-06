/**
 * Centralized focus management for keyboard navigation.
 * Coordinates focus across regions, handles focus memory, and tracks input modality.
 */

interface FocusRegion {
  id: string;
  element: HTMLElement;
  type: 'region' | 'composite' | 'trap';
}

class FocusManager {
  private regions: Map<string, FocusRegion> = new Map();
  private focusMemory: Map<string, HTMLElement> = new Map();
  private currentTrap: string | null = null;
  private lastInputWasKeyboard = false;
  private debug = typeof localStorage !== 'undefined' &&
    localStorage.getItem('debug')?.includes('focus') || false;

  constructor() {
    // Only add listeners in browser environment
    if (typeof document !== 'undefined') {
      this.initInputTracking();
    }
  }

  private initInputTracking() {
    // Track input modality globally
    document.addEventListener('keydown', (e) => {
      // Only count navigation keys, not typing
      const navKeys = ['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
          'Enter', 'Escape', 'Home', 'End'];
        if (navKeys.includes(e.key)) {
        this.lastInputWasKeyboard = true;
        this.log('Input modality: keyboard', e.key);
      }
    }, { capture: true });

    document.addEventListener('mousedown', () => {
      this.lastInputWasKeyboard = false;
      this.log('Input modality: mouse');
    }, { capture: true });
  }

  private log(message: string, ...args: unknown[]) {
    if (this.debug) {
      console.log(`[FocusManager] ${message}`, ...args);
    }
  }

  /**
   * Register a focus region. Must be idempotent for React StrictMode.
   * Call in useEffect, with unregisterRegion in cleanup.
   */
  registerRegion(region: FocusRegion): void {
    this.log('registerRegion', region.id, region.type);
    // Idempotent: update existing registration
    this.regions.set(region.id, region);
  }

  /**
   * Unregister a focus region. Must be idempotent for React StrictMode.
   * Also clears focus memory to avoid retaining detached DOM references.
   */
  unregisterRegion(id: string): void {
    this.log('unregisterRegion', id);
    this.regions.delete(id);
    this.focusMemory.delete(id);
  }

  /**
   * Store the last-focused element for a region.
   * Used for focus memory when tabbing back into a region.
   */
  setFocusMemory(regionId: string, element: HTMLElement): void {
    this.log('setFocusMemory', regionId, element);
    this.focusMemory.set(regionId, element);
  }

  /**
   * Get the last-focused element for a region.
   * Returns null if element is no longer in DOM.
   */
  getFocusMemory(regionId: string): HTMLElement | null {
    const element = this.focusMemory.get(regionId);
    // Validate element is still in DOM
    if (element && element.isConnected) {
      return element;
    }
    // Clean up stale reference
    if (element) {
      this.focusMemory.delete(regionId);
    }
    return null;
  }

  /**
   * Enter a focus trap (e.g., tile editing mode).
   * Tab will cycle within trap until exitTrap is called.
   */
  enterTrap(regionId: string): void {
    this.log('enterTrap', regionId);
    this.currentTrap = regionId;
  }

  /**
   * Exit the current focus trap.
   */
  exitTrap(): void {
    this.log('exitTrap', this.currentTrap);
    this.currentTrap = null;
  }

  /**
   * Check if currently in a focus trap.
   */
  isInTrap(): boolean {
    return this.currentTrap !== null;
  }

  /**
   * Get the current trap region ID.
   */
  getCurrentTrap(): string | null {
    return this.currentTrap;
  }

  /**
   * Check if the last user input was keyboard navigation.
   * Used to avoid stealing focus on mouse clicks.
   */
  isKeyboardNavigation(): boolean {
    return this.lastInputWasKeyboard;
  }

  /**
   * Get a registered region by ID.
   */
  getRegion(id: string): FocusRegion | undefined {
    return this.regions.get(id);
  }
}

// Singleton instance
export const focusManager = new FocusManager();
