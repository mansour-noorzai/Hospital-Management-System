// Vercel captures this HTTP server and routes both HTTP and WebSocket traffic to it.
// Native server routing preserves the application's /api/v1 and /socket.io paths.
import server from './backend/src/vercel';

server.listen(Number(process.env.PORT || 3000));

export default server;
