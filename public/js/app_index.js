var knattleikrIndexApp = angular.module('knattleikrIndexApp', []);

// Team-Mappings
var teamShort = {
   "t6"  : {shortname: "B04", iconId: 'de/f/f7/Bayer_Leverkusen_Logo.svg'},
   "t7"  : {shortname: "BVB", iconId: 'commons/6/67/Borussia_Dortmund_logo.svg'},
   "t9"  : {shortname: "S04", iconId: 'commons/6/6d/FC_Schalke_04_Logo.svg'},
   "t40" : {shortname: "FCB", iconId: 'commons/c/c5/Logo_FC_Bayern_München.svg'},
   "t54" : {shortname: "BSC", iconId: 'de/3/38/Hertha_BSC_Logo.svg'},
   "t65" : {shortname: "KOE", iconId: 'de/3/38/Dfs_wl_d_koeln_1_fc1967_1973.gif'},
   "t81" : {shortname: "M05", iconId: 'de/0/0b/FSV_Mainz_05_Logo.svg'},
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
   "t1635":{shortname: "RBL", iconId: ''}
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
      return "https://upload.wikimedia.org/wikipedia/" + iconId;
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
