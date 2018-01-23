var expressApp = require('express')(),
  server = require('http').Server(expressApp),
  socketio = require('socket.io')(server),
  http = require('http'),
  rooms = {},
  userIds = {};

server.listen(4201);

expressApp.get('/', function (req, res) {
  res.send('Server listening on port 4201');
});

socketio.on('connection', function (socket) {
  var currentRoom, id;

  socket.on('room/get', function () {
    return rooms;
  });

  socket.on('room/enter', function (data, fn) {
    currentRoom = (data || {}).room;
    socket.join('room' + currentRoom, function () {
      console.log('connected');
      console.log(socket.rooms); // [ <socket.id>, 'room 237' ]
    });

  });

  socket.on('drawing', function (data) {
    socket.broadcast.to('room' + currentRoom).emit('drawing', data);
  });

  socket.on('room/leave', function () {
    socket.leave('room' + currentRoom, function () {
      console.log('disconnected'); // [ <socket.id>, 'room 237' ]
      console.log(socket.rooms);
    });
  });
});
