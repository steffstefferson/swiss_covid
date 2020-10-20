# Swiss Covid Data

## Browser Extension

- Chrome only
- Reads the data from the endpoint https://us-central1-swiss-covid.cloudfunctions.net/getData?date=
- Stores the data local and checks periodically for new data

Popup.(html|js|css) => Displaying the data

Options.(html|js|css) => Settings dialog

Background.js => poll and process for data

## Firebase functions

- Cloud function to parse and purify data from
  https://www.bag.admin.ch/dam/bag/de/dokumente/mt/k-und-i/aktuelle-ausbrueche-pandemien/2019-nCoV/covid-19-datengrundlage-lagebericht.xlsx.download.xlsx/200325_Datengrundlage_Grafiken_COVID-19-Bericht.xlsx
- Be aware that this data source has not the same numbers than the ones found here: https://github.com/openZH/covid_19
- Stores the data and the day diffrence in firebase
