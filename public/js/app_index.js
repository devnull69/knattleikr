var knattleikrIndexApp = angular.module('knattleikrIndexApp', []);

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

knattleikrIndexApp.factory('apiFactory', function($http) {
   var urlBase = "api/";
   var apiFactory = {};
   var getRandomizer = "?" + (new Date()).getTime();

   apiFactory.getSpieltag = function(spieltagNr) {
      return $http.get(urlBase + 'spieltag/' + spieltagNr + getRandomizer);
   };

   // apiFactory.tippsAbgeben = function(spieltagNr, jsonData) {
   //    return $http.post(urlBase + 'spieltag/' + spieltagNr + '/alle', jsonData);
   // };

   apiFactory.tippAbgeben = function(spieltagNr, jsonData) {
      return $http.post(urlBase + 'spieltag/' + spieltagNr, jsonData);
   };

   apiFactory.getSpieltagTabelle = function(spieltagNr) {
      return $http.get(urlBase + "spieltag/" + spieltagNr + "/tabelle" + getRandomizer);
   };

   return apiFactory;
});

knattleikrIndexApp.controller('knattleikrIndexController', function($scope, $sce, $window, apiFactory) {

   $scope.aktuellerSpieltag = aktuellerSpieltag;
   $scope.sessionAktiv = sessionAktiv;
   $scope.stundenVorher = stundenVorher;
   $scope.tabelleninhalt = [];
   // $scope.spieltagDirty = false;

   // Controller-Methoden
   $scope.getAktuellenSpieltag = function() {
      $('#spinner').show();
      apiFactory.getSpieltag($scope.aktuellerSpieltag).then(response => {
         // $scope.spieltagDirty = false;
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

         apiFactory.getSpieltagTabelle($scope.aktuellerSpieltag).then(response => {
            $scope.tabelleninhalt = response.data;
         });

         // Ist Session inaktiv geworden? Dann refresh und Meldung anzeigen
         if($scope.sessionAktiv && !response.data.sessionOk)
            $window.location.href = "/?err=1";
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
         // Tippdatum minus x Stunden noch nicht erreicht? Dann input-Felder anzeigen
         if(moment.duration(matchDate.diff(moment())).asHours() > $scope.stundenVorher) {
            returnValue = '<input name="' + match.MatchID + '_1" class="tipp" type="text" maxlength="2" value="' + match.usertipp.pointsTeam1 + '" style="width: 25px;"/>:<input name="' + match.MatchID + '_2" class="tipp" type="text" maxlength="2" value="' + match.usertipp.pointsTeam2 + '" style="width: 25px;"/>';
            $scope.tippbar = true;
         }
         else {
            returnValue = match.usertipp.pointsTeam1 + ":" + match.usertipp.pointsTeam2;
         }
      } else {
         if(moment.duration(matchDate.diff(moment())).asHours() > $scope.stundenVorher) {
            returnValue = '<input name="' + match.MatchID + '_1" class="tipp" type="text" maxlength="2" value="" style="width: 25px;"/>:<input name="' + match.MatchID + '_2" class="tipp" type="text" maxlength="2" value="" style="width: 25px;"/>';
            $scope.tippbar = true;
         }
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
      return "http://s.bundesliga.de/assets/img/" + (Math.floor(iconId/10000)+1) * 10000 + "/" + iconId + "_original.svg";
   };

   $scope.saveTipps = function() {
      var jsonData = $('#tippform').serializeArray();
      // Request-Array in Objekt mit Key=MatchId_X umwandeln
      var requestObject = {};
      for(i=0; i<jsonData.length; i++) {
         requestObject[jsonData[i].name] = jsonData[i].value;
      }
      apiFactory.tippsAbgeben($scope.aktuellerSpieltag, JSON.stringify(requestObject)).then(function(response) {
         window.scrollTo(0,0);
         if(response.data.err>0) {
            showMessage("danger", response.data.message);
         } else {
            showMessage("success", response.data.message);
         }
         $scope.getAktuellenSpieltag();
      });
   };

   $scope.saveTipp = function(matchNr) {
      var requestObject = {};
      requestObject[matchNr+"_1"] = document.getElementsByName(matchNr + "_1")[0].value
      requestObject[matchNr+"_2"] = document.getElementsByName(matchNr + "_2")[0].value
      apiFactory.tippAbgeben($scope.aktuellerSpieltag, JSON.stringify(requestObject)).then(function(response) {
         if(response.data.err>0) {
            window.scrollTo(0,0);
            showMessage("danger", response.data.message);
         }
         //$scope.getAktuellenSpieltag();
      });
   };

   // sofort ausführen
   $scope.getAktuellenSpieltag();

   $(document).on('input', 'input.tipp', function(e) {
      // Ist der Tipp komplett (beide Felder gefüllt), dann Tipp abgeben
      var feldName = $(this).prop('name');
      var matchNr = feldName.match(/^(\d+)/)[1];
      var teamNr = feldName.match(/(\d+)$/)[1];

      var teamA = this.value;
      var teamB = document.getElementsByName(matchNr + "_" + (teamNr%2+1))[0].value;

      if ((teamA != "" && teamB != "") || (teamA == "" && teamB == ""))
         $scope.$apply(function() {
            // $scope.spieltagDirty = true;
            $scope.saveTipp(matchNr);
         });
   });

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
