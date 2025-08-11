const socket = io();
const usernameInput = document.getElementById('usernameInput');
const seating = document.getElementById('seating');
const buyBtn = document.getElementById('buyBtn');
const timerDisplay = document.getElementById('timerDisplay');

let seats = {};
let selectedSeats = new Set();
let timerInterval = null;
let reservationEndTime = 0;

// Crear los asientos dinámicamente
function createSeats() {
  seating.innerHTML = '';
  ['A', 'B', 'C'].forEach(row => {
    for (let i = 1; i <= 10; i++) {
      const seatId = `${row}${i}`;
      const div = document.createElement('div');
      div.className = `seat`;
      div.id = seatId;
      div.innerText = seatId;
      div.addEventListener('click', () => {
        const username = usernameInput.value.trim();
        if (!username) {
          alert('Por favor ingresa tu nombre antes de seleccionar un asiento.');
          return;
        }

        socket.emit('setUsername', username);

        if (div.classList.contains('sold')) return;

        // Deseleccionar si ya está seleccionado
        if (selectedSeats.has(seatId)) {
          selectedSeats.delete(seatId);
          div.classList.remove('reserved');
          socket.emit('release', seatId);
          updateTotal(); // Added updateTotal call
        } else {
          // Seleccionar el asiento y reservarlo
          selectedSeats.add(seatId);
          div.classList.add('reserved');
          socket.emit('reserve', seatId);
          updateTotal(); // Added updateTotal call
        }

        buyBtn.disabled = selectedSeats.size === 0;
        if (selectedSeats.size === 0) stopTimer();
      });

      seating.appendChild(div);
    }
  });
}

createSeats();

let prices = { 'A': 6, 'B': 5, 'C': 4 };

function updateTotal() {
  let total = 0;
  let breakdown = [];
  selectedSeats.forEach(seatId => {
    const row = seatId[0];
    const price = prices[row];
    total += price;
    breakdown.push(`${seatId}: $${price}`);
  });
  document.getElementById('totalPrice').innerText = total > 0 ? `Total: $${total}` : '';
  return { total, breakdown };
}

// Recibir el estado inicial de los asientos desde el servidor
socket.on('init', (serverSeats) => {
  seats = serverSeats;
  Object.entries(serverSeats).forEach(([id, info]) => {
    const seat = document.getElementById(id);
    if (seat) {
      seat.classList.remove('reserved', 'sold');
      seat.dataset.tooltip = '';
      if (info.status === 'reserved') {
        seat.classList.add('reserved');
        seat.dataset.tooltip = `Reservado por: ${info.user}`;
      }
      if (info.status === 'sold') {
        seat.classList.add('sold');
        seat.dataset.tooltip = `Vendido a: ${info.user}`;
      }
    }
  });
});

// Cuando un asiento es reservado
socket.on('reserved', ({ seatId, user, expiresAt }) => {
  seats[seatId] = { status: 'reserved', user, expiresAt };
  const seat = document.getElementById(seatId);
  if (seat) {
    seat.classList.add('reserved');
    seat.dataset.tooltip = `Reservado por: ${user}`;
  }
  if (user === usernameInput.value.trim()) {
    reservationEndTime = expiresAt;
    startTimer();
  }
});

// Cuando un asiento es liberado
socket.on('release', (seatId) => {
  seats[seatId] = { status: 'available', user: '', expiresAt: 0 };
  const seat = document.getElementById(seatId);
  if (seat) {
    seat.classList.remove('reserved');
    seat.dataset.tooltip = '';
  }
  if (selectedSeats.has(seatId)) {
    selectedSeats.delete(seatId);
    stopTimer();
  }
});

socket.on('sold', ({ seatId, user }) => {
  seats[seatId] = { status: 'sold', user, expiresAt: 0 };
  const seat = document.getElementById(seatId);
  if (seat) {
    seat.classList.remove('reserved');
    seat.classList.add('sold');
    seat.dataset.tooltip = `Vendido a: ${user}`;
  }
  if (selectedSeats.has(seatId)) {
    selectedSeats.delete(seatId);
    stopTimer();
  }
});

// Cuando un asiento es comprado
socket.on('buy', (seatId) => {
  const seat = document.getElementById(seatId);
  if (seat) {
    seat.classList.remove('reserved');
    seat.classList.add('sold');
  }
  if (selectedSeats.has(seatId)) {
    selectedSeats.delete(seatId);
    stopTimer();
  }
});

// Comprar los asientos seleccionados
buyBtn.addEventListener('click', () => {
  if (selectedSeats.size > 0) {
    const { total, breakdown } = updateTotal();
    const confirmMsg = `Confirma compra:\n${breakdown.join('\n')}\nTotal: $${total}`;
    if (confirm(confirmMsg)) {
      socket.emit('buy', Array.from(selectedSeats));
      selectedSeats.clear();
      buyBtn.disabled = true;
      stopTimer();
      updateTotal();
    }
  }
});

// Mostrar el temporizador de reserva
function startTimer() {
  stopTimer();
  timerInterval = setInterval(() => {
    const now = Date.now();
    const diff = Math.max(0, Math.floor((reservationEndTime - now) / 1000));
    timerDisplay.innerText = `Tiempo restante para completar la compra: ${diff} segundos`;
    if (diff <= 0) {
      stopTimer();
      selectedSeats.clear();
      buyBtn.disabled = true;
      Object.keys(seats).forEach(seatId => {
        if (seats[seatId].status === 'available') {
          const seat = document.getElementById(seatId);
          if (seat) seat.classList.remove('reserved');
        }
      });
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
    timerDisplay.innerText = '';
  }
}