const socket = io();
const summary = document.getElementById('summary');
const seating = document.getElementById('seating');
const releaseAllBtn = document.getElementById('releaseAll');
const resetBtn = document.getElementById('reset');

let seats = {};

// Crear asientos dinámicamente
function createSeats() {
  seating.innerHTML = '';
  ['A', 'B', 'C'].forEach(row => {
    for (let i = 1; i <= 10; i++) {
      const seatId = `${row}${i}`;
      const div = document.createElement('div');
      div.className = `seat`;
      div.id = seatId;
      div.innerText = seatId;
      seating.appendChild(div);
    }
  });
}

createSeats();

function updateSummary() {
  const available = Object.values(seats).filter(s => s.status === 'available').length;
  const reserved = Object.values(seats).filter(s => s.status === 'reserved').length;
  const sold = Object.values(seats).filter(s => s.status === 'sold').length;
  summary.innerText = `Disponibles: ${available} | Reservados: ${reserved} | Vendidos: ${sold}`;
}

socket.on('init', (serverSeats) => {
  seats = serverSeats;
  Object.entries(serverSeats).forEach(([id, info]) => {
    const seat = document.getElementById(id);
    if (seat) {
      seat.classList.remove('reserved', 'sold');
      if (info.status === 'reserved') seat.classList.add('reserved');
      if (info.status === 'sold') seat.classList.add('sold');
      seat.title = info.user ? `${info.status === 'reserved' ? 'Reservado por' : 'Vendido a'}: ${info.user}` : '';
    }
  });
  updateSummary();
});

// Manejar eventos (reserved, release, sold)
socket.on('reserved', ({ seatId, user, expiresAt }) => {
  seats[seatId] = { status: 'reserved', user, expiresAt };
  const seat = document.getElementById(seatId);
  if (seat) {
    seat.classList.add('reserved');
    seat.title = `Reservado por: ${user}`;
  }
  updateSummary();
});

socket.on('release', (seatId) => {
  seats[seatId] = { status: 'available', user: '', expiresAt: 0 };
  const seat = document.getElementById(seatId);
  if (seat) {
    seat.classList.remove('reserved');
    seat.title = '';
  }
  updateSummary();
});

socket.on('sold', ({ seatId, user }) => {
  seats[seatId] = { status: 'sold', user, expiresAt: 0 };
  const seat = document.getElementById(seatId);
  if (seat) {
    seat.classList.remove('reserved');
    seat.classList.add('sold');
    seat.title = `Vendido a: ${user}`;
  }
  updateSummary();
});

releaseAllBtn.addEventListener('click', () => {
  socket.emit('admin_release_all');
});

resetBtn.addEventListener('click', () => {
  socket.emit('admin_reset');
});