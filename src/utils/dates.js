// Дата склада — местная, а не UTC: в Минске после полуночи уже новый день.
function today() {
  return new Date().toLocaleDateString('sv-SE');
}

module.exports = { today };
