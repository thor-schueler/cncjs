---
"cncjs": patch
---

Connection widget: reconnect the serial port automatically when the connection to the machine or to the server is lost.

- When "Connect automatically" is enabled, a serial port that was lost (controller power loss, cable unplugged) is reopened once it reappears. Before, auto connect only happened on page load.
- After the Socket.IO connection reconnects (e.g. a tablet waking from sleep), the client rejoins the port it had open, so machine output reaches the UI again without a page reload. If the port can no longer be opened, it is treated as lost and reopened once it reappears.
