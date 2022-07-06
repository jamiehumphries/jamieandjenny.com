const cheerio = require("cheerio");

function attendingSymbol(value) {
  switch (value) {
    case "yes":
      return "✔️";
    case "no":
      return "❌";
    default:
      return "";
  }
}

function courseSymbol(value, attending) {
  if (attending === "no") {
    return "–";
  }
  switch (value) {
    case "meat":
      return "🥩";
    case "veg":
      return "🥬";
    case "kids":
      return "🚸";
    case "milk":
      return "🍼";
    default:
      return "";
  }
}

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

function tableOfContents(html) {
  const $ = cheerio.load(`<div>${html}</div>`, null, false);
  const links = [];
  $("h2").each((_, h2) => {
    const $h2 = $(h2);
    const text = $(h2).text();
    const id = text
      .replaceAll(/\s/g, "-")
      .replaceAll(/[^\w-]/g, "")
      .toLowerCase();
    $h2.attr("id", id);
    links.push({ id, text });
  });
  return {
    links,
    html: $.html()
      .replace(/^<div>/, "")
      .replace(/<\/div>$/, ""),
  };
}

function validationKey(guest, fieldName) {
  return `${guest.id}__${fieldName}`;
}

module.exports = {
  attendingSymbol,
  courseSymbol,
  firstName,
  rsvpName,
  tableOfContents,
  validationKey,
};
