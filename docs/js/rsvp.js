function toggleGuestAttendance(element) {
  const guestFieldset = document.querySelector(
    "fieldset[data-guest=" + element.dataset.guest + "]"
  );
  if (element.value === "no") {
    guestFieldset.classList.add("not-attending");
  } else {
    guestFieldset.classList.remove("not-attending");
  }
}

document
  .querySelectorAll("input[data-field=attending][type=radio]")
  .forEach(function (element) {
    if (element.checked) {
      toggleGuestAttendance(element);
    }
    element.addEventListener("change", function (event) {
      toggleGuestAttendance(event.target);
    });
  });
