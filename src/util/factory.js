const d3 = require('d3');
const Tabletop = require('tabletop');
const _ = {
    map: require('lodash/map'),
    uniqBy: require('lodash/uniqBy'),
    capitalize: require('lodash/capitalize'),
    each: require('lodash/each')
};

const InputSanitizer = require('./inputSanitizer');
const Radar = require('../models/radar');
const Quadrant = require('../models/quadrant');
const Ring = require('../models/ring');
const Blip = require('../models/blip');
const GraphingRadar = require('../graphing/radar');
const MalformedDataError = require('../exceptions/malformedDataError');
const SheetNotFoundError = require('../exceptions/sheetNotFoundError');
const ContentValidator = require('./contentValidator');
const Sheet = require('./sheet');
const ExceptionMessages = require('./exceptionMessages');


const GoogleSheet = function (sheetReference, sheetName) {
    var self = {};

    self.build = function () {
        var sheet = new Sheet(sheetReference);
        sheet.exists(function(notFound) {
            if (notFound) {
                displayErrorMessage(notFound);
                return;
            }

            Tabletop.init({
                key: sheet.id,
                callback: createRadar
            });
        });

        function displayErrorMessage(exception) {
            d3.selectAll(".loading").remove();
            var message = 'Oops! It seems like there are some problems with loading your data. ';

            if (exception instanceof MalformedDataError) {
                message = message.concat(exception.message);
            } else if (exception instanceof SheetNotFoundError) {
                message = exception.message;
            } else {
                console.error(exception);
            }

            message = message.concat('<br/>', 'Please check <a href="https://info.thoughtworks.com/visualize-your-tech-strategy-guide.html#faq">FAQs</a> for possible solutions.');

            d3.select('body')
                .append('div')
                .attr('class', 'error-container')
                .append('div')
                .attr('class', 'error-container__message')
                .append('p')
                .html(message);
        }

        function createRadar(__, tabletop) {

            try {

                if (!sheetName) {
                    sheetName = tabletop.foundSheetNames[0];
                }
                var columnNames = tabletop.sheets(sheetName).columnNames;

                var contentValidator = new ContentValidator(columnNames);
                contentValidator.verifyContent();
                contentValidator.verifyHeaders();

                var all = tabletop.sheets(sheetName).all();
                var blips = _.map(all, new InputSanitizer().sanitize);

                document.title = tabletop.googleSheetName;
                d3.selectAll(".loading").remove();

                var rings = _.map(_.uniqBy(blips, 'ring'), 'ring');
                var ringMap = {};
                var maxRings = 4;

                _.each(rings, function (ringName, i) {
                    if (i == maxRings) {
                        throw new MalformedDataError(ExceptionMessages.TOO_MANY_RINGS);
                    }
                    ringMap[ringName] = new Ring(ringName, i);
                });

                var quadrants = {};
                _.each(blips, function (blip) {
                    if (!quadrants[blip.quadrant]) {
                        quadrants[blip.quadrant] = new Quadrant(_.capitalize(blip.quadrant));
                    }
                    quadrants[blip.quadrant].add(new Blip(blip.name, ringMap[blip.ring], blip.isNew.toLowerCase() === 'true', blip.topic, blip.description))
                });

                var radar = new Radar();
                _.each(quadrants, function (quadrant) {
                    radar.addQuadrant(quadrant)
                });

                var size = (window.innerHeight - 133) < 620 ? 620 : window.innerHeight - 133;

                new GraphingRadar(size, radar).init().plot();

            } catch (exception) {
                displayErrorMessage(exception);
            }
        }
    };

    return self;
};


const GoogleSheetInput = function () {
    var self = {};

    self.build = function () {
      var mySheetId = 'https://docs.google.com/spreadsheets/d/1tVip0HEzegaBSuFRiCgdGhWEXGr9BaxJUzpDaTX4zk4/edit';
      var sheet = GoogleSheet(mySheetId, undefined);
      sheet.build();
    };

    return self;
};

module.exports = GoogleSheetInput;
