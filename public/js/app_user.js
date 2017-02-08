var knattleikrUserApp = angular.module('knattleikrUserApp', []);

// Team-Mappings
var teamShort = {
   "t6"  : "B04",
   "t7"  : "BVB",
   "t9"  : "S04",
   "t40" : "FCB",
   "t54" : "BSC",
   "t65" : "KOE",
   "t81" : "M05",
   "t87" : "BMG",
   "t91" : "SGE",
   "t95" : "FCA",
   "t100": "HSV",
   "t112": "SCF",
   "t118": "D98",
   "t123": "TSG",
   "t131": "WOB",
   "t134": "SVW",
   "t171": "FCI",
   "t1635": "RBL"
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
         return teamShort["t"+match['Team'+teamNr].TeamId];
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