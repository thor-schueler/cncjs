/* eslint-env jest */
import Controller from '../Controller';

const PORT = '/dev/ttyUSB0';
const OPTIONS = { controllerType: 'Grbl', baudrate: 115200, rtscts: false };

// A socket.io-client stand-in: records emits, lets the test fire server and socket events
const createFakeSocket = () => {
  const handlers = {};
  return {
    handlers,
    on: (event, fn) => {
      (handlers[event] = handlers[event] || []).push(fn);
    },
    fire: (event, ...args) => (handlers[event] || []).forEach(fn => fn(...args)),
    emit: jest.fn(),
    destroy: jest.fn(),
  };
};

const setup = () => {
  const socket = createFakeSocket();
  const io = { connect: jest.fn(() => socket) };
  const controller = new Controller(io);
  controller.connect('', {});
  return { controller, socket };
};

// Opens the port the way the Connection widget does and lets the server confirm it
const openPort = (controller, socket) => {
  controller.openPort(PORT, OPTIONS);
  socket.fire('serialport:open', { controllerType: 'Grbl', port: PORT, baudrate: 115200, inuse: true });
  socket.emit.mockClear();
};

const opens = (socket) => socket.emit.mock.calls.filter(([event]) => event === 'open');

describe('Controller rejoin after socket reconnect', () => {
  test('re-emits open with the original options for the port it considers open', () => {
    const { controller, socket } = setup();
    openPort(controller, socket);

    socket.fire('reconnect', 1);

    expect(opens(socket).map(([, port, options]) => [port, options])).toEqual([[PORT, OPTIONS]]);
  });

  test('does nothing when no port is open', () => {
    const { socket } = setup();

    socket.fire('reconnect', 1);

    expect(opens(socket)).toEqual([]);
  });

  test('does nothing after the port was closed', () => {
    const { controller, socket } = setup();
    openPort(controller, socket);
    socket.fire('serialport:close', { port: PORT, inuse: false, lost: false });

    socket.fire('reconnect', 1);

    expect(opens(socket)).toEqual([]);
  });

  test('a successful rejoin leaves the port open', () => {
    const { controller, socket } = setup();
    openPort(controller, socket);
    const onClose = jest.fn();
    controller.addListener('serialport:close', onClose);

    socket.fire('reconnect', 1);
    const [, , , callback] = opens(socket)[0];
    callback(null);

    expect(controller.port).toBe(PORT);
    expect(onClose).not.toHaveBeenCalled();
  });

  test('a failed rejoin reports the port as lost and clears the client state', () => {
    const { controller, socket } = setup();
    openPort(controller, socket);
    const onClose = jest.fn();
    controller.addListener('serialport:close', onClose);

    socket.fire('reconnect', 1);
    const [, , , callback] = opens(socket)[0];
    callback(new Error('Error: No such file or directory, cannot open /dev/ttyUSB0'));

    expect(onClose).toHaveBeenCalledWith({ port: PORT, inuse: false, lost: true });
    expect(controller.port).toBe('');
  });

  test('a failed rejoin is ignored if the port changed in the meantime', () => {
    const { controller, socket } = setup();
    openPort(controller, socket);
    const onClose = jest.fn();
    controller.addListener('serialport:close', onClose);

    socket.fire('reconnect', 1);
    const [, , , callback] = opens(socket)[0];
    socket.fire('serialport:close', { port: PORT, inuse: false, lost: false });
    onClose.mockClear();
    callback(new Error('closed'));

    expect(onClose).not.toHaveBeenCalled();
  });

  test('server events still update client state and reach listeners', () => {
    const { controller, socket } = setup();
    const onState = jest.fn();
    controller.addListener('controller:state', onState);

    socket.fire('controller:state', 'Grbl', { status: { activeState: 'Idle' } });

    expect(controller.type).toBe('Grbl');
    expect(controller.state).toEqual({ status: { activeState: 'Idle' } });
    expect(onState).toHaveBeenCalledWith('Grbl', { status: { activeState: 'Idle' } });
  });
});
