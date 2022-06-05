const express = require("express");
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { pick } = require("lodash");

const serviceAccount = require("./firebase/service-account");

const router = express.Router();

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

router.get("/", (req, res) => {
  res.render("home", { name: req.auth.user });
});

router.get("/rsvp", async (req, res) => {
  const guests = await getGuests(req.auth.user);
  res.render("rsvp", { guests });
});

router.post("/rsvp", async (req, res) => {
  const guests = await getGuests(req.auth.user);

  const validationMessages = {};
  for (const guest of guests) {
    const validator = new GuestOptionsValidator(req, guest);
    Object.assign(validationMessages, validator.validate());
  }

  const hasValidationMessages = Object.keys(validationMessages).length > 0;
  if (hasValidationMessages) {
    const guestsWithFormData = guests.map((guest) =>
      Object.assign(guest, pickRsvpData(req, guest))
    );
    res.render("rsvp", { guests: guestsWithFormData, validationMessages });
  } else {
    await Promise.all(
      guests.map((guest) =>
        db.collection("guests").doc(guest.id).update(pickRsvpData(req, guest))
      )
    );
    res.redirect("/");
  }
});

async function getGuests(user) {
  const snapshot = await db
    .collection("guests")
    .where("user", "==", user)
    .orderBy("rsvp_order")
    .get();
  return snapshot.docs.map((doc) => {
    return { id: doc.id, ...doc.data() };
  });
}

function pickRsvpData(req, guest) {
  return pick(req.body[guest.id], "starter", "main");
}

class GuestOptionsValidator {
  constructor(req, guest) {
    this.data = req.body[guest.id] || {};
    this.guest = guest;
  }

  validate() {
    return {
      ...this.validateCourse("starter"),
      ...this.validateCourse("main", "main course"),
    };
  }

  validateCourse(courseId, courseName) {
    const messages = {};
    if (!this.isValidCourse(this.data[courseId])) {
      const validationKey = `${this.guest.id}-${courseId}`;
      messages[validationKey] = `Select a ${courseName || courseId}.`;
    }
    return messages;
  }

  isValidCourse(option) {
    return ["meat", "veg"].includes(option);
  }
}

module.exports = router;
