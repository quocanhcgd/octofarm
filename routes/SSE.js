const express = require("express");
const router = express.Router();
const { ensureAuthenticated } = require("../config/auth");

const ClientSettings = require("../models/ClientSettings.js");

//Global store of dashboard info... wonder if there's a cleaner way of doing all this?!
let dashboardInfo = null;

const farmStatistics = require("../runners/statisticsCollection.js");
const FarmStatistics = farmStatistics.StatisticsCollection;
const SystemInfo = require("../models/SystemInfo.js");
const runner = require("../runners/state.js");
const Runner = runner.Runner;
const Roll = require("../models/Filament.js");

setInterval(async function() {
  //Only needed for WebSocket Information
  let printers = await Runner.returnFarmPrinters();
  let statistics = await FarmStatistics.returnStats();
  let currentOperations = null;
  let currentOperationsCount = null;
  let farmInfo = null;
  let octofarmStatistics = null;
  let printStatistics = null;
  if (typeof statistics != "undefined") {
    currentOperations = statistics.currentOperations;
    currentOperationsCount = statistics.currentOperationsCount;
    farmInfo = statistics.farmInfo;
    octofarmStatistics = statistics.octofarmStatistics;
    printStatistics = statistics.printStatistics;
  } else {
    currentOperations = 0;
    currentOperationsCount = 0;
    farmInfo = 0;
    octofarmStatistics = 0;
    printStatistics = 0;
  }
  let printerInfo = [];
  let systemInformation = await SystemInfo.find({});
  let roll = await Roll.find({});
  let clientSettings = await ClientSettings.find({});
  for (let i = 0; i < printers.length; i++) {
    let selectedFilament = null;
    if (typeof printers[i].selectedFilament != "undefined") {
      selectedFilament = printers[i].selectedFilament;
    }
    let printer = {
      state: printers[i].state,
      index: printers[i].index,
      ip: printers[i].ip,
      port: printers[i].port,
      camURL: printers[i].camURL,
      apikey: printers[i].apikey,
      currentZ: printers[i].currentZ,
      progress: printers[i].progress,
      job: printers[i].job,
      profile: printers[i].profiles,
      temps: printers[i].temps,
      flowRate: printers[i].flowRate,
      feedRate: printers[i].feedRate,
      stepRate: printers[i].stepRate,
      filesList: printers[i].fileList,
      logs: printers[i].logs,
      messages: printers[i].messages,
      plugins: printers[i].settingsPlugins,
      gcode: printers[i].settingsScripts,
      url: printers[i].ip + ":" + printers[i].port,
      settingsAppearance: printers[i].settingsApperance,
      stateColour: printers[i].stateColour,
      current: printers[i].current,
      options: printers[i].options,
      selectedFilament: selectedFilament,
      settingsWebcam: printers[i].settingsWebcam
    };
    printerInfo.push(printer);
  }
  dashboardInfo = {
    printerInfo: printerInfo,
    currentOperations: currentOperations,
    currentOperationsCount: currentOperationsCount,
    farmInfo: farmInfo,
    octofarmStatistics: octofarmStatistics,
    printStatistics: printStatistics,
    systemInfo: systemInformation[0],
    filament: roll,
    clientSettings: clientSettings
  };
}, 500);

var clientId = 0;
var clients = {}; // <- Keep a map of attached clients

// Called once for each new client. Note, this response is left open!
router.get("/printerInfo/", ensureAuthenticated, function(req, res) {
  req.socket.setTimeout(Number.MAX_VALUE);
  res.writeHead(200, {
    "Content-Type": "text/event-stream", // <- Important headers
    "Cache-Control": "no-cache",
    Connection: "keep-alive"
  });
  res.write("\n");
  (function(clientId) {
    clients[clientId] = res; // <- Add this client to those we consider "attached"
    req.on("close", function() {
      delete clients[clientId];
    }); // <- Remove this client when he disconnects
  })(++clientId);
  //console.log("Client: " + Object.keys(clients));
});

setInterval(function() {
  var msg = Math.random();
  dashboardInfo = JSON.stringify(dashboardInfo);
  for (clientId in clients) {
    clients[clientId].write("data: " + dashboardInfo + "\n\n"); // <- Push a message to a single attached client
  }
}, 500);

module.exports = router;
