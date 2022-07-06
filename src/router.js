const express = require("express");
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { pick } = require("lodash");

const { firstName, validationKey } = require("./filters");
const serviceAccount = require("./firebase/service-account");

const WEDDING_DAY = new Date(2022, 9, 1);
const MILLISECONDS_IN_DAY = 24 * 60 * 60 * 1000;

const router = express.Router();

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

router.use(fetchUserData);

router.get("/", (req, res) => {
  const now = new Date();
  const daysToGo = Math.ceil((WEDDING_DAY - now) / MILLISECONDS_IN_DAY);
  res.render("home", { daysToGo });
});

router.get("/information", (req, res) => {
  res.render("information");
});

router.get("/rsvp", fetchGuestData, (req, res) => {
  res.render("rsvp");
});

router.get("/rsvp/sent", fetchGuestData, (req, res) => {
  const { user } = res.locals;
  if (user.hasSentRsvp) {
    res.render("rsvp-sent");
  } else {
    res.redirect("/rsvp");
  }
});

router.post("/rsvp", fetchGuestData, async (req, res) => {
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
    await userRef(req.auth.user).update({ hasSentRsvp: true });
    await Promise.all(
      guests.map((guest) =>
        userGuestsRef(req.auth.user)
          .doc(guest.id)
          .update(pickRsvpData(req, guest))
      )
    );
    res.redirect("/rsvp/sent");
  }
});

router.get("/admin", async (req, res, next) => {
  const { user } = res.locals;
  if (!user.isAdmin) {
    next();
    return;
  }
  const usersQuery = await usersRef().get();
  const users = await Promise.all(
    usersQuery.docs.map(async (doc) => {
      const user = docToObject(doc);
      user.guests = await fetchUserGuests(doc.id);
      return user;
    })
  );
  res.render("admin", { users });
});

async function fetchUserData(req, res, next) {
  const { user } = req.auth;
  const doc = await userRef(user).get();
  res.locals.user = docToObject(doc);
  next();
}

async function fetchGuestData(req, res, next) {
  res.locals.guests = await fetchUserGuests(req.auth.user);
  next();
}

async function fetchUserGuests(userId) {
  const query = await userGuestsRef(userId).orderBy("index").get();
  return query.docs.map(docToObject);
}

function usersRef() {
  return db.collection("users");
}

function userRef(userId) {
  return usersRef().doc(userId);
}

function userGuestsRef(userId) {
  return userRef(userId).collection("guests");
}

function docToObject(doc) {
  return { id: doc.id, ...doc.data() };
}

function pickRsvpData(req, guest) {
  return pick(req.body[guest.id], "attending", "starter", "main", "dietary");
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
      ...this.validateCourse("starter", "starter"),
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
    if (this.guest.isBaby) {
      validOptions.push("milk");
    }

    let message = `Select a ${courseName} for `;
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
