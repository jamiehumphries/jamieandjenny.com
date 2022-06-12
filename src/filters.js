function firstName(guest) {
  return guest.name.split(" ")[0];
}

function validationKey(guest, fieldName) {
  return `${guest.id}__${fieldName}`;
}

module.exports = {
  firstName,
  validationKey,
};
