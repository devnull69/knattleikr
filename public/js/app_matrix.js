var knattleikrMatrixApp = angular.module('knattleikrMatrixApp', []);

// Team-Mappings
var teamShort = {
   "t6"  : {shortname: "B04", iconId: 'de/f/f7/Bayer_Leverkusen_Logo.svg'},
   "t7"  : {shortname: "BVB", iconId: 'commons/6/67/Borussia_Dortmund_logo.svg'},
   "t9"  : {shortname: "S04", iconId: 'commons/6/6d/FC_Schalke_04_Logo.svg'},
   "t16" : {shortname: "VFB", iconId: 'commons/e/eb/VfB_Stuttgart_1893_Logo.svg'},
   "t40" : {shortname: "FCB", iconId: 'commons/c/c5/Logo_FC_Bayern_München.svg'},
   "t54" : {shortname: "BSC", iconId: 'de/3/38/Hertha_BSC_Logo.svg'},
   "t55" : {shortname: "H96", iconId: 'commons/c/cd/Hannover_96_Logo.svg'},
   "t65" : {shortname: "KOE", iconId: 'de/3/38/Dfs_wl_d_koeln_1_fc1967_1973.gif'},
   "t81" : {shortname: "M05", iconId: 'commons/d/d6/FSV_Mainz_05_Logo.png'},
   "t87" : {shortname: "BMG", iconId: 'commons/8/81/Borussia_Mönchengladbach_logo.svg'},
   "t91" : {shortname: "SGE", iconId: 'commons/0/04/Eintracht_Frankfurt_Logo.svg'},
   "t95" : {shortname: "FCA", iconId: 'de/b/b5/Logo_FC_Augsburg.svg'},
   "t100": {shortname: "HSV", iconId: 'commons/6/66/HSV-Logo.svg'},
   "t112": {shortname: "SCF", iconId: 'de/f/f1/SC-Freiburg_Logo-neu.svg'},
   "t118": {shortname: "D98", iconId: 'de/8/87/Svdarmstadt98.svg'},
   "t123": {shortname: "TSG", iconId: 'commons/e/e7/Logo_TSG_Hoffenheim.svg'},
   "t131": {shortname: "WOB", iconId: 'commons/c/ce/VfL_Wolfsburg_Logo.svg'},
   "t134": {shortname: "SVW", iconId: 'commons/b/be/SV-Werder-Bremen-Logo.svg'},
   "t171": {shortname: "FCI", iconId: 'de/5/55/FC-Ingolstadt_logo.svg'},
   "t1635":{shortname: "RBL", iconId: 'en/0/04/RB_Leipzig_2014_logo.svg'}
};

knattleikrMatrixApp.factory('apiFactory', function($http) {
   var urlBase = "/api/";
   var apiFactory = {};
   var getRandomizer = "?" + (new Date()).getTime();

   apiFactory.getTippsForSpieltagMatch = function(spieltagNr, matchNr) {
      return $http.get(urlBase + 'matrix/' + spieltagNr + '/' + matchNr + getRandomizer);
   };

   return apiFactory;
});

knattleikrMatrixApp.controller('knattleikrMatrixController', function($scope, $sce, $window, apiFactory) {

   $scope.spieltagNr = spieltagNr;
   $scope.matchNr = matchNr;
   $scope.matchTipps = {};

   // Controller-Methoden
   $scope.getTippsForSpieltagMatch = function() {
      apiFactory.getTippsForSpieltagMatch($scope.spieltagNr, $scope.matchNr).then(response => {
         $scope.matchTipps = response.data;
      });
   };

   // sofort ausführen
   $scope.getTippsForSpieltagMatch();

   $scope.showTeamName = function(teamNr) {
      if(isBreakpoint('xs'))
         return teamShort["t"+$scope.matchTipps['Team'+teamNr].TeamId].shortname;
      else
         return $scope.matchTipps['Team'+teamNr].TeamName;
   };

   $scope.showIcon = function(teamNr) {
      var iconId = teamShort["t"+$scope.matchTipps['Team'+teamNr].TeamId].iconId;
      return "https://upload.wikimedia.org/wikipedia/" + iconId;
   };

});

function showMessage(type, message) {
   $alertmessage = $('#alertmessage');
   // Message-Typ einsetzen
   $alertmessage.addClass('alert-' + type);

   $('#messagetext').text(message);
   $alertmessage.show();

   window.setTimeout(() => {
      $alertmessage.hide('slow', () => {
         // Message-Typ entfernen
         $alertmessage.removeClass('alert-' + type);
      });
   }, 5000);
}

function isBreakpoint( alias ) {
    return $('.device-' + alias).is(':visible');
}
