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

router.get("/rsvp", withData(USER, GUESTS), (req, res) => {
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
    await userRef(req.auth.user).update({ hasSentRsvp: true });
    await Promise.all(
      guests.map((guest) =>
        userGuestsRef(req.auth.user)
          .doc(guest.id)
          .update(pickRsvpData(req, guest))
      )
    );
    res.redirect("/");
  }
});

router.get("/admin", withData(USER), async (req, res, next) => {
  const { user } = res.locals;
  if (!user.isAdmin) {
    next();
    return;
  }
  const usersQuery = await usersRef().get();
  const users = await Promise.all(
    usersQuery.docs.map(async (doc) => {
      const user = docToObject(doc);
      const guestsQuery = await userGuestsRef(doc.id).orderBy("index").get();
      user.guests = guestsQuery.docs.map(docToObject);
      return user;
    })
  );
  res.render("admin", { users });
});

function withData(...data) {
  return async (req, res, next) => {
    const { user } = req.auth;
    if (data.includes(USER)) {
      const doc = await userRef(user).get();
      res.locals.user = docToObject(doc);
    }
    if (data.includes(GUESTS)) {
      const query = await userGuestsRef(user).orderBy("index").get();
      res.locals.guests = query.docs.map(docToObject);
    }
    next();
  };
}

function usersRef() {
  return db.collection("users");
}

function userRef(user) {
  return usersRef().doc(user);
}

function userGuestsRef(user) {
  return userRef(user).collection("guests");
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
    if (this.guest.isBaby) {
      validOptions.push("milk");
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
