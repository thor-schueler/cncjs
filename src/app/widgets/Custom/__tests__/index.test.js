/* eslint-env jest */
jest.mock('app/lib/controller', () => ({
  port: '',
  type: '',
  state: {},
  workflow: { state: 'idle' },
  addListener: jest.fn(),
  removeListener: jest.fn()
}));
jest.mock('app/lib/i18n', () => ({ _: text => text }));
jest.mock('app/components/Space', () => 'Space');
jest.mock('app/components/Widget', () => {
  const Widget = () => null;
  [
    'Header', 'Title', 'Sortable', 'Controls', 'Button',
    'DropdownButton', 'DropdownMenuItem', 'Content'
  ].forEach(name => {
    Widget[name] = `Widget.${name}`;
  });
  return Widget;
});
jest.mock('../Custom', () => 'CustomContent');
jest.mock('../Settings', () => 'Settings');
jest.mock('../index.styl', () => ({ widgetContent: 'widget-content', hidden: 'hidden', fullscreen: 'fullscreen' }));
jest.mock('../../WidgetConfig', () => class WidgetConfig {
  get(key, defaultValue) {
    return defaultValue;
  }
});

// Jest runs in the node environment: fake the root element's color mode attribute and the observer
const rootAttributes = {};
const originalDocument = global.document;
const originalMutationObserver = global.MutationObserver;
const observers = [];
global.document = {
  documentElement: {
    getAttribute: name => (name in rootAttributes ? rootAttributes[name] : null)
  }
};
// A plain constructor function, not a class: the file already has one class (the WidgetConfig mock)
// and the lint rules allow only one per file. `new` returns the object built here.
global.MutationObserver = function MutationObserver(callback) {
  const observer = {
    callback,
    observe: jest.fn(),
    disconnect: jest.fn()
  };
  observers.push(observer);
  return observer;
};
const setColorMode = (colorMode) => {
  rootAttributes['data-color-mode'] = colorMode;
  observers.forEach(observer => observer.callback([]));
};

afterAll(() => {
  global.document = originalDocument;
  global.MutationObserver = originalMutationObserver;
});

const CustomWidget = require('../index').default;

const props = {
  widgetId: 'custom:test',
  onFork: jest.fn(),
  onRemove: jest.fn(),
  sortable: { handleClassName: 'handle', filterClassName: 'filter' }
};

// Walk the element tree returned by render() and return the first element of the given type
const findElement = (element, type) => {
  if (!element || typeof element !== 'object') {
    return null;
  }
  if (Array.isArray(element)) {
    for (const child of element) {
      const found = findElement(child, type);
      if (found) {
        return found;
      }
    }
    return null;
  }
  if (element.type === type) {
    return element;
  }
  return findElement(element.props && element.props.children, type);
};

describe('fullscreen', () => {
  test('passes the fullscreen state to the iframe content', () => {
    const widget = new CustomWidget(props);
    widget.setState = changes => {
      widget.state = { ...widget.state, ...changes };
    };

    expect(findElement(widget.render(), 'CustomContent').props.fullscreen).toBe(false);

    widget.action.toggleFullscreen();
    expect(findElement(widget.render(), 'CustomContent').props.fullscreen).toBe(true);

    widget.action.toggleFullscreen();
    expect(findElement(widget.render(), 'CustomContent').props.fullscreen).toBe(false);
  });
});

describe('color mode', () => {
  const mount = () => {
    const widget = new CustomWidget(props);
    widget.setState = changes => {
      widget.state = { ...widget.state, ...changes };
    };
    return widget;
  };

  beforeEach(() => {
    delete rootAttributes['data-color-mode'];
    observers.splice(0);
  });

  test('starts with the app color mode', () => {
    rootAttributes['data-color-mode'] = 'dark';

    const widget = mount();

    expect(findElement(widget.render(), 'CustomContent').props.colorMode).toBe('dark');
  });

  test('falls back to light before a color mode has been applied', () => {
    const widget = mount();

    expect(findElement(widget.render(), 'CustomContent').props.colorMode).toBe('light');
  });

  test('follows color mode changes while mounted', () => {
    const widget = mount();
    widget.componentDidMount();

    setColorMode('dark');
    expect(findElement(widget.render(), 'CustomContent').props.colorMode).toBe('dark');

    setColorMode('light');
    expect(findElement(widget.render(), 'CustomContent').props.colorMode).toBe('light');

    widget.componentWillUnmount();
  });

  test('watches only the color mode attribute on the root element', () => {
    const widget = mount();
    widget.componentDidMount();

    expect(observers).toHaveLength(1);
    expect(observers[0].observe).toHaveBeenCalledWith(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-color-mode']
    });

    widget.componentWillUnmount();
  });

  test('stops watching on unmount', () => {
    const widget = mount();
    widget.componentDidMount();
    const observer = observers[0];

    widget.componentWillUnmount();

    expect(observer.disconnect).toHaveBeenCalledTimes(1);
    expect(widget.colorModeObserver).toBeNull();
  });
});
