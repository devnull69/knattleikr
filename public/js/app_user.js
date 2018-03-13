var knattleikrUserApp = angular.module('knattleikrUserApp', []);

// Team-Mappings
var teamShort = {
   "t6"  : {shortname: "B04", iconId: 'de/f/f7/Bayer_Leverkusen_Logo.svg'},
   "t7"  : {shortname: "BVB", iconId: 'commons/6/67/Borussia_Dortmund_logo.svg'},
   "t9"  : {shortname: "S04", iconId: 'commons/6/6d/FC_Schalke_04_Logo.svg'},
   "t16" : {shortname: "VFB", iconId: 'commons/e/eb/VfB_Stuttgart_1893_Logo.svg'},
   "t40" : {shortname: "FCB", iconId: 'commons/thumb/1/1f/Logo_FC_Bayern_München_%282002–2017%29.svg/768px-Logo_FC_Bayern_München_%282002–2017%29.svg.png'},
   "t54" : {shortname: "BSC", iconId: 'de/3/38/Hertha_BSC_Logo.svg'},
   "t55" : {shortname: "H96", iconId: 'commons/c/cd/Hannover_96_Logo.svg'},
   "t65" : {shortname: "KOE", iconId: 'commons/0/0a/1.FC_Köln_escudo.png'},
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

knattleikrUserApp.factory('apiFactory', function($http) {
   var urlBase = "/api/user/";
   var apiFactory = {};
   var getRandomizer = "?" + (new Date()).getTime();

   apiFactory.getSpieltag = function(spieltagNr, userid) {
      return $http.get(urlBase + userid + '/spieltag/' + spieltagNr + getRandomizer);
   };

   return apiFactory;
});

knattleikrUserApp.controller('knattleikrUserController', function($scope, $sce, apiFactory) {

   $scope.sessionAktiv = sessionAktiv;
   $scope.aktuellerSpieltag = aktuellerSpieltag;
   $scope.otherUserId = otherUserId;

   // Controller-Methoden
   $scope.getAktuellenSpieltag = function() {
      $('#spinner').show();
      apiFactory.getSpieltag($scope.aktuellerSpieltag, $scope.otherUserId).then(response => {
         $scope.wertung = response.data.wertung;
         $scope.matchesFinished = [];
         $scope.matchesUnFinished = [];

         // Alle durchgehen und sehen, ob bereits Spiele fertig sind
         for(i=0; i<response.data.matches.length;i++) {
            if(response.data.matches[i].MatchIsFinished)
               $scope.matchesFinished.push(response.data.matches[i]);
            else
               $scope.matchesUnFinished.push(response.data.matches[i]);
         }

         $('#spinner').hide();
      });
   };

   $scope.getVorherigenSpieltag = function() {
      if($scope.aktuellerSpieltag > 1) {
         $scope.aktuellerSpieltag--;
         $scope.getAktuellenSpieltag();
      }
   };

   $scope.getNaechstenSpieltag = function() {
      if($scope.aktuellerSpieltag < 34) {
         $scope.aktuellerSpieltag++;
         $scope.getAktuellenSpieltag();
      }
   };

   $scope.showDatumUhrzeit = function(match) {
      var datum = moment(match.MatchDateTimeUTC);
      if(isBreakpoint('xs') || isBreakpoint('sm'))
         return datum.format("D.M., HH:mm");
      else
         return datum.format("dd DD MMM, HH:mm");
   };

   $scope.showTipp = function(match) {
      var matchDate = moment(match.MatchDateTimeUTC);
      var returnValue = "";
      $scope.tippbar = false;
      if(match.usertipp) {
         returnValue = match.usertipp.pointsTeam1 + ":" + match.usertipp.pointsTeam2;
      }
      return $sce.trustAsHtml(returnValue);
   };

   $scope.showTeamName = function(match, teamNr) {
      if(isBreakpoint('xs'))
         return teamShort["t"+match['Team'+teamNr].TeamId].shortname;
      else
         return match['Team'+teamNr].TeamName;
   };

   $scope.showIcon = function(match, teamNr) {
      var iconId = teamShort["t"+match['Team'+teamNr].TeamId].iconId;
      return "https://upload.wikimedia.org/wikipedia/" + iconId;
   };

   // sofort ausführen
   $scope.getAktuellenSpieltag();

   // Swipe-Handler binden
   $('.swipeable').on('swipeleft', function() {
      $scope.$apply(function() {
         $scope.getNaechstenSpieltag();
      });
   });
   $('.swipeable').on('swiperight', function() {
      $scope.$apply(function() {
         $scope.getVorherigenSpieltag();
      });
   });
   $('.swipeable').on('move', function(e) {
      if(e.distX > 80)
         $(this).css({marginLeft: 10 });
      else if(e.distX < -80)
         $(this).css({marginLeft: -10 });
   });
   $('.swipeable').on('moveend', function(e) {
      $(this).css({marginLeft: 0 });
   });
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