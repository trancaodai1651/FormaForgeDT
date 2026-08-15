let activeRoot: HTMLElement | null = null;

type ClickerDocument = {
  getElementById(id: string): HTMLElement | null;
  querySelector<E extends Element = Element>(selectors: string): E | null;
  querySelectorAll<E extends Element = Element>(selectors: string): NodeListOf<E>;
  createElement<K extends keyof HTMLElementTagNameMap>(tagName: K): HTMLElementTagNameMap[K];
  createElement(tagName: string): HTMLElement;
  createDocumentFragment(): DocumentFragment;
  body: HTMLElement;
  head: HTMLHeadElement;
  documentElement: HTMLElement;
  activeElement: Element | null;
  title: string;
  addEventListener: Document['addEventListener'];
  removeEventListener: Document['removeEventListener'];
  dispatchEvent: Document['dispatchEvent'];
}

export function setClickerRoot(root: HTMLElement) {
  activeRoot = root;
}

export function resetClickerRoot(root: HTMLElement) {
  if (activeRoot === root) activeRoot = null;
}

export function getClickerRoot(): HTMLElement {
  if (!activeRoot) throw new Error('Clicker workspace is not mounted.');
  return activeRoot;
}

export function getClickerDocument(): ClickerDocument {
  const root = activeRoot;
  const ownerDocument = root?.ownerDocument ?? document;
  const shadowHost = root?.getRootNode() instanceof ShadowRoot
    ? (root.getRootNode() as ShadowRoot).host
    : null;
  const scopedQuery = <E extends Element = Element>(selectors: string): E | null => root?.querySelector<E>(selectors) ?? null;
  const scopedQueryAll = <E extends Element = Element>(selectors: string): NodeListOf<E> => root?.querySelectorAll<E>(selectors) ?? ownerDocument.querySelectorAll<E>('.__clicker-no-match__');

  return {
    getElementById: (id) => scopedQuery<EllipsisElement>(`#${CSS.escape(id)}`),
    querySelector: scopedQuery,
    querySelectorAll: scopedQueryAll,
    createElement: ((tagName: string) => ownerDocument.createElement(tagName)) as ClickerDocument['createElement'],
    createDocumentFragment: () => ownerDocument.createDocumentFragment(),
    body: root ?? ownerDocument.body,
    head: ownerDocument.head,
    documentElement: shadowHost instanceof HTMLElement ? shadowHost : (root ?? ownerDocument.documentElement),
    activeElement: root?.querySelector(':focus') ?? ownerDocument.activeElement,
    get title() { return ownerDocument.title; },
    set title(value: string) { ownerDocument.title = value; },
    addEventListener: ((type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => (root ?? ownerDocument).addEventListener(type, listener, options)) as Document['addEventListener'],
    removeEventListener: ((type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions) => (root ?? ownerDocument).removeEventListener(type, listener, options)) as Document['removeEventListener'],
    dispatchEvent: (event) => (root ?? ownerDocument).dispatchEvent(event),
  };
}

type EllipsisElement = HTMLElement;


