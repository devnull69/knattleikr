var knattleikrIndexApp = angular.module('knattleikrIndexApp', []);

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

knattleikrIndexApp.factory('apiFactory', function($http) {
   var urlBase = "api/";
   var apiFactory = {};
   var getRandomizer = "?" + (new Date()).getTime();

   apiFactory.getSpieltag = function(spieltagNr) {
      return $http.get(urlBase + 'spieltag/' + spieltagNr + getRandomizer);
   };

   apiFactory.tippAbgeben = function(spieltagNr, jsonData) {
      return $http.post(urlBase + 'spieltag/' + spieltagNr, jsonData);
   };

   return apiFactory;
});

knattleikrIndexApp.controller('knattleikrIndexController', function($scope, $sce, $window, apiFactory) {

   $scope.aktuellerSpieltag = aktuellerSpieltag;
   $scope.sessionAktiv = sessionAktiv;
   $scope.stundenVorher = stundenVorher;

   // Controller-Methoden
   $scope.getAktuellenSpieltag = function() {
      $('#spinner').show();
      apiFactory.getSpieltag($scope.aktuellerSpieltag).then(response => {
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
         return teamShort["t"+match['Team'+teamNr].TeamId];
      else
         return match['Team'+teamNr].TeamName;
   };

   // $scope.saveTipps = function() {
   //    var jsonData = $('#tippform').serializeArray();
   //    // Request-Array in Objekt mit Key=MatchId_X umwandeln
   //    var requestObject = {};
   //    for(i=0; i<jsonData.length; i++) {
   //       requestObject[jsonData[i].name] = jsonData[i].value;
   //    }
   //    apiFactory.tippsAbgeben($scope.aktuellerSpieltag, JSON.stringify(requestObject)).then(function(response) {
   //       window.scrollTo(0,0);
   //       if(response.data.err>0) {
   //          showMessage("danger", response.data.message);
   //       } else {
   //          showMessage("success", response.data.message);
   //       }
   //       $scope.getAktuellenSpieltag();
   //    });
   // };

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

   // Change-Handler binden
   $(document).on('change', 'input.tipp', function() {
      // Ist der Tipp komplett (beide Felder gefüllt), dann Tipp abgeben
      var feldName = $(this).prop('name');
      var matchNr = feldName.match(/^(\d+)/)[1];
      var teamNr = feldName.match(/(\d+)$/)[1];

      var teamA = this.value;
      var teamB = document.getElementsByName(matchNr + "_" + (teamNr%2+1))[0].value;

      if ((teamA != "" && teamB != "") || (teamA == "" && teamB == ""))
         $scope.$apply(function() {
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