/// delcaring a global variable to store all retained atoms
declare global {
  interface Window {
    __retainedAtoms__: Record<string, RetainedAtom<any>>;
  }
}

if (window.__retainedAtoms__ == null) {
  window.__retainedAtoms__ = {};
}

/* trying to simultate a Clojure Atom */
export class RetainedAtom<T> {
  name: string;
  listeners: { [name: string]: Array<(prev: T, next: T) => void> } = {};
  constructor(name: string, value: T) {
    this.name = name;
    window.__retainedAtoms__[name] = value as any;
  }
  deref(): T {
    return window.__retainedAtoms__[this.name] as T;
  }
  reset(value: T) {
    let prev = this.deref();
    window.__retainedAtoms__[this.name] = value as any;
    this.triggerListeners(prev, value);
  }
  swap(f: (value: T) => T) {
    let prev = this.deref();
    let curr = f(prev);
    // this.value = f(this.value);
    window.__retainedAtoms__[this.name] = curr as any;
    this.triggerListeners(prev, curr);
  }
  addWatch(name: string, f: (prev: T, next: T) => void) {
    if (this.listeners[name] == null) {
      this.listeners[name] = [];
    }
    this.listeners[name].push(f);
  }
  removeWatch(name: string) {
    if (this.listeners[name] != null) {
      delete this.listeners[name];
    }
  }
  private triggerListeners(prev: T, next: T) {
    for (let name in this.listeners) {
      this.listeners[name].forEach((f) => {
        try {
          f(prev, next);
        } catch (e) {
          console.error(`failed to trigger listener ${name}`, e);
        }
      });
    }
  }
}

export let connectRetainedAtomToStorage = (name: string, options: { read?: boolean; write?: boolean }) => {
  if (options.read !== false) {
    let value = localStorage.getItem(name);
    if (value != null) {
      try {
        window.__retainedAtoms__ = JSON.parse(value);
        console.warn("loaded retained atoms", window.__retainedAtoms__);
      } catch (e) {
        console.error("failed to parse retained atoms", e);
      }
    }
  }
  if (options.write !== false) {
    window.addEventListener("beforeunload", (e) => {
      if (window.__retainedAtoms__ != null) {
        localStorage.setItem(name, JSON.stringify(window.__retainedAtoms__));
        console.warn("saved retained atoms", window.__retainedAtoms__);
      }
    });
  }
};
