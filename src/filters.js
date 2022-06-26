function firstName(guest) {
  return guest.name.split(" ")[0];
}

function rsvpName(guest, allUserGuests) {
  if (!guest.isPlusOne) {
    return guest.name;
  }

  const mainGuest = allUserGuests.find((g) => g.isSingle);
  return `${mainGuest.name} +1`;
}

function validationKey(guest, fieldName) {
  return `${guest.id}__${fieldName}`;
}

module.exports = {
  firstName,
  rsvpName,
  validationKey,
};
