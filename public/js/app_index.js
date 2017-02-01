var knattleikrIndexApp = angular.module('knattleikrIndexApp', []);

knattleikrIndexApp.factory('apiFactory', function($http) {
   var urlBase = "api/";
   var apiFactory = {};

   apiFactory.getSpieltag = function(spieltagNr) {
      return $http.get(urlBase + 'spieltag/' + spieltagNr);
   };

   apiFactory.tippsAbgeben = function(spieltagNr, jsonData) {
      return $http.post(urlBase + 'spieltag/' + spieltagNr, jsonData);
   };

   return apiFactory;
});

knattleikrIndexApp.controller('knattleikrIndexController', function($scope, $sce, $window, apiFactory) {

   $scope.aktuellerSpieltag = aktuellerSpieltag;
   $scope.spieltagDirty = false;
   $scope.sessionAktiv = sessionAktiv;

   // Controller-Methoden
   $scope.getAktuellenSpieltag = function() {
      $scope.spieltagDirty = false;
      apiFactory.getSpieltag($scope.aktuellerSpieltag).then(response => {
         $scope.spieltagDaten = response.data.matches;
         $scope.wertung = response.data.wertung;

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
      return datum.format("dd DD MMM, HH:mm");
   };

   $scope.showTipp = function(match) {
      var matchDate = moment(match.MatchDateTimeUTC);
      var returnValue = "";
      if(match.usertipp) {
         // Tippdatum minus 5 Stunden noch nicht erreicht? Dann input-Felder anzeigen
         if(moment.duration(matchDate.diff(moment())).asHours() > 5)
            returnValue = '<input name="' + match.MatchID + '_1" class="tipp" type="text" size="1" maxlength="2" value="' + match.usertipp.pointsTeam1 + '"/>:<input name="' + match.MatchID + '_2" class="tipp" type="text" size="1" maxlength="2" value="' + match.usertipp.pointsTeam2 + '"/>';
         else
            returnValue = match.usertipp.pointsTeam1 + ":" + match.usertipp.pointsTeam2;
      } else {
         if(moment.duration(matchDate.diff(moment())).asHours() > 5)
            returnValue = '<input name="' + match.MatchID + '_1" class="tipp" type="text" size="1" maxlength="2" value=""/>:<input name="' + match.MatchID + '_2" class="tipp" type="text" size="1" maxlength="2" value=""/>';
      }
      return $sce.trustAsHtml(returnValue);
   };

   $scope.saveTipps = function() {
      var jsonData = $('#tippform').serializeArray();
      // Request-Array in Objekt mit Key=MatchId_X umwandeln
      var requestObject = {};
      for(i=0; i<jsonData.length; i++) {
         requestObject[jsonData[i].name] = jsonData[i].value;
      }
      apiFactory.tippsAbgeben($scope.aktuellerSpieltag, JSON.stringify(requestObject)).then(function(response) {
         if(response.data.err>0) {
            showMessage("danger", response.data.message);
         } else {
            showMessage("success", response.data.message);
         }
         $scope.getAktuellenSpieltag();
      });
      $scope.spieltagDirty = false;
   };

   // sofort ausführen
   $scope.getAktuellenSpieltag();

   // Change-Handler binden
   $(document).on('change', 'input.tipp', function() {
      $scope.spieltagDirty = true;
      $scope.$apply();
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