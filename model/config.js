var mongoose = require('mongoose');

var configSchema = new mongoose.Schema({
   aktuellerSpieltag: Number,
   stundenVorher: Number
}, {collection: 'config'});

module.exports = mongoose.model('Config', configSchema);