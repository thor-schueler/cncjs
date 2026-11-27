/* eslint-env jest */
jest.mock('app/lib/log', () => ({ debug: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('app/lib/i18n', () => ({ _: text => text }));
jest.mock('app/components/Space', () => () => null);
jest.mock('app/components/Widget', () => () => null);
jest.mock('../Connection', () => () => null);
jest.mock('../index.styl', () => ({}));
jest.mock('app/lib/controller', () => ({
  __esModule: true,
  default: {
    loadedControllers: ['Grbl'],
    baudrates: [],
    port: '',
    addListener: jest.fn(),
    removeListener: jest.fn(),
    listPorts: jest.fn(),
    openPort: jest.fn(),
    closePort: jest.fn(),
  },
}));

const mockConfig = {};
jest.mock('../../WidgetConfig', () => jest.fn().mockImplementation(() => ({
  get: (key, defaultValue) => (key in mockConfig ? mockConfig[key] : defaultValue),
  set: jest.fn(),
})));

const controller = require('app/lib/controller').default;
const ConnectionWidget = require('../index').default;

const PORT = '/dev/ttyUSB0';
const PORT_LIST = [{ port: PORT, inuse: false }];
const POLL_INTERVAL = 3000;

// Builds the widget without rendering it; setState applies the update synchronously
const create = ({ autoReconnect = true } = {}) => {
  Object.keys(mockConfig).forEach(key => delete mockConfig[key]);
  Object.assign(mockConfig, { port: PORT, baudrate: 115200, autoReconnect });

  const widget = new ConnectionWidget({ widgetId: 'connection', onFork: jest.fn(), onRemove: jest.fn() });
  widget.setState = (updater) => {
    const patch = (typeof updater === 'function') ? updater(widget.state, widget.props) : updater;
    widget.state = { ...widget.state, ...patch };
  };
  return widget;
};

const emit = (widget, eventName, ...args) => widget.controllerEvents[eventName](...args);

// Page load: the port list arrives, auto connect opens the port, the server confirms
const connectOnLoad = (widget) => {
  emit(widget, 'serialport:list', PORT_LIST);
  emit(widget, 'serialport:open', { controllerType: 'Grbl', port: PORT, baudrate: 115200, inuse: true });
  controller.openPort.mockClear();
  controller.listPorts.mockClear();
};

const openedPorts = () => controller.openPort.mock.calls.map(([port]) => port);

describe('Connection widget auto reconnect', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('connects once on page load', () => {
    const widget = create();

    emit(widget, 'serialport:list', PORT_LIST);
    emit(widget, 'serialport:list', PORT_LIST);

    expect(openedPorts()).toEqual([PORT]);
  });

  test('reopens a lost port once it shows up in the port list again', () => {
    const widget = create();
    connectOnLoad(widget);

    emit(widget, 'serialport:close', { port: PORT, inuse: false, lost: true });
    expect(widget.state.connected).toBe(false);

    // Port still gone: polling keeps asking for the list
    emit(widget, 'serialport:list', []);
    jest.advanceTimersByTime(POLL_INTERVAL);
    expect(controller.listPorts).toHaveBeenCalledTimes(2); // refresh on close + one poll
    expect(openedPorts()).toEqual([]);

    // Port is back
    emit(widget, 'serialport:list', PORT_LIST);
    expect(openedPorts()).toEqual([PORT]);
  });

  test('stops polling once the port is open', () => {
    const widget = create();
    connectOnLoad(widget);

    emit(widget, 'serialport:close', { port: PORT, inuse: false, lost: true });
    emit(widget, 'serialport:list', PORT_LIST);
    emit(widget, 'serialport:open', { controllerType: 'Grbl', port: PORT, baudrate: 115200, inuse: true });
    controller.listPorts.mockClear();

    jest.advanceTimersByTime(POLL_INTERVAL * 3);
    expect(controller.listPorts).not.toHaveBeenCalled();
  });

  test('retries after a failed open while polling', () => {
    const widget = create();
    connectOnLoad(widget);

    emit(widget, 'serialport:close', { port: PORT, inuse: false, lost: true });
    emit(widget, 'serialport:list', PORT_LIST);
    emit(widget, 'serialport:error', { port: PORT });
    emit(widget, 'serialport:list', PORT_LIST);

    expect(openedPorts()).toEqual([PORT, PORT]);
  });

  test('does not reopen a port closed by another client', () => {
    const widget = create();
    connectOnLoad(widget);

    emit(widget, 'serialport:close', { port: PORT, inuse: false, lost: false });
    jest.advanceTimersByTime(POLL_INTERVAL * 3);
    emit(widget, 'serialport:list', PORT_LIST);

    expect(controller.listPorts).toHaveBeenCalledTimes(1); // refresh on close only
    expect(openedPorts()).toEqual([]);
  });

  test('does not reopen a port the user closed', () => {
    const widget = create();
    connectOnLoad(widget);

    widget.closePort(PORT);
    // Even if the port is reported lost while closing
    emit(widget, 'serialport:close', { port: PORT, inuse: false, lost: true });
    jest.advanceTimersByTime(POLL_INTERVAL * 3);
    emit(widget, 'serialport:list', PORT_LIST);

    expect(openedPorts()).toEqual([]);
  });

  test('does not reopen a lost port when auto connect is off', () => {
    const widget = create({ autoReconnect: false });
    emit(widget, 'serialport:list', PORT_LIST);
    controller.openPort.mockClear();
    controller.listPorts.mockClear();

    emit(widget, 'serialport:close', { port: PORT, inuse: false, lost: true });
    jest.advanceTimersByTime(POLL_INTERVAL * 3);
    emit(widget, 'serialport:list', PORT_LIST);

    expect(controller.listPorts).toHaveBeenCalledTimes(1); // refresh on close only
    expect(openedPorts()).toEqual([]);
  });

  test('stops polling when auto connect is turned off', () => {
    const widget = create();
    connectOnLoad(widget);

    emit(widget, 'serialport:close', { port: PORT, inuse: false, lost: true });
    widget.setState({ autoReconnect: false });
    controller.listPorts.mockClear();

    jest.advanceTimersByTime(POLL_INTERVAL * 3);
    expect(controller.listPorts).not.toHaveBeenCalled();
  });

  test('stops polling on unmount', () => {
    const widget = create();
    connectOnLoad(widget);

    emit(widget, 'serialport:close', { port: PORT, inuse: false, lost: true });
    widget.componentWillUnmount();
    controller.listPorts.mockClear();

    jest.advanceTimersByTime(POLL_INTERVAL * 3);
    expect(controller.listPorts).not.toHaveBeenCalled();
  });
});
