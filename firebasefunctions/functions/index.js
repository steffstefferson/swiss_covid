const functions = require("firebase-functions");

let XLSX = require("xlsx");
let requestUrl = require("request");
const admin = require("firebase-admin");
admin.initializeApp();

const db = admin.database();

const sheetName = "COVID19 Kantone";
const url =
  "https://www.bag.admin.ch/dam/bag/de/dokumente/mt/k-und-i/aktuelle-ausbrueche-pandemien/2019-nCoV/covid-19-datengrundlage-lagebericht.xlsx.download.xlsx/200325_Datengrundlage_Grafiken_COVID-19-Bericht.xlsx";

exports.helloWorld = functions.https.onRequest((request, response) => {
  functions.logger.info("helloWorld called!", { structuredData: true });
  response.send("Up and running");
});

exports.parseDataOnly = functions.https.onRequest(async (request, response) => {
  response.set("Access-Control-Allow-Origin", "*");

  if (request.method === "OPTIONS") {
    // Send responseponse to OPTIONS requests
    response.set("Access-Control-Allow-Methods", "GET");
    response.set("Access-Control-Allow-Headers", "Content-Type");
    response.set("Access-Control-Max-Age", "3600");
    response.status(204).send("");
    return;
  }

  var country = await parseData();
  functions.logger.info("parseData data for: " + country.date, country);
  if (country) {
    country = await generateDiff(country);
  }

  let asJson = !!request.query.json;
  if (!asJson) {
    response.send(toCsvData(country));
  } else {
    response.send(country);
  }
});

exports.getData = functions.https.onRequest(async (request, response) => {
  response.set("Access-Control-Allow-Origin", "*");

  if (request.method === "OPTIONS") {
    // Send responseponse to OPTIONS requests
    response.set("Access-Control-Allow-Methods", "GET");
    response.set("Access-Control-Allow-Headers", "Content-Type");
    response.set("Access-Control-Max-Age", "3600");
    response.status(204).send("");
    return;
  }

  let today = new Date();
  let dateToParse = request.query.date || today.toISOString().substring(0, 10);
  let lastFetchDate = request.query.lastFetchDate || '';
  let parsedDate = Date.parse(dateToParse);
  let date = isNaN(parsedDate) ? today : new Date(parsedDate);
  functions.logger.info("Load covid data for:", dateToParse);

  let data = await getDataOfDate(date);

  if(data && data.date === lastFetchDate){
    response.status(304).send("");
    return;
  }

  if (data) {
    functions.logger.info(
      "has already data of today serve date of db with generation date: " +
        data.generationDate
    );
    response.send(toCsvData(data));
    return;
  }

  var newData = await parseData();
  if (newData.date === date.toISOString().substring(0, 10)) {
    functions.logger.info("parseData data for: " + newData.date, newData);
    newData = await generateDiff(newData);
    await writeData(newData.date, newData);
    response.send(toCsvData(newData));
  } else {
    functions.logger.info("no data found for date: " + date);
    response.send({});
  }
});

function toCsvData(data) {
  var csvData = {
    date: data.date,
    generationDate: data.generationDate,
    dayDiffrence: data.dayDiffrence,
    country: toCsvItem(data.country),
    cantons: data.cantons.map(toCsvItem),
  };
  return csvData;
}

function toCsvItem(el) {
  return `${el.name},${el.cases},${el.casesDiff || ""},${el.casesTwoWeeks},${
    el.casesTwoWeeksDiff || ""
  },${el.incidence},${el.incidenceDiff || ""},${el.incidenceTwoWeeks},${
    el.incidenceTwoWeeksDiff || ""
  }`;
}

async function generateDiff(data) {
  let previousDateData = await getPreviousData(data.date);

  if (previousDateData === null) {
    functions.logger.info("no previous data found for date: " + data.date);
    return data;
  }

  var previousDate = new Date(previousDateData.date);
  var currentData = new Date(data.date);
  const diffTime = Math.abs(currentData - previousDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  data.country = diffItem(data.country, previousDateData.country);

  data.dayDiffrence = diffDays;

  for (let i = 0; i < data.cantons.length; i++) {
    var canton = data.cantons[i];
    var yesterdayCantons = previousDateData.cantons.filter(
      (x) => x.name === canton.name
    );
    if (yesterdayCantons && yesterdayCantons.length > 0) {
      let yesterdayCanton = yesterdayCantons[0];
      canton = diffItem(canton, yesterdayCanton);
      functions.logger.info("updated " + canton.name + " with diff: ", canton);
    }
  }
  return data;
}

function diffItem(item, previousItem) {
  item.casesDiff = Math.round(item.cases - previousItem.cases, 2);
  item.incidenceDiff = Math.round(item.incidence - previousItem.incidence, 2);
  item.casesTwoWeeksDiff = Math.round(
    item.casesTwoWeeks - previousItem.casesTwoWeeks,
    2
  );
  item.incidenceTwoWeeksDiff = Math.round(
    item.incidenceTwoWeeks - previousItem.incidenceTwoWeeks,
    2
  );
  return item;
}

async function getPreviousData(current) {
  var d = new Date(current);
  for (var i = 0; i < 10; i++) {
    d.setDate(d.getDate() - 1);
    // eslint-disable-next-line no-await-in-loop
    var result = await getDataOfDate(d);
    if (result) {
      functions.logger.info(
        "check snapshot2:" + d.toISOString().substring(0, 10) + "",
        result.cantons.length
      );
      return result;
    }
  }
  return null;
}

async function getDataOfDate(d) {
  return await db
    .ref("invectedDate/" + d.toISOString().substring(0, 10))
    .once("value")
    .then((snapshot) => {
      let data = snapshot.val();

      if (data && data.country) {
        return data;
      }
      return null;
    });
}

async function writeData(date, data) {
  return await db.ref("invectedDate/" + date).set(data);
}

async function parseData() {
  return new Promise((resolve, reject) => {
    requestUrl(url, { encoding: null }, (err, res, data) => {
      if (err || res.statusCode !== 200) reject(res.statusCode);

      /* data is a node Buffer that can be passed to XLSX.read */
      let workbook = XLSX.read(data, { type: "buffer" });
      let sheet = workbook.Sheets[sheetName];
      //functions.logger.info("parsed csv", XLSX.utils.sheet_to_json(sheet));
      let cellA1 = sheet["A1"] ? sheet["A1"].v : "";
      //Daten des Coronavirussituationsberichts, Stand 2020-10-05 08:00 Uhr';
      let regexpSize = /(?<year>[0-9]{4})-(?<month>[0-9]{2})-(?<day>[0-9]{2})/;
      let match = cellA1.match(regexpSize);
      console.log(
        `Got sheet of date: ${match.groups.day}.${match.groups.month}.${match.groups.year}.`,
        match.groups
      );

      let cantons = [];
      let date = `${match.groups.year}-${match.groups.month}-${match.groups.day}`;
      let r = 0;
      let covidData = { date, generationDate: new Date() + "" };
      let country = {};
      let cantonNames = [
        "AG",
        "AI",
        "AR",
        "BE",
        "BL",
        "BS",
        "FL",
        "FR",
        "GE",
        "GL",
        "GR",
        "JU",
        "LU",
        "NE",
        "NW",
        "OW",
        "SG",
        "SH",
        "SO",
        "SZ",
        "TG",
        "TI",
        "UR",
        "VD",
        "VS",
        "ZG",
        "ZH",
      ];

      while (r < 40) {
        let cellA = sheet["A" + r] ? sheet["A" + r].v : "";

        // functions.logger.info("cantons at " + r, cellA);
        if (cantonNames.includes(cellA)) {
          cantons.push({
            name: cellA,
            cases: sheet["B" + r].v,
            incidence: sheet["C" + r].v,
            casesTwoWeeks: sheet["E" + r].v,
            incidenceTwoWeeks: sheet["F" + r].v,
          });
        } else if (cellA.indexOf("CH") >= 0) {
          country.name = sheet["A" + r].v;
          country.cases = sheet["B" + r].v;
          country.incidence = sheet["C" + r].v;
          country.casesTwoWeeks = sheet["E" + r].v;
          country.incidenceTwoWeeks = sheet["F" + r].v;
          break;
        }
        r++;
      }
      covidData.cantons = cantons;
      covidData.country = country;
      functions.logger.info(
        "parsed country ok with cantons amount:",
        covidData.cantons.length
      );
      resolve(covidData);
    });
  });
}
