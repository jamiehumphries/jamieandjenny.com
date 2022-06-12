const express = require("express");
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { pick } = require("lodash");

const { firstName, validationKey } = require("./filters");
const serviceAccount = require("./firebase/service-account");

const router = express.Router();

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const USER = "user";
const GUESTS = "guests";

router.get("/", withData(USER), (req, res) => {
  res.render("home");
});

router.get("/info", withData(USER), (req, res) => {
  res.render("info");
});

router.get("/rsvp", withData(GUESTS), (req, res) => {
  res.render("rsvp");
});

router.post("/rsvp", withData(GUESTS), async (req, res) => {
  const { guests } = res.locals;
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

function withData(...data) {
  return async (req, res, next) => {
    if (data.includes(USER)) {
      res.locals.user = req.auth.user;
    }
    if (data.includes(GUESTS)) {
      const snapshot = await db
        .collection("guests")
        .where("user", "==", req.auth.user)
        .orderBy("rsvp_order")
        .get();
      res.locals.guests = snapshot.docs.map((doc) => {
        return { id: doc.id, ...doc.data() };
      });
    }
    next();
  };
}

function pickRsvpData(req, guest) {
  return pick(req.body[guest.id], "attending", "starter", "main");
}

class GuestOptionsValidator {
  constructor(req, guest) {
    this.data = req.body[guest.id] || {};
    this.guest = guest;
  }

  validate() {
    if (this.data.attending === "no") {
      return {};
    }

    return {
      ...this.validateAttendance(),
      ...this.validateCourse("starter"),
      ...this.validateCourse("main", "main course"),
    };
  }

  validateAttendance() {
    let message = "Select whether or not ";
    if (this.guest.isSingle) {
      message += "you are attending";
    } else if (this.guest.isPlusOne) {
      message += "you are bringing a guest";
    } else {
      message += `${firstName(this.guest)} is attending`;
    }

    return this.validateOption("attending", ["yes", "no"], message);
  }

  validateCourse(courseId, courseName) {
    const validOptions = ["meat", "veg"];
    if (this.guest.isChild) {
      validOptions.push("kids");
    }

    let message = `Select a ${courseName || courseId} for `;
    if (this.guest.isSingle) {
      message += "yourself";
    } else if (this.guest.isPlusOne) {
      message += "your guest";
    } else {
      message += firstName(this.guest);
    }

    return this.validateOption(courseId, validOptions, message);
  }

  validateOption(fieldName, validOptions, message) {
    const messages = {};
    if (!validOptions.includes(this.data[fieldName])) {
      messages[validationKey(this.guest, fieldName)] = message;
    }
    return messages;
  }
}

module.exports = router;
