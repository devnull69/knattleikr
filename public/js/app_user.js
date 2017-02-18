var knattleikrUserApp = angular.module('knattleikrUserApp', []);

// Team-Mappings
var teamShort = {
   "t6"  : {shortname: "B04", iconId: 7},
   "t7"  : {shortname: "BVB", iconId: 451245},
   "t9"  : {shortname: "S04", iconId: 34},
   "t40" : {shortname: "FCB", iconId: 451261},
   "t54" : {shortname: "BSC", iconId: 28},
   "t65" : {shortname: "KOE", iconId: 20},
   "t81" : {shortname: "M05", iconId: 31},
   "t87" : {shortname: "BMG", iconId: 9},
   "t91" : {shortname: "SGE", iconId: 451246},
   "t95" : {shortname: "FCA", iconId: 16},
   "t100": {shortname: "HSV", iconId: 26},
   "t112": {shortname: "SCF", iconId: 33},
   "t118": {shortname: "D98", iconId: 1055756},
   "t123": {shortname: "TSG", iconId: 6},
   "t131": {shortname: "WOB", iconId: 42},
   "t134": {shortname: "SVW", iconId: 39},
   "t171": {shortname: "FCI", iconId: 23},
   "t1635":{shortname: "RBL", iconId: 32}
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

   $scope.showIcon = function(match, teamNr) {
      var iconId = teamShort["t"+match['Team'+teamNr].TeamId].iconId;
      return "http://s.bundesliga.de/assets/img/" + (Math.floor(iconId/10000)+1) * 10000 + "/" + iconId + "_original.svg";
   };

   $scope.showTeamName = function(match, teamNr) {
      if(isBreakpoint('xs'))
         return teamShort["t"+match['Team'+teamNr].TeamId].shortname;
      else
         return match['Team'+teamNr].TeamName;
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