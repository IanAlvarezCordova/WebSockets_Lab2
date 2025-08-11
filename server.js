// File: server.js
const express = require('express');
const http = require('http');
const path = require('path');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(path.join(__dirname, 'public')));

// Estado global de los asientos
let seats = {};
['A', 'B', 'C'].forEach(row => {
  for (let i = 1; i <= 10; i++) {
    seats[`${row}${i}`] = { status: 'available', user: '', expiresAt: 0 };
  }
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/admin.html'));
});

io.on('connection', (socket) => {
  console.log('Nuevo cliente conectado');
  socket.emit('init', seats);

  socket.on('setUsername', (username) => {
    socket.username = username || 'Anónimo';
  });

  socket.on('admin_release_all', () => {
    Object.keys(seats).forEach(seatId => {
      if (seats[seatId].status === 'reserved') {
        seats[seatId] = { status: 'available', user: '', expiresAt: 0 };
        io.emit('release', seatId);
      }
    });
  });

  socket.on('admin_reset', () => {
    ['A', 'B', 'C'].forEach(row => {
      for (let i = 1; i <= 10; i++) {
        seats[`${row}${i}`] = { status: 'available', user: '', expiresAt: 0 };
      }
    });
    io.emit('init', seats);
  });  

  socket.on('reserve', (seatId) => {
    const seat = seats[seatId];
    if (seat && seat.status === 'available') {
      seat.status = 'reserved';
      seat.user = socket.username;
      seat.expiresAt = Date.now() + 60000; // Expira en 1 minuto
      io.emit('reserved', { seatId, user: seat.user, expiresAt: seat.expiresAt });

      setTimeout(() => {
        if (seats[seatId].status === 'reserved' && Date.now() >= seats[seatId].expiresAt) {
          seats[seatId] = { status: 'available', user: '', expiresAt: 0 };
          io.emit('release', seatId);
        }
      }, 60000);
    }
  });

  socket.on('release', (seatId) => {
    const seat = seats[seatId];
    if (seat && seat.status === 'reserved' && seat.user === socket.username) {
      seats[seatId] = { status: 'available', user: '', expiresAt: 0 };
      io.emit('release', seatId);
    }
  });

  socket.on('buy', (seatIds) => {
    seatIds.forEach(seatId => {
      const seat = seats[seatId];
      if (seat && seat.status === 'reserved' && seat.user === socket.username) {
        seats[seatId] = { status: 'sold', user: socket.username, expiresAt: 0 };
        io.emit('sold', { seatId, user: seat.user });  // Cambiado a 'sold' con user
      }
    });
  });

  

  socket.on('disconnect', () => {
    console.log('Cliente desconectado');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});