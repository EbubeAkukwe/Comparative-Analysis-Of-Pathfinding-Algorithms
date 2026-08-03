/**
 * PathLab — EventBus
 * Lightweight publish/subscribe decoupling layer.
 * All cross-module communication goes through here —
 * never import UI from algorithm code or vice versa.
 *
 * Events emitted by this platform:
 *   grid:changed      { r, c, prevState, nextState }
 *   grid:resized      { rows, cols }
 *   grid:cleared      {}
 *   tool:changed      { tool }
 *   algo:selected     { name, selected }
 *   run:start         { algorithms: string[] }
 *   run:step          { name, step: StepObject }
 *   run:result        { name, result: ResultObject }
 *   run:done          { results: ResultObject[] }
 *   run:reset         {}
 *   settings:changed  { key, value }
 *   modal:open        { tab }
 *   modal:close       {}
 */
export const EventBus = (() => {
  /** @type {Map<string, Set<Function>>} */
  const subs = new Map();

  return {
    /**
     * Subscribe to an event.
     * @param {string} event
     * @param {Function} fn
     * @returns {Function} unsubscribe function
     */
    on(event, fn) {
      if (!subs.has(event)) subs.set(event, new Set());
      subs.get(event).add(fn);
      return () => this.off(event, fn);
    },

    /**
     * Subscribe once — auto-removed after first call.
     * @param {string} event
     * @param {Function} fn
     */
    once(event, fn) {
      const wrapper = (data) => { fn(data); this.off(event, wrapper); };
      this.on(event, wrapper);
    },

    /**
     * Unsubscribe a specific handler.
     * @param {string} event
     * @param {Function} fn
     */
    off(event, fn) {
      subs.get(event)?.delete(fn);
    },

    /**
     * Emit an event to all subscribers.
     * @param {string} event
     * @param {*} data
     */
    emit(event, data) {
      subs.get(event)?.forEach(fn => {
        try { fn(data); }
        catch (err) { console.error(`[EventBus] Error in "${event}" handler:`, err); }
      });
    },

    /**
     * Remove all handlers for an event (or all events).
     * @param {string} [event]
     */
    clear(event) {
      if (event) subs.delete(event);
      else subs.clear();
    },

    /** Debug: list all active subscriptions */
    debug() {
      const out = {};
      subs.forEach((handlers, event) => { out[event] = handlers.size; });
      return out;
    }
  };
})();
