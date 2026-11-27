/* eslint-env jest */
import GrblController from '../Grbl/GrblController';
import MarlinController from '../Marlin/MarlinController';
import SmoothieController from '../Smoothie/SmoothieController';
import TinyGController from '../TinyG/TinyGController';
import { createController } from './helpers/createController';

jest.mock('../../lib/logger', () => {
  const createLogger = () => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    verbose: jest.fn(),
    debug: jest.fn(),
    silly: jest.fn(),
  });
  const logger = () => createLogger();
  return {
    __esModule: true,
    default: logger,
    getLevel: jest.fn(() => 'info'),
    setLevel: jest.fn(),
  };
});

const activeControllers = [];

const setup = (ControllerClass) => {
  const { controller } = createController(ControllerClass);
  clearInterval(controller.queryTimer);

  // A serial connection that can be closed
  controller.connection.removeAllListeners = jest.fn();
  controller.connection.close = jest.fn((callback) => callback && callback(null));

  const events = [];
  controller.sockets.test = { emit: (event, ...args) => events.push({ event, args }) };
  activeControllers.push(controller);

  return { controller, events };
};

const closeEvents = (events) => events
  .filter(({ event }) => event === 'serialport:close')
  .map(({ args }) => args[0]);

describe.each([
  ['Grbl', GrblController],
  ['Marlin', MarlinController],
  ['Smoothie', SmoothieController],
  ['TinyG', TinyGController],
])('%s serialport:close', (name, ControllerClass) => {
  afterEach(() => {
    while (activeControllers.length > 0) {
      activeControllers.pop().destroy();
    }
  });

  test('a requested close reports lost: false', () => {
    const { controller, events } = setup(ControllerClass);

    controller.close(() => {});

    expect(closeEvents(events)).toEqual([{ port: '/dev/null', inuse: false, lost: false }]);
  });

  test('a port that closes on its own (power loss, cable pulled) reports lost: true', () => {
    const { controller, events } = setup(ControllerClass);

    controller.connectionEventListener.close(new Error('Port disconnected'));

    expect(closeEvents(events)).toEqual([{ port: '/dev/null', inuse: false, lost: true }]);
  });

  test('the lost flag does not carry over to a later requested close', () => {
    const { controller, events } = setup(ControllerClass);

    controller.portLost = true;
    controller.close(() => {});
    controller.close(() => {});

    expect(closeEvents(events).map(({ lost }) => lost)).toEqual([true, false]);
  });
});
